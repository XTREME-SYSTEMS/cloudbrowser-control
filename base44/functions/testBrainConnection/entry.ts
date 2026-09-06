import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// Tests the bi-directional connection to the Brain (V-1) by pinging its /functions/brainHealth endpoint.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const brainUrl = secrets.get("VISION_CORTEX_BRAIN_URL");
  const brainKey = secrets.get("VISION_CORTEX_BRAIN_API_KEY");
  const inboundKey = secrets.get("VISION_CORTEX_INBOUND_API_KEY");

  const config = {
    brain_url_set: !!brainUrl,
    brain_key_set: !!brainKey,
    inbound_key_set: !!inboundKey,
    eyes_endpoint: "https://cloud-browser.base44.app/functions/receiveBrainCommand",
  };

  if (!brainUrl || !brainKey) {
    return Response.json({ ok: false, configured: false, config, error: "Set VISION_CORTEX_BRAIN_URL and VISION_CORTEX_BRAIN_API_KEY", __v: DEPLOYMENT_VERSION });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();
  try {
    const res = await fetch(`${brainUrl.replace(/\/$/, "")}/functions/brainHealth`, {
      headers: { "x-eyes-api-key": brainKey },
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }

    return Response.json({
      ok: res.ok,
      configured: true,
      config,
      brain_status: res.status,
      brain_response: body,
      response_time_ms: Date.now() - startedAt,
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  } catch (err) {
    return Response.json({
      ok: false,
      configured: true,
      config,
      error: err.name === "AbortError" ? "Timeout" : err.message,
      response_time_ms: Date.now() - startedAt,
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  } finally {
    clearTimeout(timer);
  }
}