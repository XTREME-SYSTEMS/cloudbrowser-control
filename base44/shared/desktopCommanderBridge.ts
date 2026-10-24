import { encrypt, decrypt } from "./crypto.ts";
import { callMcpTool, listMcpTools } from "./mcpClient.ts";
import { MCP_ENDPOINT, refreshAccessToken, expiryFrom } from "./desktopCommanderAuth.ts";

// The device half of the Desktop Commander bridge, extracted so more than one
// function can reach the operator's paired machine without a second copy of the
// grant handling. desktopCommander serves the pairing and manual calls; the
// OpenClaw cycle reads that machine and, with approval, repairs it.

export function reauth(message) {
  const error = new Error(message);
  error.needsReauth = true;
  return error;
}

export async function currentConnection(base44) {
  const page = await base44.entities.DesktopConnection.filter({}, { sort: "-created_date", limit: 1 });
  return page.items?.[0] || null;
}

/** Never hand credentials back to a caller — only what the operator needs to see. */
export function publicView(connection) {
  if (!connection) return { connected: false, status: "none", tools: [], tool_count: 0 };
  return {
    connected: connection.status === "connected",
    status: connection.status,
    device_name: connection.device_name || null,
    account_email: connection.account_email || null,
    scopes: connection.scopes || null,
    connected_at: connection.connected_at || null,
    last_used_at: connection.last_used_at || null,
    last_error: connection.last_error || null,
    tool_count: connection.tool_count || 0,
    tools: (connection.tools || []).map((tool) => ({ name: tool.name, description: tool.description })),
  };
}

/** A live access token, renewed from the stored grant when it has aged out. */
export async function liveAccessToken(base44, connection) {
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const existing = await decrypt(connection.access_token_enc);
  if (existing && expiresAt > Date.now()) return existing;

  const refresh = await decrypt(connection.refresh_token_enc);
  if (!refresh) throw reauth("This device has no stored grant left. Pair it again.");

  try {
    const tokens = await refreshAccessToken({
      refreshToken: refresh,
      clientId: connection.client_id,
      clientSecret: await decrypt(connection.client_secret_enc),
    });
    await base44.entities.DesktopConnection.update(connection.id, {
      access_token_enc: await encrypt(tokens.access_token),
      refresh_token_enc: await encrypt(tokens.refresh_token || refresh),
      expires_at: expiryFrom(tokens),
      status: "connected",
      last_error: "",
    });
    return tokens.access_token;
  } catch (error) {
    await base44.entities.DesktopConnection.update(connection.id, {
      status: "needs_reauth",
      last_error: error.message,
    });
    throw reauth(`The device grant could not be renewed (${error.message}). Pair it again.`);
  }
}

/** Is a machine paired and usable right now, without touching it? */
export async function deviceStatus(base44) {
  const view = publicView(await currentConnection(base44));
  return { ...view, paired: view.status !== "none", ready: view.connected };
}

function textOf(result) {
  if (Array.isArray(result)) return result.map((part) => part?.text || "").join("\n");
  if (typeof result === "string") return result;
  return result ? JSON.stringify(result) : "";
}

export async function callDeviceTool(base44, tool, args = {}) {
  const connection = await currentConnection(base44);
  if (!connection || connection.status === "pending") {
    const error = new Error("No device is paired yet. Pair one first.");
    error.needsPairing = true;
    throw error;
  }
  const token = await liveAccessToken(base44, connection);
  const result = await callMcpTool(MCP_ENDPOINT, token, tool, args);
  await base44.entities.DesktopConnection.update(connection.id, {
    last_used_at: new Date().toISOString(),
    last_error: "",
  });
  return {
    ok: !result?.isError,
    text: textOf(result?.content ?? result),
    is_error: Boolean(result?.isError),
    device_name: connection.device_name || null,
  };
}

const CALL_ID = /call_id="([^"]+)"/;
const PID = /Process started with PID\s+(\d+)/;
const DEVICE_IN_TEXT = /executed on device:\s*([^\]()\[]+)/i;
const COMPLETE = /## DONE/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deviceFrom(text, fallback) {
  const match = String(text || "").match(DEVICE_IN_TEXT);
  return (match ? match[1] : fallback || "").trim() || null;
}

/**
 * Run one shell command on the paired machine and collect its whole output.
 *
 * A command that outlives the device's bounded synchronous wait comes back as a
 * call id instead of an answer, and the two shapes of collection are not the same:
 * a process is read back through read_process_output by its pid, while a plain call
 * is read through get_tool_result by its call id — and for a process that call only
 * reports status, which is how a working machine can read as empty.
 *
 * Completeness is decided by the command's own end marker and nothing else. A
 * partial reading stays visibly partial, because a half-read machine looks exactly
 * like a broken one, and that mistake would restart something that was fine.
 */
export async function runDeviceCommand(base44, command, { timeoutMs = 25000, polls = 10 } = {}) {
  const first = await callDeviceTool(base44, "start_process", { command, timeout_ms: timeoutMs });
  let text = first.text;
  const deviceName = deviceFrom(text, first.device_name);

  if (COMPLETE.test(text)) return { ok: first.ok, text, partial: false, device_name: deviceName };

  const pid = (text.match(PID) || [])[1];
  const callId = (text.match(CALL_ID) || [])[1];

  for (let i = 0; i < polls && !COMPLETE.test(text); i++) {
    await sleep(1200);
    let more = "";
    try {
      if (pid) {
        more = (await callDeviceTool(base44, "read_process_output", { pid })).text;
      } else if (callId) {
        more = (await callDeviceTool(base44, "get_tool_result", { call_id: callId })).text;
      } else {
        break;
      }
    } catch {
      break;
    }
    if (!more.trim()) continue;
    if (more.includes(text.trim())) text = more;
    else if (!text.includes(more.trim())) text = `${text}\n${more}`;
  }

  return {
    ok: first.ok && !/command not found|Permission denied/i.test(text),
    text,
    partial: !COMPLETE.test(text),
    device_name: deviceName,
  };
}

export { listMcpTools };