import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const CHATGPT_CLIENT_ID = "https://chatgpt.com/oauth/client.json";
export const CHATGPT_REDIRECT_URI = "https://chatgpt.com/connector_platform_oauth_redirect";
export const OAUTH_SCOPE = "browser:use";

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}
function parseJsonB64(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}
function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
function scopeSet(value) {
  return new Set(String(value || "").split(/\s+/).filter(Boolean));
}
function validChallenge(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

export function createOAuthManager({ issuer, signingSeed, setupUntil }) {
  const normalizedIssuer = String(issuer || "").replace(/\/$/, "");
  const configured = /^https:\/\//.test(normalizedIssuer) && String(signingSeed || "").length >= 24;
  const resource = configured ? normalizedIssuer + "/mcp" : "";
  const key = configured
    ? createHmac("sha256", String(signingSeed)).update("xtreme-cloud-browser-oauth-signing-v1").digest()
    : null;

  function sign(payload) {
    if (!configured) throw new Error("OAuth is not configured");
    const body = b64url(JSON.stringify({ v:1, iss:normalizedIssuer, ...payload }));
    const sig = createHmac("sha256", key).update(body).digest("base64url");
    return "cb1." + body + "." + sig;
  }

  function verify(token, expectedType) {
    if (!configured || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "cb1") return null;
    const expected = createHmac("sha256", key).update(parts[1]).digest("base64url");
    if (!safeEqual(parts[2], expected)) return null;
    let payload;
    try { payload = parseJsonB64(parts[1]); } catch { return null; }
    if (payload.v !== 1 || payload.iss !== normalizedIssuer || payload.typ !== expectedType) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds()) return null;
    return payload;
  }

  function setupOpen() {
    if (!configured || !setupUntil) return false;
    const until = Date.parse(setupUntil);
    return Number.isFinite(until) && Date.now() < until;
  }

  function validateAuthorization(params) {
    if (!configured) return { ok:false, status:503, error:"oauth_not_configured" };
    if (!setupOpen()) return { ok:false, status:403, error:"authorization_window_closed" };
    if (params.get("response_type") !== "code") return { ok:false, status:400, error:"unsupported_response_type" };
    if (params.get("client_id") !== CHATGPT_CLIENT_ID) return { ok:false, status:400, error:"invalid_client" };
    if (params.get("redirect_uri") !== CHATGPT_REDIRECT_URI) return { ok:false, status:400, error:"invalid_redirect_uri" };
    if (params.get("code_challenge_method") !== "S256") return { ok:false, status:400, error:"invalid_request" };
    const challenge = params.get("code_challenge");
    if (!validChallenge(challenge)) return { ok:false, status:400, error:"invalid_request" };
    const requestedResource = params.get("resource");
    if (requestedResource && requestedResource !== resource) return { ok:false, status:400, error:"invalid_target" };
    const scopes = scopeSet(params.get("scope") || OAUTH_SCOPE);
    if (!scopes.has(OAUTH_SCOPE)) return { ok:false, status:400, error:"invalid_scope" };
    return {
      ok:true,
      clientId:CHATGPT_CLIENT_ID,
      redirectUri:CHATGPT_REDIRECT_URI,
      challenge,
      state:params.get("state") || "",
      scope:OAUTH_SCOPE,
      resource
    };
  }

  function authorizationPage(params) {
    const checked = validateAuthorization(params);
    if (!checked.ok) {
      return { status:checked.status, body:"<!doctype html><meta charset=utf-8><title>Cloud Browser authorization unavailable</title><h1>Authorization unavailable</h1><p>" + htmlEscape(checked.error) + "</p>" };
    }
    const fields = ["response_type","client_id","redirect_uri","code_challenge","code_challenge_method","state","scope","resource"]
      .map(name => '<input type="hidden" name="' + name + '" value="' + htmlEscape(params.get(name) || "") + '">').join("");
    return {
      status:200,
      body:'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Authorize Xtreme Cloud Browser</title><main style="font:16px system-ui;max-width:640px;margin:64px auto;padding:24px"><h1>Authorize Xtreme Cloud Browser</h1><p>This one-time administrator approval connects this ChatGPT workspace to the clean Cloud Browser MCP gateway.</p><form method="post" action="/oauth/authorize">' + fields + '<input type="hidden" name="approve" value="yes"><button type="submit" style="font:inherit;padding:12px 18px">Authorize Cloud Browser</button></form></main>'
    };
  }

  function approveAuthorization(params) {
    const checked = validateAuthorization(params);
    if (!checked.ok) return checked;
    if (params.get("approve") !== "yes") return { ok:false, status:403, error:"access_denied" };
    const code = sign({
      typ:"code",
      aud:resource,
      cid:checked.clientId,
      ru:checked.redirectUri,
      cc:checked.challenge,
      scope:checked.scope,
      exp:nowSeconds() + 300
    });
    const location = new URL(checked.redirectUri);
    location.searchParams.set("code", code);
    if (checked.state) location.searchParams.set("state", checked.state);
    location.searchParams.set("iss", normalizedIssuer);
    return { ok:true, status:302, location:location.toString() };
  }

  function issueTokens(params) {
    if (!configured) return { ok:false, status:503, error:"oauth_not_configured" };
    const grant = params.get("grant_type");
    const clientId = params.get("client_id");
    if (clientId !== CHATGPT_CLIENT_ID) return { ok:false, status:401, error:"invalid_client" };

    let scope = OAUTH_SCOPE;
    if (grant === "authorization_code") {
      const payload = verify(params.get("code"), "code");
      if (!payload) return { ok:false, status:400, error:"invalid_grant" };
      if (payload.cid !== clientId || payload.ru !== params.get("redirect_uri") || payload.aud !== resource) {
        return { ok:false, status:400, error:"invalid_grant" };
      }
      const verifier = params.get("code_verifier") || "";
      if (verifier.length < 43 || verifier.length > 128) return { ok:false, status:400, error:"invalid_grant" };
      const actual = createHash("sha256").update(verifier).digest("base64url");
      if (!safeEqual(actual, payload.cc)) return { ok:false, status:400, error:"invalid_grant" };
      const requestedResource = params.get("resource");
      if (requestedResource && requestedResource !== resource) return { ok:false, status:400, error:"invalid_target" };
      scope = payload.scope || OAUTH_SCOPE;
    } else if (grant === "refresh_token") {
      const payload = verify(params.get("refresh_token"), "refresh");
      if (!payload || payload.cid !== clientId || payload.aud !== resource) return { ok:false, status:400, error:"invalid_grant" };
      scope = payload.scope || OAUTH_SCOPE;
    } else {
      return { ok:false, status:400, error:"unsupported_grant_type" };
    }

    const accessToken = sign({ typ:"access", aud:resource, cid:clientId, scope, exp:nowSeconds() + 3600 });
    const refreshToken = sign({ typ:"refresh", aud:resource, cid:clientId, scope, exp:nowSeconds() + 2592000 });
    return {
      ok:true,
      status:200,
      body:{ token_type:"Bearer", access_token:accessToken, expires_in:3600, refresh_token:refreshToken, scope }
    };
  }

  function accessAuthorized(headerValue) {
    if (!configured || typeof headerValue !== "string") return false;
    const match = headerValue.match(/^Bearer\s+(.+)$/i);
    if (!match) return false;
    const payload = verify(match[1].trim(), "access");
    return !!payload && payload.aud === resource && scopeSet(payload.scope).has(OAUTH_SCOPE);
  }

  return {
    configured,
    issuer:normalizedIssuer,
    resource,
    scope:OAUTH_SCOPE,
    setupOpen,
    accessAuthorized,
    authorizationPage,
    approveAuthorization,
    issueTokens,
    resourceMetadata:() => ({
      resource,
      authorization_servers:[normalizedIssuer],
      scopes_supported:[OAUTH_SCOPE],
      resource_documentation:normalizedIssuer + "/healthz"
    }),
    authorizationServerMetadata:() => ({
      issuer:normalizedIssuer,
      authorization_endpoint:normalizedIssuer + "/oauth/authorize",
      token_endpoint:normalizedIssuer + "/oauth/token",
      response_types_supported:["code"],
      grant_types_supported:["authorization_code","refresh_token"],
      code_challenge_methods_supported:["S256"],
      token_endpoint_auth_methods_supported:["none"],
      scopes_supported:[OAUTH_SCOPE],
      client_id_metadata_document_supported:true,
      authorization_response_iss_parameter_supported:true
    })
  };
}
