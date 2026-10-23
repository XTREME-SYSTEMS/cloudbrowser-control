// ═══════════════════════════════════════════════
// Desktop Commander Remote MCP — OAuth 2.0 authorization
//
// The device endpoint is a hosted MCP server that relays to the operator's own
// computer. It authenticates with OAuth 2.0 (authorization code + PKCE, refresh
// tokens supported) and publishes its own authorization server, so the client is
// registered dynamically at connect time rather than configured by hand.
//
// Only the endpoint constants live here. Nothing in this module stores or logs a
// token — the caller decides how it is kept.
// ═══════════════════════════════════════════════

export const MCP_ENDPOINT = "https://mcp.desktopcommander.app/mcp";
export const AUTH_SERVER = "https://mcp.desktopcommander.app";
export const OAUTH_SCOPE = "mcp:tools desktop:auth";

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A PKCE verifier and its S256 challenge. */
export async function createPkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(digest) };
}

export function createState() {
  return base64url(crypto.getRandomValues(new Uint8Array(24)));
}

/** Register this app as its own OAuth client against the device's authorization server. */
export async function registerClient(callbackUrl) {
  const res = await fetch(`${AUTH_SERVER}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "CloudBrowser Autonomous Agent",
      redirect_uris: [callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPE,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Could not register with the device service (${res.status}): ${detail.slice(0, 300)}`);
  }
  return await res.json();
}

/** The URL the operator opens once to pair their machine. */
export function buildAuthorizeUrl({ clientId, callbackUrl, state, challenge }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: OAUTH_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: AUTH_SERVER,
  });
  return `${AUTH_SERVER}/authorize?${params.toString()}`;
}

async function tokenRequest(form) {
  const res = await fetch(`${AUTH_SERVER}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description || body.error || `Authorization server returned ${res.status}`);
  }
  return body;
}

/** Swap the one-time code for tokens. */
export async function exchangeCode({ code, verifier, clientId, clientSecret, callbackUrl }) {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    client_id: clientId,
    code_verifier: verifier,
  });
  if (clientSecret) form.set("client_secret", clientSecret);
  return await tokenRequest(form);
}

/** Renew the grant without the operator having to pair again. */
export async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) form.set("client_secret", clientSecret);
  return await tokenRequest(form);
}

/** When the access token stops being valid, in ISO form. */
export function expiryFrom(tokens) {
  const seconds = Number(tokens.expires_in) || 0;
  return new Date(Date.now() + Math.max(seconds - 60, 60) * 1000).toISOString();
}