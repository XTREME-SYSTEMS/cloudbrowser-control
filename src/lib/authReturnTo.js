// Shared by the auth pages (Login, Register, and any page that resumes a flow
// after sign-in, e.g. the MCP OAuth consent page). Keep the redirect
// validation in one place — it is security-sensitive and easy to drift.

// Where a signed-in user belongs when no explicit returnTo is given. The public
// marketing page owns "/", so defaulting there made a completed sign-in look like
// it had simply bounced the user back to the home page. The app's own home is the
// default instead; an explicit returnTo still wins, including an explicit "/".
export const APP_HOME = "/dashboard";

// Resolve ?returnTo= to a safe same-origin path, else APP_HOME.
//
// The same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return APP_HOME;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return APP_HOME;
    // Strip app-bootstrap params: app-params.js persists these from the URL into
    // localStorage before the SDK initializes, so a crafted returnTo could
    // otherwise poison the freshly issued session — repointing the app at an
    // attacker's backend (app_base_url/app_id/functions_version) or overwriting
    // the token. Normal app-flow params (e.g. the OAuth consent ctx) are kept.
    // The full app-params.js bootstrap set (src/lib/app-params.js) — any of
    // these in a crafted returnTo would be persisted at next load.
    for (const p of ["access_token", "clear_access_token", "app_id", "app_base_url", "functions_version", "from_url"]) {
      url.searchParams.delete(p);
    }
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return APP_HOME;
    return path;
  } catch {
    return APP_HOME;
  }
}