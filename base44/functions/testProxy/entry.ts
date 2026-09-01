import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { decrypt } from "../../shared/crypto.ts";
import { engineFetch, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { logAudit } from "../../shared/auditLogger.ts";

// ═══════════════════════════════════════════════
// testProxy — Creates a temporary engine session with the proxy,
// navigates to an IP-check endpoint, and returns the exit IP + latency.
// Proves the proxy is alive and shows its egress IP.
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { proxyId } = body;

    if (!proxyId) return Response.json({ error: "proxyId required" }, { status: 400 });

    if (!await isEngineConfigured()) {
      return Response.json({ error: "Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Settings → Secrets." }, { status: 503 });
    }

    const proxy = await base44.asServiceRole.entities.Proxy.get(proxyId);
    if (!proxy) return Response.json({ error: "Proxy not found" }, { status: 404 });

    // Decrypt password for the engine
    let password = "";
    if (proxy.password_encrypted) {
      password = await decrypt(proxy.password_encrypted) || "";
    }

    const proxyConfig: Record<string, string> = { server: proxy.server };
    if (proxy.username) proxyConfig.username = proxy.username;
    if (password) proxyConfig.password = password;

    const startedAt = Date.now();

    // 1. Create session with the proxy
    let session;
    try {
      session = await engineFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({ proxy: proxyConfig, usePool: false }),
      });
    } catch (e) {
      return Response.json({
        ok: false,
        proxy: { name: proxy.name, server: proxy.server },
        error: `Engine refused session: ${e.message}`,
        latency_ms: Date.now() - startedAt,
      });
    }

    if (!session.sessionId) {
      return Response.json({
        ok: false,
        proxy: { name: proxy.name, server: proxy.server },
        error: "Engine did not return a session ID",
        latency_ms: Date.now() - startedAt,
      });
    }

    // 2. Navigate to IP-check endpoint
    let exitIp = null;
    let navError = null;
    try {
      await engineFetch(`/sessions/${session.sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          action_type: "goto",
          value: "https://api.ipify.org?format=json",
          options: { timeout: 20000 },
        }),
      });

      // 3. Extract the IP from the page body
      const extractRes = await engineFetch(`/sessions/${session.sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "extract_text", selector: "body" }),
      });
      const text = extractRes.data || extractRes.text || JSON.stringify(extractRes);
      const match = (typeof text === "string" ? text : JSON.stringify(text)).match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      exitIp = match ? match[1] : null;
    } catch (e) {
      navError = e.message;
    }

    const latency_ms = Date.now() - startedAt;

    // 4. Cleanup session
    await engineFetch(`/sessions/${session.sessionId}`, { method: "DELETE" }).catch(() => {});

    await logAudit(base44, user, "test", "proxy", proxy.id, `Proxy "${proxy.name}" tested — ${exitIp ? "OK" : "FAILED"}`);

    return Response.json({
      ok: !!exitIp,
      proxy: { name: proxy.name, server: proxy.server, country: proxy.country, protocol: proxy.protocol },
      exit_ip: exitIp,
      latency_ms,
      error: navError,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}