import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
// LLM Vision CAPTCHA Solver — uses Claude Sonnet 4.6 vision to solve CAPTCHAs
// Input: { sessionId, screenshotUrl, captchaType }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const { sessionId, screenshotUrl, captchaType } = body;

    if (!screenshotUrl && !sessionId) {
      return Response.json({ error: "Either screenshotUrl or sessionId is required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    }

    let imageUrl = screenshotUrl;

    // If no screenshot URL provided, take one from the engine session
    if (!imageUrl && sessionId) {
      const screenshotRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "screenshot", options: { fullPage: false } }),
      });

      if (!screenshotRes.base64) {
        return Response.json({ error: "Failed to capture screenshot", __v: DEPLOYMENT_VERSION }, { status: 500 });
      }

      const file = new File(
        [Uint8Array.from(atob(screenshotRes.base64), (c) => c.charCodeAt(0))],
        `captcha_${Date.now()}.png`,
        { type: "image/png" }
      );
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      imageUrl = uploadRes.file_url;
    }

    // Call LLM with vision to analyze the CAPTCHA
    const llmRes = await base44.integrations.Core.InvokeLLM({
      model: "claude_sonnet_4_6",
      file_urls: [imageUrl],
      prompt: "Analyze this CAPTCHA challenge image. Identify the challenge type and provide the solution. For image grid challenges, return the labels/coordinates of correct selections. For slider challenges, return the drag distance. For text challenges, return the text. Return JSON with {solution, confidence, type}.",
      response_json_schema: {
        type: "object",
        properties: {
          solution: { type: "string" },
          confidence: { type: "number" },
          type: { type: "string" },
        },
      },
    });

    const solved = (llmRes?.confidence || 0) > 0.5;

    // Log the solve attempt
    try {
      await base44.asServiceRole.entities.CaptchaSolveLog.create({
        session_id: sessionId || "standalone",
        url: "",
        captcha_type: captchaType || llmRes?.type || "unknown",
        provider: "llm_vision",
        solved,
        solve_time_ms: 0,
        cost_cents: 0,
        error_message: solved ? null : "Low confidence from vision solver",
        metadata: { confidence: llmRes?.confidence, type: llmRes?.type, solution: llmRes?.solution },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("CaptchaSolveLog creation failed:", e.message);
    }

    return Response.json({
      ok: true,
      solved,
      solution: llmRes?.solution,
      confidence: llmRes?.confidence,
      type: llmRes?.type || captchaType,
      screenshot_url: imageUrl,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
