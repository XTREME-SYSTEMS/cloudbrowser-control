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

function ipv4InCidr(parts, base, prefix) {
  const value = parts.reduce((acc, octet) => (acc << 8n) | BigInt(octet), 0n);
  const baseValue = base.reduce((acc, octet) => (acc << 8n) | BigInt(octet), 0n);
  const shift = 32n - BigInt(prefix);
  return (value >> shift) === (baseValue >> shift);
}

function ipv6ToBigInt(value) {
  let raw = normalizeHost(value).split("%")[0];
  if (!raw || !raw.includes(":")) return null;
  if (raw.includes(".")) {
    const lastColon = raw.lastIndexOf(":");
    const v4 = parseIpv4(raw.slice(lastColon + 1));
    if (!v4) return null;
    const high = ((v4[0] << 8) | v4[1]).toString(16);
    const low = ((v4[2] << 8) | v4[3]).toString(16);
    raw = `${raw.slice(0, lastColon)}:${high}:${low}`;
  }
  const double = raw.indexOf("::");
  let parts;
  if (double >= 0) {
    if (raw.indexOf("::", double + 1) >= 0) return null;
    const left = raw.slice(0, double).split(":").filter(Boolean);
    const right = raw.slice(double + 2).split(":").filter(Boolean);
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    parts = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    parts = raw.split(":");
    if (parts.length !== 8) return null;
  }
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  return parts.reduce((acc, part) => (acc << 16n) | BigInt(`0x${part}`), 0n);
}

function ipv6InCidr(value, base, prefix) {
  const parsed = ipv6ToBigInt(value);
  const parsedBase = ipv6ToBigInt(base);
  if (parsed === null || parsedBase === null) return false;
  const shift = 128n - BigInt(prefix);
  return (parsed >> shift) === (parsedBase >> shift);
}

export function isBlockedIp(ip) {
  const raw = normalizeHost(ip);
  const mapped = raw.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4 = parseIpv4(mapped ? mapped[1] : raw);
  if (v4) {
    const blockedV4 = [
      [[0, 0, 0, 0], 8], [[10, 0, 0, 0], 8], [[100, 64, 0, 0], 10], [[127, 0, 0, 0], 8],
      [[169, 254, 0, 0], 16], [[172, 16, 0, 0], 12], [[192, 0, 0, 0], 24], [[192, 0, 2, 0], 24],
      [[192, 88, 99, 0], 24], [[192, 168, 0, 0], 16], [[198, 18, 0, 0], 15], [[198, 51, 100, 0], 24],
      [[203, 0, 113, 0], 24], [[224, 0, 0, 0], 4], [[240, 0, 0, 0], 4],
    ];
    return blockedV4.some(([base, prefix]) => ipv4InCidr(v4, base, prefix));
  }
  if (net.isIP(raw) !== 6) return false;
  const blockedV6 = [
    ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b:1::", 48], ["100::", 64],
    ["2001:2::", 48], ["2001:10::", 28], ["2001:20::", 28], ["2001:db8::", 32],
    ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
  ];
  return blockedV6.some(([base, prefix]) => ipv6InCidr(raw, base, prefix));
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

export async function validateEgressUrl(urlStr, policy = {}, resolver = dns.lookup) {
  let parsed;
  try { parsed = new URL(urlStr); } catch { return { ok: false, error: "Invalid URL" }; }
  if (!["http:", "https:"].includes(parsed.protocol)) return { ok: false, error: "Only http/https are allowed" };
  if (parsed.username || parsed.password) return { ok: false, error: "URL userinfo is not allowed" };
  if (policy.enforce_https === true && parsed.protocol !== "https:") return { ok: false, error: "HTTPS required" };
  const port = parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
  const configuredPorts = Array.isArray(policy.allowed_ports) && policy.allowed_ports.length ? policy.allowed_ports.map(Number) : [...DEFAULT_ALLOWED_PORTS];
  if (!new Set(configuredPorts).has(port)) return { ok: false, error: `Port ${port} not allowed` };
  const hostname = normalizeHost(parsed.hostname);
  if (unsafeHostname(hostname)) return { ok: false, error: `Blocked host: ${hostname}` };
  if (!domainAllowed(hostname, policy)) return { ok: false, error: `Domain not allowed: ${hostname}` };
  try {
    const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await resolver(hostname, { all: true, verbatim: true });
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
    if (mock) return route.fulfill({ status: Number(mock.status || 200), contentType: mock.contentType || "application/json", body: mock.body || "" });
    return route.continue();
  });
}

export const SSRF_LIMITATION = "Application-layer request validation remains defense in depth. Final outbound TCP connections are DNS-pinned by the local egress proxy; network-layer destination denial remains recommended as an independent containment layer and must be separately verified on the hosting platform.";
