import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { setEngineClient, engineFetch, isEngineConfigured } from "../../shared/engineClient.ts";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { image_url, replication_id, max_iterations, target_parity, page_name } = body;

    if (!image_url && !replication_id) {
      return Response.json({ error: "image_url or replication_id required" }, { status: 400 });
    }

    // Load or create replication record
    let replication;
    if (replication_id) {
      replication = await base44.entities.ImageReplication.get(replication_id);
      if (!replication) return Response.json({ error: "Replication not found" }, { status: 404 });
    } else {
      replication = await base44.entities.ImageReplication.create({
        source_image_url: image_url,
        page_name: page_name || "Replicated Page",
        status: "generating",
        max_iterations: max_iterations || 5,
        target_parity: target_parity || 99,
        parity_score: 0,
        iteration_count: 0,
        iterations: [],
      });
    }

    const maxIter = replication.max_iterations || 5;
    const targetP = replication.target_parity || 99;
    const iterations = replication.iterations || [];
    let currentHtml = replication.generated_html || "";
    let currentScore = replication.parity_score || 0;
    const engineReady = await isEngineConfigured().catch(() => false);

    for (let i = replication.iteration_count || 0; i < maxIter; i++) {
      await base44.entities.ImageReplication.update(replication.id, {
        status: i === 0 ? "generating" : "iterating",
      });

      // ── Step 1: Generate HTML from image ──
      const prevDiff = i > 0 && iterations[i - 1] ? iterations[i - 1].diff_summary : null;

      const genPrompt = prevDiff
        ? `You are a pixel-perfect frontend developer. Your previous attempt scored ${iterations[i - 1].score}% visual parity. Fix these specific issues:

${prevDiff}

Regenerate the COMPLETE standalone HTML page to fix every issue listed above. The page must replicate the reference image as closely as possible.

Rules:
- Complete HTML document (<!DOCTYPE html> through </html>)
- ALL CSS inline in a <style> tag — no external stylesheets, no Tailwind, no frameworks
- Exact hex colors, font families, font sizes, font weights, letter-spacing, line-height
- Exact layout: flexbox or grid matching the image structure
- All text content exactly as shown in the image
- Background effects, gradients, glows, shadows — replicate them with CSS
- For images/logos in the design, use CSS effects or placeholder image URLs
- Responsive design
- Return ONLY raw HTML, no markdown, no explanation`
        : `You are a pixel-perfect frontend developer. Analyze this reference design image and generate a COMPLETE standalone HTML page that replicates it pixel-by-pixel.

Rules:
- Complete HTML document (<!DOCTYPE html> through </html>)
- ALL CSS inline in a <style> tag — no external stylesheets, no Tailwind, no frameworks
- Exact hex colors, font families, font sizes, font weights, letter-spacing, line-height
- Exact layout: flexbox or grid matching the image structure
- All text content exactly as shown in the image
- Background effects, gradients, glows, shadows — replicate them with CSS
- For images/logos in the design, use CSS effects or placeholder image URLs
- Responsive design
- Return ONLY raw HTML, no markdown, no explanation`;

      const genResult = await base44.integrations.Core.InvokeLLM({
        prompt: genPrompt,
        file_urls: [replication.source_image_url],
      });

      let html = typeof genResult === "string" ? genResult : (genResult.content || genResult.html || "");
      // Strip markdown code fences
      html = html.replace(/^```html?\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      // Find the start of the HTML document
      const docIdx = html.toLowerCase().indexOf("<!doctype");
      if (docIdx > 0) html = html.slice(docIdx);
      else if (docIdx < 0) {
        const htmlIdx = html.toLowerCase().indexOf("<html");
        if (htmlIdx > 0) html = html.slice(htmlIdx);
      }
      currentHtml = html;

      await base44.entities.ImageReplication.update(replication.id, {
        generated_html: html,
        status: "validating",
      });

      // ── Step 2: Render + screenshot via browser engine ──
      let screenshotUrl = null;

      if (engineReady && html.length > 50) {
        try {
          // Upload HTML as a public file so the engine can navigate to it
          const htmlFile = new File([html], "replica.html", { type: "text/html" });
          const htmlUpload = await base44.integrations.Core.UploadPublicFile({ file: htmlFile });
          const htmlUrl = htmlUpload.file_url;

          await base44.entities.ImageReplication.update(replication.id, { html_url: htmlUrl });

          // Create engine session
          const sessionRes = await engineFetch("/sessions", {
            method: "POST",
            body: JSON.stringify({ viewport: { width: 1280, height: 800 } }),
          });

          // Navigate to the HTML file
          await engineFetch(`/sessions/${sessionRes.sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({
              action_type: "goto",
              value: htmlUrl,
              options: { waitUntil: "networkidle", timeout: 30000 },
            }),
          });

          // Take full-page screenshot
          const ssRes = await engineFetch(`/sessions/${sessionRes.sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "screenshot", options: { fullPage: true } }),
          });

          // Close session
          await engineFetch(`/sessions/${sessionRes.sessionId}`, { method: "DELETE" }).catch(() => {});

          // Upload screenshot
          if (ssRes.base64) {
            const binary = atob(ssRes.base64);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
            const ssFile = new File([bytes], "replica-screenshot.png", { type: "image/png" });
            const ssUpload = await base44.integrations.Core.UploadPublicFile({ file: ssFile });
            screenshotUrl = ssUpload.file_url;
          }
        } catch (e) {
          console.error("Screenshot cycle failed:", e.message);
        }
      }

      // ── Step 3: Compare screenshot to original ──
      let parityScore = 0;
      let diffSummary = "";
      let diffRegions = [];

      if (screenshotUrl) {
        // Vision LLM compares the rendered screenshot to the original image
        const compareResult = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a visual QA engineer. Compare these two images precisely.

Image 1: The original reference design.
Image 2: A screenshot of the generated HTML page.

Score the visual parity from 0 to 100 (100 = pixel-perfect identical).
List every specific difference you can see — colors, spacing, fonts, layout, alignment, missing elements, sizing.

Be strict and precise. Focus on pixel-level differences.`,
          file_urls: [replication.source_image_url, screenshotUrl],
          response_json_schema: {
            type: "object",
            properties: {
              parity_score: { type: "number" },
              diff_summary: { type: "string" },
              diff_regions: { type: "array", items: { "type": "string" } },
            },
          },
        });

        parityScore = compareResult.parity_score || 0;
        diffSummary = compareResult.diff_summary || "";
        diffRegions = compareResult.diff_regions || [];
      } else {
        // Fallback: LLM self-assessment without rendered screenshot
        const selfAssess = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a visual QA engineer. You generated HTML to replicate this reference design image. Without a rendered screenshot, estimate how close your HTML would be to the original. Score 0-100 and list likely differences.

The HTML you generated:
${html.slice(0, 5000)}`,
          file_urls: [replication.source_image_url],
          response_json_schema: {
            type: "object",
            properties: {
              parity_score: { type: "number" },
              diff_summary: { type: "string" },
              diff_regions: { type: "array", items: { "type": "string" } },
            },
          },
        });
        parityScore = selfAssess.parity_score || 0;
        diffSummary = selfAssess.diff_summary || "";
        diffRegions = selfAssess.diff_regions || [];
      }

      currentScore = parityScore;
      iterations.push({
        iteration: i + 1,
        score: parityScore,
        diff_summary: diffSummary,
        diff_regions: diffRegions,
      });

      await base44.entities.ImageReplication.update(replication.id, {
        parity_score: parityScore,
        screenshot_url: screenshotUrl,
        iteration_count: i + 1,
        iterations,
      });

      if (parityScore >= targetP) break;
    }

    // ── Step 4: Convert HTML to JSX for operational parity ──
    await base44.entities.ImageReplication.update(replication.id, { status: "complete" });

    const jsxResult = await base44.integrations.Core.InvokeLLM({
      prompt: `Convert this HTML into a production React component (JSX) that achieves 100% operational parity.

Requirements:
- Export default function component
- Use Tailwind CSS classes (the app uses Tailwind) — convert inline CSS to Tailwind classes where possible
- For complex styles that can't be expressed in Tailwind, use a <style> tag or style attributes
- Use Link from "react-router-dom" for any navigation links (import { Link } from "react-router-dom")
- Add useState for any interactive elements (dropdowns, tabs, mobile menus)
- Keep all text content exactly as in the HTML
- Preserve all visual styling — colors, fonts, spacing, effects
- Make it fully responsive
- Return ONLY the JSX code, no markdown fences, no explanation

HTML to convert:
${currentHtml}`,
    });

    let jsx = typeof jsxResult === "string" ? jsxResult : (jsxResult.content || "");
    jsx = jsx.replace(/^```jsx?\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    await base44.entities.ImageReplication.update(replication.id, {
      generated_jsx: jsx,
      status: "complete",
    });

    const final = await base44.entities.ImageReplication.get(replication.id);
    return Response.json({ ok: true, replication: final });
  } catch (error) {
    console.error("replicateImageToCode error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}