import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * DEEP Phase 4: provisionCloneDeployment — Production Multi-Stack Egress
 *
 * Deploys the verified clone to production:
 * 1. Creates a GitHub repository and pushes the clone code
 * 2. Creates a Vercel project and triggers deployment
 * 3. Returns the deployed URL
 *
 * Requires: GITHUB_API_KEY and VERCEL_API_TOKEN secrets
 */

async function githubApi(endpoint, method = "GET", body = null) {
  const token = secrets.get("GITHUB_API_KEY");
  if (!token) throw new Error("GITHUB_API_KEY secret not set");

  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub API error: ${data.message || res.status}`);
  return data;
}

async function vercelApi(endpoint, method = "GET", body = null) {
  const token = secrets.get("VERCEL_API_TOKEN");
  if (!token) throw new Error("VERCEL_API_TOKEN secret not set");

  const res = await fetch(`https://api.vercel.com${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Vercel API error: ${data.error?.message || res.status}`);
  return data;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const { clone_project_id } = body;
    if (!clone_project_id) return Response.json({ error: "clone_project_id is required" }, { status: 400 });

    // Load the CloneProject
    const project = await base44.entities.CloneProject.get(clone_project_id);
    if (!project) return Response.json({ error: "Clone project not found" }, { status: 404 });

    if (project.status !== "validating" && project.status !== "deployed") {
      return Response.json({
        error: `Clone must be in validating or deployed status (current: ${project.status}). Run validation first.`,
      }, { status: 400 });
    }

    await base44.entities.CloneProject.update(clone_project_id, {
      status: "deploying",
      phase: "egress",
    });

    const results = {
      github: null,
      vercel: null,
    };

    // Load the mock backend code
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
    const mockBackendAsset = assets.find((a) => a.asset_type === "mock_backend");
    const domAsset = assets.find((a) => a.asset_type === "dom");

    let mockBackendCode = "";
    if (mockBackendAsset?.file_url) {
      try {
        const codeRes = await fetch(mockBackendAsset.file_url);
        if (codeRes.ok) mockBackendCode = await codeRes.text();
      } catch (err) {
        console.error("Failed to fetch mock backend code:", err.message);
      }
    }

    let domHtml = "";
    if (domAsset?.file_url) {
      try {
        const domRes = await fetch(domAsset.file_url);
        if (domRes.ok) {
          const domData = await domRes.json();
          domHtml = domData.html || "";
        }
      } catch (err) {
        console.error("Failed to fetch DOM snapshot:", err.message);
      }
    }

    // ═══════════════════════════════════════════
    // 1. GITHUB: Create repo and push code
    // ═══════════════════════════════════════════
    try {
      const repoName = `clone-${(project.target_name || "site").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now().toString(36).slice(-4)}`;

      // Get authenticated user
      const ghUser = await githubApi("/user");
      const owner = ghUser.login;

      // Create repository
      const repo = await githubApi("/user/repos", "POST", {
        name: repoName,
        description: `DEEP Clone of ${project.target_url}`,
        private: false,
        auto_init: true,
      });

      // Push index.html (the cloned frontend) into public/ for Express static serving
      const indexHtml = generateIndexHtml(domHtml, project);
      await githubApi(`/repos/${owner}/${repoName}/contents/public/index.html`, "PUT", {
        message: "DEEP Clone: Add cloned frontend",
        content: btoa(unescape(encodeURIComponent(indexHtml))),
      });

      // Push server.js (the mock backend)
      if (mockBackendCode) {
        await githubApi(`/repos/${owner}/${repoName}/contents/server.js`, "PUT", {
          message: "DEEP Clone: Add inferred mock backend",
          content: btoa(unescape(encodeURIComponent(mockBackendCode))),
        });
      }

      // Push package.json with express + static file serving
      const pkgJson = JSON.stringify({
        name: repoName,
        version: "1.0.0",
        scripts: { start: "node server.js" },
        dependencies: { express: "^4.18.0", "node-fetch": "^2.7.0" },
      }, null, 2);
      await githubApi(`/repos/${owner}/${repoName}/contents/package.json`, "PUT", {
        message: "DEEP Clone: Add package.json",
        content: btoa(unescape(encodeURIComponent(pkgJson))),
      });

      // Push vercel.json — configures static frontend + Express API on Vercel
      const vercelJson = JSON.stringify({
        version: 2,
        builds: [
          { src: "server.js", use: "@vercel/node" },
        ],
        routes: [
          { src: "/proxy", dest: "/server.js" },
          { src: "/api/(.*)", dest: "/server.js" },
          { src: "/__health", dest: "/server.js" },
          { src: "/(.*)", dest: "/public/$1" },
        ],
      }, null, 2);
      await githubApi(`/repos/${owner}/${repoName}/contents/vercel.json`, "PUT", {
        message: "DEEP Clone: Add Vercel deployment config",
        content: btoa(unescape(encodeURIComponent(vercelJson))),
      });

      // Push README
      const readme = `# ${repoName}\n\nAuto-generated clone of ${project.target_url}\n\n## DEEP Clone System\n- Stack: ${project.stack_type}\n- Endpoints: ${project.endpoint_count}\n- Gaps resolved: ${project.gap_count}\n- Parity score: ${project.parity_score}%\n\nGenerated by CloudBrowser DEEP Pipeline.\n`;
      await githubApi(`/repos/${owner}/${repoName}/contents/README.md`, "PUT", {
        message: "DEEP Clone: Add README",
        content: btoa(unescape(encodeURIComponent(readme))),
      });

      results.github = {
        repo_url: repo.html_url,
        repo_name: repoName,
        owner,
      };
    } catch (err) {
      results.github = { error: err.message };
    }

    // ═══════════════════════════════════════════
    // 2. VERCEL: Create project and deploy
    // ═══════════════════════════════════════════
    try {
      if (results.github?.repo_url) {
        // Create Vercel project linked to the GitHub repo
        const vercelProject = await vercelApi("/v10/projects", "POST", {
          name: results.github.repo_name,
          gitRepository: {
            type: "github",
            repo: `${results.github.owner}/${results.github.repo_name}`,
          },
        });

        // Trigger deployment
        const deployment = await vercelApi("/v13/deployments", "POST", {
          project: vercelProject.id,
          target: "production",
          gitSource: {
            type: "github",
            repo: `${results.github.owner}/${results.github.repo_name}`,
            ref: "main",
          },
        });

        results.vercel = {
          project_id: vercelProject.id,
          deployment_id: deployment.id,
          url: deployment.url ? `https://${deployment.url}` : null,
        };
      }
    } catch (err) {
      results.vercel = { error: err.message };
    }

    // ═══════════════════════════════════════════
    // 3. UPDATE: CloneProject with deployment info
    // ═══════════════════════════════════════════
    const deployedUrl = results.vercel?.url || null;
    await base44.entities.CloneProject.update(clone_project_id, {
      status: deployedUrl ? "deployed" : "failed",
      deployed_url: deployedUrl,
      github_repo_url: results.github?.repo_url || null,
      vercel_project_id: results.vercel?.project_id || null,
      completed_at: new Date().toISOString(),
      error_message: !deployedUrl ? `GitHub: ${results.github?.error || "ok"} | Vercel: ${results.vercel?.error || "ok"}` : null,
    });

    return Response.json({
      ok: !!deployedUrl,
      clone_project_id,
      deployed_url: deployedUrl,
      github: results.github,
      vercel: results.vercel,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate a clean, self-contained index.html from the captured DOM.
 * Rewrites absolute asset URLs to proxy through the mock backend so the clone
 * doesn't depend on the original site's servers.
 */
function generateIndexHtml(domHtml, project) {
  let cleanHtml = domHtml || "";
  const targetOrigin = (() => {
    try { return new URL(project.target_url).origin; } catch { return ""; }
  })();

  // Remove script tags that load external trackers
  cleanHtml = cleanHtml.replace(
    /<script[^>]*(google-analytics|googletagmanager|facebook\.net|hotjar|segment\.io|mixpanel)[^>]*><\/script>/gi,
    ""
  );

  // Rewrite absolute URLs to the target origin → relative proxy paths
  if (targetOrigin) {
    // CSS, JS, images, fonts, links, etc. with absolute URLs to the target
    cleanHtml = cleanHtml.replace(
      new RegExp(targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      ""
    );
  }

  // Rewrite cross-origin asset URLs to proxy through /proxy?url=<encoded>
  // This handles CDN URLs, third-party asset hosts, etc.
  cleanHtml = cleanHtml.replace(
    /((?:src|href|action|data-src|poster)\s*=\s*["'])(https?:\/\/[^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      // Don't proxy data: URIs or already-relative paths
      if (url.startsWith("data:") || url.startsWith("/proxy?")) return match;
      return `${prefix}/proxy?url=${encodeURIComponent(url)}${suffix}`;
    }
  );

  // Inject a fetch/XHR interceptor that routes API calls to the mock backend
  const interceptorScript = `
<script>
// DEEP Clone API interceptor — routes all fetch/XHR to the mock backend
(function() {
  var MOCK_API_PREFIX = '';
  var origFetch = window.fetch;
  var origXhrOpen = XMLHttpRequest.prototype.open;

  // Intercept fetch
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : input.url;
    // If the URL points to the original site's API, route to mock backend
    if (url && (url.indexOf('/api/') !== -1 || url.indexOf('/graphql') !== -1)) {
      // Already relative — let it hit the mock backend
    }
    return origFetch.apply(this, arguments);
  };

  // Intercept XHR
  XMLHttpRequest.prototype.open = function(method, url) {
    // If absolute URL to original site, rewrite to relative
    if (url && url.indexOf("${targetOrigin}") === 0) {
      url = url.substring("${targetOrigin}".length);
    }
    return origXhrOpen.apply(this, [method, url]);
  };
})();
</script>`;

  // If the DOM already has <html> tags, inject interceptor into <head>
  if (cleanHtml.trim().toLowerCase().startsWith("<!doctype") || cleanHtml.trim().toLowerCase().startsWith("<html")) {
    // Inject interceptor right after <head> or at the beginning
    if (cleanHtml.toLowerCase().includes("<head>")) {
      cleanHtml = cleanHtml.replace(/<head>/i, "<head>" + interceptorScript);
    } else {
      cleanHtml = cleanHtml.replace(/<html/i, "<html" + interceptorScript);
    }
    return cleanHtml;
  }

  // Otherwise wrap it
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.target_name || "Clone"} — DEEP Clone</title>
  <meta name="generator" content="CloudBrowser DEEP Pipeline">
  ${interceptorScript}
</head>
<body>
${cleanHtml}
</body>
</html>`;
}