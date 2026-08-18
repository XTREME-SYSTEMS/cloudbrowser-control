import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { url } = body;
    if (!url) return Response.json({ error: "url required" }, { status: 400 });

    const parsedUrl = new URL(url);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    let robotsTxt = "";
    let allowed = true;
    let disallowedPaths = [];

    try {
      const resp = await fetch(robotsUrl);
      if (resp.ok) {
        robotsTxt = await resp.text();
        // Parse robots.txt — check if our path is disallowed
        const userAgent = "*";
        const lines = robotsTxt.split("\n");
        let inOurAgent = false;
        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();
          if (trimmed.startsWith("user-agent:")) {
            inOurAgent = trimmed.includes(userAgent) || trimmed.includes("all");
          } else if (inOurAgent && trimmed.startsWith("disallow:")) {
            const path = trimmed.replace("disallow:", "").trim();
            if (path && parsedUrl.pathname.startsWith(path)) {
              allowed = false;
              disallowedPaths.push(path);
            }
          }
        }
      }
    } catch (e) { /* robots.txt not found, assume allowed */ }

    return Response.json({
      url,
      allowed,
      robots_txt_url: robotsUrl,
      robots_txt_available: robotsTxt.length > 0,
      disallowed_paths: disallowedPaths,
      crawl_delay: robotsTxt.match(/crawl-delay:\s*(\d+)/i)?.[1] || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}