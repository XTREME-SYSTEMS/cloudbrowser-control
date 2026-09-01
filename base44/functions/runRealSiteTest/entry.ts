// ═══════════════════════════════════════════════
// runRealSiteTest — Forensic proof: drives the engine against
// real public sites, captures screenshots, extracts data.
// Returns visual evidence of browser automation capability.
// ═══════════════════════════════════════════════

import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { enginePost, engineDelete, setEngineClient } from "../../shared/engineClient.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers?.["x-request-id"];

  const sites = [
    { url: "https://example.com", name: "Example.com", type: "basic" },
    { url: "https://news.ycombinator.com", name: "Hacker News", type: "news" },
  ];

  const results = [];

  for (const site of sites) {
    const r = { site: site.name, url: site.url };
    try {
      // 1. Create session with full stealth fingerprint + human behavior
      const session = await enginePost("/sessions", {
        usePool: true,
        fingerprintLevel: "full",
        behaviorLevel: "high",
      }, requestId);
      const sid = session.sessionId;
      r.sessionId = sid;

      // 2. Navigate to the real site
      const navStart = Date.now();
      const nav = await enginePost(`/sessions/${sid}/execute`, {
        action_type: "goto",
        value: site.url,
        options: { waitUntil: "domcontentloaded", timeout: 30000 },
      }, requestId);
      r.navTimeMs = Date.now() - navStart;
      r.finalUrl = nav.url;
      r.navTitle = nav.title;

      // 3. Screenshot → upload to file storage
      const ss = await enginePost(`/sessions/${sid}/execute`, {
        action_type: "screenshot",
        options: { fullPage: false },
      }, requestId);

      if (ss.base64) {
        const file = new File(
          [Uint8Array.from(atob(ss.base64), (c) => c.charCodeAt(0))],
          `forensic-${site.name.replace(/\s/g, "-").toLowerCase()}.png`,
          { type: "image/png" }
        );
        const upload = await base44.integrations.Core.UploadFile({ file });
        r.screenshotUrl = upload.file_url;
      }

      // 4. Extract page title via evaluate
      const titleRes = await enginePost(`/sessions/${sid}/execute`, {
        action_type: "evaluate",
        value: "document.title",
      }, requestId);
      r.pageTitle = titleRes.data;

      // 5. Extract body text
      const textRes = await enginePost(`/sessions/${sid}/execute`, {
        action_type: "extract_text",
        selector: "body",
      }, requestId);
      r.extractedText = (textRes.data || "").slice(0, 800);
      r.textLength = (textRes.data || "").length;

      // 6. For HN — extract top 5 stories (structured extraction proof)
      if (site.type === "news") {
        const storiesRes = await enginePost(`/sessions/${sid}/execute`, {
          action_type: "evaluate",
          value: `(() => {
            const items = document.querySelectorAll('.athing');
            const out = [];
            for (let i = 0; i < Math.min(5, items.length); i++) {
              const a = items[i].querySelector('.titleline > a');
              out.push({ rank: i + 1, title: a ? a.textContent.trim() : '', url: a ? a.href : '' });
            }
            return JSON.stringify(out);
          })()`,
        }, requestId);
        try { r.stories = JSON.parse(storiesRes.data || "[]"); } catch { r.stories = []; }
      }

      r.success = true;

      // Cleanup
      try { await engineDelete(`/sessions/${sid}`, requestId); } catch {}
    } catch (e) {
      r.success = false;
      r.error = e.message;
    }
    results.push(r);
  }

  return Response.json({
    ok: true,
    results,
    timestamp: new Date().toISOString(),
    engineReachable: results.some((r) => r.success),
  });
}