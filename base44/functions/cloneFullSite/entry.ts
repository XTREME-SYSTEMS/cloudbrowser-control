import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { setEngineClient, enginePost, engineGet, engineDelete, isEngineConfigured } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * DEEP Phase 1: cloneFullSite — Deterministic Frontend Capture
 *
 * Uses the browser engine to capture:
 * - Full post-hydration DOM snapshot
 * - Complete network trace (HAR equivalent)
 * - Desktop (1920x1080) and mobile (390x844) screenshots
 * - Asset manifest (stylesheets, scripts, images, fonts)
 *
 * All captured assets are stored as CloneAsset records.
 */

async function uploadJsonFile(base44, data, filename) {
  const file = new File([JSON.stringify(data, null, 2)], filename, { type: "application/json" });
  const result = await base44.integrations.Core.UploadFile({ file });
  return result.file_url;
}

async function uploadBase64Image(base44, base64Data, filename, mimeType = "image/png") {
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const file = new File([byteArray], filename, { type: mimeType });
  const result = await base44.integrations.Core.UploadFile({ file });
  return result.file_url;
}

async function captureViewport(base44, targetUrl, viewport, viewportLabel) {
  // Create session with specific viewport
  const session = await enginePost("/sessions", {
    viewport: { width: viewport.width, height: viewport.height },
    blockedResources: [], // capture everything
  });
  const sessionId = session.sessionId;

  try {
    // Navigate to target
    await enginePost(`/sessions/${sessionId}/execute`, {
      action_type: "goto",
      value: targetUrl,
      options: { waitUntil: "networkidle", timeout: 30000 },
    });

    // Wait for full hydration
    await enginePost(`/sessions/${sessionId}/execute`, {
      action_type: "wait_for_load_state",
      options: { state: "networkidle", timeout: 15000 },
    });

    // Capture full DOM snapshot
    const domResult = await enginePost(`/sessions/${sessionId}/execute`, {
      action_type: "evaluate",
      options: {
        fn: `() => document.documentElement.outerHTML`,
      },
    });

    // Capture screenshot
    const screenshotResult = await enginePost(`/sessions/${sessionId}/execute`, {
      action_type: "screenshot",
      options: { fullPage: true },
    });

    // Capture extracted structured DOM tree (forms, links, interactive elements)
    const structResult = await enginePost(`/sessions/${sessionId}/execute`, {
      action_type: "evaluate",
      options: {
        fn: `() => {
          const forms = [...document.querySelectorAll('form')].map(f => ({
            action: f.action,
            method: (f.method || 'GET').toUpperCase(),
            fields: [...f.querySelectorAll('input,select,textarea')].map(i => ({
              name: i.name, type: i.type, required: i.required, placeholder: i.placeholder,
              pattern: i.pattern, options: i.tagName === 'SELECT' ? [...i.options].map(o => o.value) : undefined
            }))
          }));
          const links = [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: a.innerText.trim() })).slice(0, 200);
          const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src).slice(0, 100);
          const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).slice(0, 50);
          const images = [...document.querySelectorAll('img[src]')].map(i => ({ src: i.src, alt: i.alt })).slice(0, 200);
          const meta = [...document.querySelectorAll('meta')].map(m => ({ name: m.name || m.getAttribute('property'), content: m.content })).slice(0, 50);
          return { forms, links, scripts, stylesheets, images, meta, title: document.title, url: window.location.href };
        }`,
      },
    });

    // Get session info (includes network logs)
    const sessionInfo = await engineGet(`/sessions/${sessionId}`);

    return {
      sessionId,
      viewport: viewportLabel,
      domHtml: domResult.data,
      screenshotBase64: screenshotResult.base64,
      structuredData: structResult.data,
      networkLogs: sessionInfo.networkLogs || [],
      consoleLogs: sessionInfo.consoleLogs || [],
    };
  } finally {
    // Always close the session
    await engineDelete(`/sessions/${sessionId}`).catch(() => {});
  }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { target_url, target_name } = body;

    if (!target_url) return Response.json({ error: "target_url is required" }, { status: 400 });

    // Check engine is configured
    const engineReady = await isEngineConfigured();
    if (!engineReady) {
      return Response.json({
        error: "Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Settings → Secrets.",
      }, { status: 503 });
    }

    // Validate URL
    try {
      new URL(target_url);
    } catch {
      return Response.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Create CloneProject record
    const project = await base44.entities.CloneProject.create({
      target_url,
      target_name: target_name || new URL(target_url).hostname,
      status: "acquiring",
      phase: "acquisition",
      started_at: new Date().toISOString(),
    });

    // Update status to acquiring
    let assetCount = 0;
    const errors = [];

    try {
      // ═══════════════════════════════════════════
      // CAPTURE: Desktop viewport (1920x1080)
      // ═══════════════════════════════════════════
      let desktopCapture, mobileCapture;
      try {
        desktopCapture = await captureViewport(base44, target_url, { width: 1920, height: 1080 }, "desktop");
      } catch (err) {
        errors.push(`Desktop capture failed: ${err.message}`);
      }

      // ═══════════════════════════════════════════
      // CAPTURE: Mobile viewport (390x844)
      // ═══════════════════════════════════════════
      try {
        mobileCapture = await captureViewport(base44, target_url, { width: 390, height: 844 }, "mobile");
      } catch (err) {
        errors.push(`Mobile capture failed: ${err.message}`);
      }

      // Use desktop capture as primary (fallback to mobile if desktop failed)
      const primary = desktopCapture || mobileCapture;
      if (!primary) {
        throw new Error("All viewport captures failed: " + errors.join("; "));
      }

      // ═══════════════════════════════════════════
      // STORE: DOM Snapshot
      // ═══════════════════════════════════════════
      const domSnapshot = {
        html: primary.domHtml,
        viewport_desktop: { width: 1920, height: 1080 },
        viewport_mobile: { width: 390, height: 844 },
        captured_at: new Date().toISOString(),
        target_url,
      };
      const domUrl = await uploadJsonFile(base44, domSnapshot, "dom_snapshot.json");
      await base44.entities.CloneAsset.create({
        clone_project_id: project.id,
        asset_type: "dom",
        file_url: domUrl,
        source_url: target_url,
        viewport: "desktop",
        status: "captured",
        size_bytes: primary.domHtml?.length || 0,
      });
      assetCount++;

      // ═══════════════════════════════════════════
      // STORE: Network Trace (HAR equivalent)
      // ═══════════════════════════════════════════
      const allNetworkLogs = [
        ...(desktopCapture?.networkLogs || []),
        ...(mobileCapture?.networkLogs || []),
      ];
      const networkTrace = {
        target_url,
        captured_at: new Date().toISOString(),
        entries: allNetworkLogs.map((log) => ({
          method: log.method,
          url: log.url,
          type: log.type,
          status: log.status,
          time: log.time ? new Date(log.time).toISOString() : null,
        })),
      };
      const harUrl = await uploadJsonFile(base44, networkTrace, "network_trace.json");
      await base44.entities.CloneAsset.create({
        clone_project_id: project.id,
        asset_type: "har",
        file_url: harUrl,
        source_url: target_url,
        viewport: "none",
        status: "captured",
        size_bytes: JSON.stringify(networkTrace).length,
      });
      assetCount++;

      // ═══════════════════════════════════════════
      // STORE: Asset Manifest
      // ═══════════════════════════════════════════
      const structured = primary.structuredData || {};
      const assetManifest = {
        target_url,
        captured_at: new Date().toISOString(),
        scripts: structured.scripts || [],
        stylesheets: structured.stylesheets || [],
        images: structured.images || [],
        forms: structured.forms || [],
        links: structured.links || [],
        meta: structured.meta || [],
      };
      const manifestUrl = await uploadJsonFile(base44, assetManifest, "asset_manifest.json");
      await base44.entities.CloneAsset.create({
        clone_project_id: project.id,
        asset_type: "form_schema",
        file_url: manifestUrl,
        source_url: target_url,
        viewport: "none",
        status: "captured",
        size_bytes: JSON.stringify(assetManifest).length,
      });
      assetCount++;

      // ═══════════════════════════════════════════
      // STORE: Desktop Screenshot
      // ═══════════════════════════════════════════
      let desktopScreenshotUrl = null;
      if (desktopCapture?.screenshotBase64) {
        desktopScreenshotUrl = await uploadBase64Image(base44, desktopCapture.screenshotBase64, `screenshot-desktop-${project.id}.png`, "image/png");
        await base44.entities.CloneAsset.create({
          clone_project_id: project.id,
          asset_type: "screenshot",
          file_url: desktopScreenshotUrl,
          source_url: target_url,
          viewport: "desktop",
          status: "captured",
        });
        assetCount++;
      }

      // ═══════════════════════════════════════════
      // STORE: Mobile Screenshot
      // ═══════════════════════════════════════════
      let mobileScreenshotUrl = null;
      if (mobileCapture?.screenshotBase64) {
        mobileScreenshotUrl = await uploadBase64Image(base44, mobileCapture.screenshotBase64, `screenshot-mobile-${project.id}.png`, "image/png");
        await base44.entities.CloneAsset.create({
          clone_project_id: project.id,
          asset_type: "screenshot",
          file_url: mobileScreenshotUrl,
          source_url: target_url,
          viewport: "mobile",
          status: "captured",
        });
        assetCount++;
      }

      // ═══════════════════════════════════════════
      // UPDATE: CloneProject with all captured data
      // ═══════════════════════════════════════════
      await base44.entities.CloneProject.update(project.id, {
        status: "compiling",
        phase: "compilation",
        dom_snapshot_url: domUrl,
        network_trace_url: harUrl,
        asset_manifest_url: manifestUrl,
        form_schemas_url: manifestUrl, // forms are in the manifest
        desktop_screenshot_url: desktopScreenshotUrl,
        mobile_screenshot_url: mobileScreenshotUrl,
        asset_count: assetCount,
        endpoint_count: allNetworkLogs.filter((l) => l.type === "xhr" || l.type === "fetch").length,
      });

      return Response.json({
        ok: true,
        project_id: project.id,
        status: "compiling",
        assets_captured: assetCount,
        endpoints_discovered: allNetworkLogs.filter((l) => l.type === "xhr" || l.type === "fetch").length,
        dom_snapshot_url: domUrl,
        network_trace_url: harUrl,
        desktop_screenshot_url: desktopScreenshotUrl,
        mobile_screenshot_url: mobileScreenshotUrl,
        errors: errors.length > 0 ? errors : undefined,
        __v: DEPLOYMENT_VERSION,
      });

    } catch (err) {
      // Mark project as failed
      await base44.entities.CloneProject.update(project.id, {
        status: "failed",
        error_message: err.message,
      });
      throw err;
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}