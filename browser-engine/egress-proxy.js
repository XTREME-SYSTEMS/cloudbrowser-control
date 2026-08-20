import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns/promises";
import { validateEgressUrl } from "./ssrf.js";

export class EgressProxyError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "EgressProxyError";
    this.status = status;
  }
}
function bracketHost(host) { return net.isIP(host) === 6 ? `[${host}]` : host; }
function normalizeUpstream(upstreamProxy) {
  if (!upstreamProxy?.server) return null;
  const raw = String(upstreamProxy.server);
  const parsed = new URL(raw.includes("://") ? raw : `http://${raw}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new EgressProxyError(400, `Unsupported upstream proxy protocol: ${parsed.protocol}`);
  return { protocol: parsed.protocol, hostname: parsed.hostname, port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)), username: upstreamProxy.username || decodeURIComponent(parsed.username || ""), password: upstreamProxy.password || decodeURIComponent(parsed.password || "") };
}
function proxyAuthorization(upstream) {
  if (!upstream?.username && !upstream?.password) return null;
  return `Basic ${Buffer.from(`${upstream.username || ""}:${upstream.password || ""}`).toString("base64")}`;
}
export async function resolvePinnedTarget(rawUrl, policy = {}, resolver = dns.lookup) {
  const verdict = await validateEgressUrl(rawUrl, policy, resolver);
  if (!verdict.ok) throw new EgressProxyError(403, verdict.error);
  const address = verdict.addresses[0];
  if (!address || !net.isIP(address)) throw new EgressProxyError(502, "Validated target did not yield an IP address");
  return { url: verdict.parsed, hostname: verdict.parsed.hostname, port: verdict.port, address, family: net.isIP(address) };
}
async function resolvePinnedUpstream(upstream, resolver) {
  if (!upstream) return null;
  const scheme = upstream.protocol === "https:" ? "https" : "http";
  const target = await resolvePinnedTarget(`${scheme}://${bracketHost(upstream.hostname)}:${upstream.port}/`, { allowed_ports: [upstream.port] }, resolver);
  return { ...upstream, address: target.address, family: target.family };
}
function openSocket({ address, port, family, tlsServerName, tlsEnabled = false }) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    const socket = tlsEnabled ? tls.connect({ host: address, port, family, servername: tlsServerName, rejectUnauthorized: true }, () => { socket.off("error", onError); resolve(socket); }) : net.connect({ host: address, port, family }, () => { socket.off("error", onError); resolve(socket); });
    socket.once("error", onError);
  });
}
async function openUpstreamTunnel(target, upstream, resolver) {
  const pinnedUpstream = await resolvePinnedUpstream(upstream, resolver);
  const socket = await openSocket({ address: pinnedUpstream.address, port: pinnedUpstream.port, family: pinnedUpstream.family, tlsServerName: pinnedUpstream.hostname, tlsEnabled: pinnedUpstream.protocol === "https:" });
  const authority = `${bracketHost(target.address)}:${target.port}`;
  const auth = proxyAuthorization(pinnedUpstream);
  socket.write([`CONNECT ${authority} HTTP/1.1`, `Host: ${target.hostname}:${target.port}`, "Proxy-Connection: Keep-Alive", ...(auth ? [`Proxy-Authorization: ${auth}`] : []), "", ""].join("\r\n"));
  return new Promise((resolve, reject) => {
    let buffered = Buffer.alloc(0);
    const onData = (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      const marker = buffered.indexOf("\r\n\r\n");
      if (marker < 0) { if (buffered.length > 65536) reject(new Error("Upstream proxy CONNECT response too large")); return; }
      socket.off("data", onData);
      const head = buffered.subarray(0, marker).toString("latin1");
      const rest = buffered.subarray(marker + 4);
      const status = Number(head.match(/^HTTP\/\d\.\d\s+(\d+)/i)?.[1] || 0);
      if (status !== 200) { socket.destroy(); reject(new Error(`Upstream proxy CONNECT failed with status ${status || "unknown"}`)); return; }
      if (rest.length) socket.unshift(rest);
      resolve(socket);
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}
function writeProxyError(socket, status, message) {
  if (!socket.destroyed) {
    const safe = String(message || "Egress denied").replace(/[\r\n]/g, " ").slice(0, 512);
    socket.end(`HTTP/1.1 ${status} Egress Denied\r\nContent-Type: text/plain\r\nConnection: close\r\nContent-Length: ${Buffer.byteLength(safe)}\r\n\r\n${safe}`);
  }
}
function copyTargetHeaders(headers, host) { const next = { ...headers, host }; delete next["proxy-authorization"]; delete next["proxy-connection"]; return next; }
export async function createPinnedEgressProxy({ policy = {}, upstreamProxy = null, resolver = dns.lookup } = {}) {
  const upstream = normalizeUpstream(upstreamProxy);
  const stats = { http: 0, connect: 0, websocket: 0, denied: 0, errors: 0 };
  const server = http.createServer(async (req, res) => {
    stats.http++;
    try {
      const raw = /^https?:\/\//i.test(req.url || "") ? req.url : `http://${req.headers.host || ""}${req.url || "/"}`;
      const target = await resolvePinnedTarget(raw, policy, resolver);
      if (target.url.protocol !== "http:") throw new EgressProxyError(400, "HTTPS must use CONNECT tunneling");
      const requestPath = `${target.url.pathname || "/"}${target.url.search || ""}`;
      const headers = copyTargetHeaders(req.headers, target.url.host);
      let transport = http;
      let requestOptions;
      if (upstream) {
        const pinnedUpstream = await resolvePinnedUpstream(upstream, resolver);
        transport = pinnedUpstream.protocol === "https:" ? https : http;
        const auth = proxyAuthorization(pinnedUpstream);
        if (auth) headers["proxy-authorization"] = auth;
        requestOptions = { hostname: pinnedUpstream.address, port: pinnedUpstream.port, family: pinnedUpstream.family, servername: pinnedUpstream.protocol === "https:" ? pinnedUpstream.hostname : undefined, method: req.method, path: `http://${bracketHost(target.address)}:${target.port}${requestPath}`, headers };
      } else {
        requestOptions = { hostname: target.address, port: target.port, family: target.family, method: req.method, path: requestPath, headers };
      }
      const outbound = transport.request(requestOptions, (upstreamRes) => { res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers); upstreamRes.pipe(res); });
      outbound.on("error", (error) => { stats.errors++; if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ error: `Pinned egress request failed: ${error.message}` })); });
      req.pipe(outbound);
    } catch (error) {
      stats.denied++;
      res.statusCode = error instanceof EgressProxyError ? error.status : 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  server.on("connect", async (req, clientSocket, head) => {
    stats.connect++;
    try {
      const target = await resolvePinnedTarget(`https://${req.url}/`, policy, resolver);
      const targetSocket = upstream ? await openUpstreamTunnel(target, upstream, resolver) : await openSocket({ address: target.address, port: target.port, family: target.family });
      clientSocket.write("HTTP/1.1 200 Connection Established\r\nProxy-Agent: CloudBrowser-Fortress\r\n\r\n");
      if (head?.length) targetSocket.write(head);
      targetSocket.pipe(clientSocket); clientSocket.pipe(targetSocket);
      const destroy = () => { try { targetSocket.destroy(); } catch {} try { clientSocket.destroy(); } catch {} };
      clientSocket.on("error", destroy); targetSocket.on("error", destroy);
    } catch (error) { stats.denied++; writeProxyError(clientSocket, error instanceof EgressProxyError ? error.status : 502, error.message); }
  });
  server.on("upgrade", async (req, clientSocket, head) => {
    stats.websocket++;
    try {
      if (upstream) throw new EgressProxyError(501, "Plain ws:// through an upstream proxy is disabled until separately verified; use wss://");
      const raw = /^ws:\/\//i.test(req.url || "") ? req.url.replace(/^ws:/i, "http:") : `http://${req.headers.host || ""}${req.url || "/"}`;
      const target = await resolvePinnedTarget(raw, policy, resolver);
      const targetSocket = await openSocket({ address: target.address, port: target.port, family: target.family });
      const headers = copyTargetHeaders(req.headers, target.url.host);
      const requestPath = `${target.url.pathname || "/"}${target.url.search || ""}`;
      const lines = [`${req.method || "GET"} ${requestPath} HTTP/${req.httpVersion || "1.1"}`];
      for (const [name, value] of Object.entries(headers)) { if (Array.isArray(value)) value.forEach((item) => lines.push(`${name}: ${item}`)); else if (value !== undefined) lines.push(`${name}: ${value}`); }
      targetSocket.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) targetSocket.write(head);
      targetSocket.pipe(clientSocket); clientSocket.pipe(targetSocket);
      const destroy = () => { try { targetSocket.destroy(); } catch {} try { clientSocket.destroy(); } catch {} };
      clientSocket.on("error", destroy); targetSocket.on("error", destroy);
    } catch (error) { stats.denied++; writeProxyError(clientSocket, error instanceof EgressProxyError ? error.status : 502, error.message); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!port) throw new Error("Pinned egress proxy failed to allocate a local port");
  return { url: `http://127.0.0.1:${port}`, port, stats, close: () => new Promise((resolve) => server.close(() => resolve())) };
}
