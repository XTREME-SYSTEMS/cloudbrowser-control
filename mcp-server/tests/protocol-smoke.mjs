import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

const engineKey = "e".repeat(32);
const mcpKey = "m".repeat(32);
const engine = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, status: "healthy", engine_version: "3.1.0", worker_id: "mock" }));
  }
  if (req.headers["x-api-key"] !== engineKey) {
    res.writeHead(401, { "content-type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

engine.listen(0, "127.0.0.1");
await once(engine, "listening");
const engineUrl = `http://127.0.0.1:${engine.address().port}`;
const gatewayPort = await freePort();
const gatewayUrl = new URL(`http://127.0.0.1:${gatewayPort}/mcp`);

const child = spawn(process.execPath, ["src/server.mjs"], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: {
    ...process.env,
    PORT: String(gatewayPort),
    HOST: "127.0.0.1",
    CLOUD_BROWSER_MCP_KEY: mcpKey,
    BROWSER_ENGINE_URL: engineUrl,
    ENGINE_API_KEY: engineKey,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let childErrors = "";
child.stderr.on("data", chunk => { childErrors += chunk.toString(); });

async function waitForGateway() {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Gateway did not start. stderr=${childErrors}`);
}

try {
  await waitForGateway();

  const noAuth = await fetch(gatewayUrl, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(noAuth.status, 401);

  const modern = new Client(
    { name: "clean-browser-modern-test", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } }
  );
  await modern.connect(new StreamableHTTPClientTransport(gatewayUrl, {
    requestInit: { headers: { Authorization: `Bearer ${mcpKey}` } },
  }));
  assert.equal(modern.getProtocolEra(), "modern");
  const modernTools = await modern.listTools();
  assert.equal(modernTools.tools.some(tool => tool.name === "browser_health"), true);
  const health = await modern.callTool({ name: "browser_health", arguments: {} });
  assert.equal(health.isError, undefined);
  await modern.close();

  const legacy = new Client({ name: "clean-browser-legacy-test", version: "1.0.0" });
  await legacy.connect(new StreamableHTTPClientTransport(gatewayUrl, {
    requestInit: { headers: { Authorization: `Bearer ${mcpKey}` } },
  }));
  assert.equal(legacy.getProtocolEra(), "legacy");
  const legacyTools = await legacy.listTools();
  assert.equal(legacyTools.tools.some(tool => tool.name === "browser_health"), true);
  await legacy.close();

  console.log("PASS: bearer auth, modern MCP, legacy MCP fallback, tools/list and engine health tool");
} finally {
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 1500))]);
  engine.close();
  await once(engine, "close");
}
