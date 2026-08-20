const DEFAULT_ALLOWED_PORTS = new Set([80, 443]);
const MAX_REDIRECTS = 5;

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
  if (raw.startsWith("fe8") || raw.startsWith("fe9") || raw.startsWith("fea") || raw.startsWith("feb")) return true;
  if (raw.startsWith("fc") || raw.startsWith("fd")) return true;
  return false;
}

function hostnameLooksUnsafe(hostname) {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (host === "localhost" || host === "metadata.google.internal") return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (/^0x[0-9a-f]+$/i.test(host) || /^0[0-7]+$/.test(host) || /^\d+$/.test(host)) return true;
  return isBlockedIp(host);
}

async function resolveAddresses(hostname) {
  const host = normalizeHost(hostname);
  if (isBlockedIp(host)) return [host];
  if (typeof Deno === "undefined" || typeof Deno.resolveDns !== "function") {
    throw new Error("DNS resolver unavailable; refusing hostname egress");
  }

  const addresses = [];
  for (const type of ["A", "AAAA"]) {
    try {
      const resolved = await Deno.resolveDns(host, type);
      addresses.push(...resolved);
    } catch (error) {
      const message = String(error?.message || error).toLowerCase();
      if (!message.includes("no record") && !message.includes("not found") && !message.includes("nxdomain")) throw error;
    }
  }
  if (addresses.length === 0) throw new Error(`DNS resolution returned no addresses for ${host}`);
  return [...new Set(addresses)];
}

function domainAllowed(hostname, policy = {}) {
  const host = normalizeHost(hostname);
  const blocked = (policy.blocked_domains || []).map(normalizeHost);
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
  const allowedPorts = new Set(Array.isArray(policy.allowed_ports) && policy.allowed_ports.length ? policy.allowed_ports.map(Number) : [...DEFAULT_ALLOWED_PORTS]);
  if (!allowedPorts.has(port)) return { ok: false, error: `Port ${port} not allowed` };

  const hostname = normalizeHost(parsed.hostname);
  if (hostnameLooksUnsafe(hostname)) return { ok: false, error: `Blocked host: ${hostname}` };
  if (!domainAllowed(hostname, policy)) return { ok: false, error: `Domain not allowed: ${hostname}` };

  try {
    const addresses = await resolveAddresses(hostname);
    if (policy.private_network_access !== true && addresses.some(isBlockedIp)) {
      return { ok: false, error: `Resolved address blocked for ${hostname}` };
    }
    if (addresses.some((ip) => normalizeHost(ip) === "169.254.169.254" || normalizeHost(ip) === "fd00:ec2::254")) {
      return { ok: false, error: "Cloud metadata address blocked" };
    }
    return { ok: true, url: parsed.toString(), hostname, addresses, port };
  } catch (error) {
    return { ok: false, error: `DNS validation failed: ${error.message}` };
  }
}

export async function safeFetch(url, init = {}, policy = {}) {
  let current = String(url);
  let method = String(init.method || "GET").toUpperCase();
  let body = init.body;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await validateEgressUrl(current, policy);
    if (!verdict.ok) throw new Error(`SSRF blocked: ${verdict.error}`);

    const response = await fetch(current, { ...init, method, body, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (hop === MAX_REDIRECTS) throw new Error("Too many redirects");

    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect ${response.status} missing Location`);
    const next = new URL(location, current).toString();
    const nextParsed = new URL(next);
    const currentParsed = new URL(current);
    if (currentParsed.protocol === "https:" && nextParsed.protocol !== "https:") {
      throw new Error("HTTPS redirect downgrade blocked");
    }

    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
    }
    current = next;
  }

  throw new Error("Redirect validation exhausted");
}

export const SSRF_LIMITATION = "DNS is revalidated immediately before each fetch/redirect, but standard fetch does not pin the validated IP. Network-layer private-range egress denial is still required to close DNS-rebinding TOCTOU completely.";
