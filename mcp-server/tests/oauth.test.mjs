import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOAuthManager, CHATGPT_CLIENT_ID, CHATGPT_REDIRECT_URI, OAUTH_SCOPE } from "../src/oauth.mjs";

const issuer = "https://browser.example.test";
const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~";
const challenge = createHash("sha256").update(verifier).digest("base64url");

function manager() {
  return createOAuthManager({
    issuer,
    signingSeed:"12345678901234567890123456789012",
    setupUntil:new Date(Date.now() + 60000).toISOString()
  });
}
function authParams() {
  return new URLSearchParams({
    response_type:"code",
    client_id:CHATGPT_CLIENT_ID,
    redirect_uri:CHATGPT_REDIRECT_URI,
    code_challenge:challenge,
    code_challenge_method:"S256",
    state:"state-1",
    scope:OAUTH_SCOPE,
    resource:issuer + "/mcp",
    approve:"yes"
  });
}

test("OAuth metadata advertises ChatGPT-compatible PKCE flow", () => {
  const oauth = manager();
  assert.equal(oauth.configured, true);
  assert.equal(oauth.resourceMetadata().resource, issuer + "/mcp");
  assert.equal(oauth.authorizationServerMetadata().client_id_metadata_document_supported, true);
  assert.deepEqual(oauth.authorizationServerMetadata().code_challenge_methods_supported, ["S256"]);
});

test("authorization code exchanges for access and refresh tokens", () => {
  const oauth = manager();
  const approved = oauth.approveAuthorization(authParams());
  assert.equal(approved.ok, true);
  const code = new URL(approved.location).searchParams.get("code");
  const token = oauth.issueTokens(new URLSearchParams({
    grant_type:"authorization_code",
    client_id:CHATGPT_CLIENT_ID,
    redirect_uri:CHATGPT_REDIRECT_URI,
    code_verifier:verifier,
    resource:issuer + "/mcp",
    code
  }));
  assert.equal(token.ok, true);
  assert.equal(token.body.token_type, "Bearer");
  assert.equal(oauth.accessAuthorized("Bearer " + token.body.access_token), true);
  const refreshed = oauth.issueTokens(new URLSearchParams({
    grant_type:"refresh_token",
    client_id:CHATGPT_CLIENT_ID,
    refresh_token:token.body.refresh_token
  }));
  assert.equal(refreshed.ok, true);
  assert.equal(oauth.accessAuthorized("Bearer " + refreshed.body.access_token), true);
});

test("OAuth rejects wrong client, callback, PKCE and closed window", () => {
  const oauth = manager();
  const wrongClient = authParams();
  wrongClient.set("client_id","https://evil.example/client");
  assert.equal(oauth.approveAuthorization(wrongClient).ok, false);
  const approved = oauth.approveAuthorization(authParams());
  const code = new URL(approved.location).searchParams.get("code");
  const badPkce = oauth.issueTokens(new URLSearchParams({
    grant_type:"authorization_code",
    client_id:CHATGPT_CLIENT_ID,
    redirect_uri:CHATGPT_REDIRECT_URI,
    code_verifier:"x".repeat(64),
    code
  }));
  assert.equal(badPkce.ok, false);
  const closed = createOAuthManager({
    issuer,
    signingSeed:"12345678901234567890123456789012",
    setupUntil:new Date(Date.now() - 1000).toISOString()
  });
  assert.equal(closed.approveAuthorization(authParams()).error, "authorization_window_closed");
});
