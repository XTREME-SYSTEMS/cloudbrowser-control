import dns from "node:dns/promises";
import net from "node:net";

const DEFAULT_ALLOWED_PORTS = new Set([80, 443]);

function normalizeHost(hostname) {
  return String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
}

function parseIpv4(value) {
  const parts = String(value).split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

export function isBlockedIp(ip) {
  const raw = normalizeHost(ip);
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4 = parseIpv4(mapped ? mapped[1] : raw);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (raw === "::" || raw === "::1") return true;
  if (raw === "fd00:ec2::254") return true;
  if (/^fe[89ab][0-9a-f]*:/i.test(raw)) return true;
  if (/^f[cd][0-9a-f]*:/i.test(raw)) return true;
  return false;
}

function unsafeHostname(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (host === "localhost" || host === "metadata.google.internal") return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^0x[0-9a-f]+$/i.test(host) || /^0[0-7]+$/.test(host) || /^\d+$/.test(host)) return true;
  return net.isIP(host) > 0 && isBlockedIp(host);
}

function domainAllowed(hostname, policy) {
  const host = normalizeHost(hostname);
  const blocked = (policy.blocked_domains || []).map(normalizeHost).filter(Boolean);
  if (blocked.some((domain) => host === domain || host.endsWith(`.${domain}`))) return false;
  const allowed = (policy.allowed_domains || []).map(normalizeHost).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.some((domain) => host === domain || (policy.allow_subdomains === true && host.endsWith(`.${domain}`)));
}

export async function validateEgressUrl(urlStr, policy = {}) {
  let parsed;
  try { parsed = new URL(urlStr); } catch { return { ok: false, error: "Invalid URL" }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, error: "Only http/https are allowed" };
  if (parsed.username || parsed.password) return { ok: false, error: "URL userinfo is not allowed" };
  if (policy.enforce_https === true && parsed.protocol !== "https:") return { ok: false, error: "HTTPS required" };

  const port = parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
  const configuredPorts = Array.isArray(policy.allowed_ports) && policy.allowed_ports.length ? policy.allowed_ports.map(Number) : [...DEFAULT_ALLOWED_PORTS];
  if (!new Set(configuredPorts).has(port)) return { ok: false, error: `Port ${port} not allowed` };

  const hostname = normalizeHost(parsed.hostname);
  if (unsafeHostname(hostname)) return { ok: false, error: `Blocked host: ${hostname}` };
  if (!domainAllowed(hostname, policy)) return { ok: false, error: `Domain not allowed: ${hostname}` };

  try {
    const addresses = net.isIP(hostname)
      ? [{ address: hostname, family: net.isIP(hostname) }]
      : await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length) return { ok: false, error: `No DNS addresses for ${hostname}` };
    if (addresses.some((entry) => isBlockedIp(entry.address))) return { ok: false, error: `Resolved address blocked for ${hostname}` };
    return { ok: true, parsed, addresses: addresses.map((entry) => entry.address), port };
  } catch (error) {
    return { ok: false, error: `DNS validation failed: ${error.message}` };
  }
}

function patternMatches(pattern, url) {
  if (typeof pattern !== "string") return false;
  if (pattern === url) return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  try { return new RegExp(`^${escaped}$`).test(url); } catch { return false; }
}

export async function installEgressGuard(context, policy = {}, blockedResources = [], networkMocks = []) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    if (blockedResources.includes(resourceType)) return route.abort("blockedbyclient");

    const verdict = await validateEgressUrl(request.url(), policy);
    if (!verdict.ok) return route.abort("blockedbyclient");

    const mock = networkMocks.find((item) => patternMatches(item?.url, request.url()));
    if (mock) {
      return route.fulfill({
        status: Number(mock.status || 200),
        contentType: mock.contentType || "application/json",
        body: mock.body || "",
      });
    }
    return route.continue();
  });
}

export const SSRF_LIMITATION = "Application-layer DNS is revalidated per request, but Chromium resolves independently after route.continue(). Network-layer private-range egress denial or resolver pinning is still required to eliminate DNS-rebinding TOCTOU completely.";
