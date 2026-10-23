// ═══════════════════════════════════════════════
// MCP client — Streamable HTTP transport
//
// Speaks JSON-RPC 2.0 to any remote MCP server. The server may answer a request
// either as a single JSON body or as a server-sent event stream, so both are
// read here. A session id handed back on initialise is echoed on the follow-up
// calls, because the transport allows a server to require it.
//
// Nothing here is Desktop-Commander specific: it takes an endpoint and a bearer
// token, so another remote MCP server can be bridged with the same module.
// ═══════════════════════════════════════════════

export const MCP_PROTOCOL_VERSION = "2025-06-18";

/** Pull the JSON-RPC messages out of an SSE body and return the one we asked for. */
function readSseEvents(raw, wantedId) {
  const events = [];
  let data = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""));
    } else if (line.trim() === "" && data.length) {
      try {
        events.push(JSON.parse(data.join("\n")));
      } catch {
        // A partial or non-JSON event is not fatal — other events may carry our reply.
      }
      data = [];
    }
  }
  if (data.length) {
    try {
      events.push(JSON.parse(data.join("\n")));
    } catch {
      // same
    }
  }
  const matched = wantedId === undefined ? null : events.find((event) => event.id === wantedId);
  return matched || events[events.length - 1] || null;
}

async function rpc(endpoint, token, payload, sessionId) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000),
  });

  const nextSession = res.headers.get("mcp-session-id") || sessionId;

  if (res.status === 401 || res.status === 403) {
    const error = new Error("The device refused this connection's credentials.");
    error.needsReauth = true;
    throw error;
  }
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Device endpoint returned ${res.status}: ${detail.slice(0, 300)}`);
  }

  const raw = await res.text();
  // A notification is acknowledged with no body at all.
  if (!raw.trim()) return { result: null, sessionId: nextSession };

  const contentType = res.headers.get("content-type") || "";
  const message = contentType.includes("text/event-stream")
    ? readSseEvents(raw, payload.id)
    : JSON.parse(raw);

  if (!message) throw new Error("The device endpoint sent no readable reply.");
  if (message.error) throw new Error(message.error.message || "The device reported an error.");
  return { result: message.result, sessionId: nextSession };
}

/** Initialise a session, hand the follow-up work its session id, then close nothing — the transport is stateless per call. */
async function withSession(endpoint, token, work) {
  const init = await rpc(
    endpoint,
    token,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "cloudbrowser-agent", version: "1.0.0" },
      },
    },
    null
  );
  await rpc(endpoint, token, { jsonrpc: "2.0", method: "notifications/initialized" }, init.sessionId).catch(() => {});
  return await work(init.sessionId);
}

/** Every tool the device advertises, in the device's own words. */
export async function listMcpTools(endpoint, token) {
  return await withSession(endpoint, token, async (sessionId) => {
    const { result } = await rpc(endpoint, token, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, sessionId);
    return result?.tools || [];
  });
}

/** Run one tool by the name the device advertised. */
export async function callMcpTool(endpoint, token, name, args) {
  return await withSession(endpoint, token, async (sessionId) => {
    const { result } = await rpc(
      endpoint,
      token,
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args || {} } },
      sessionId
    );
    return result;
  });
}