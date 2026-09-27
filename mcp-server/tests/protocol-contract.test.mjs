import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const server = await readFile(new URL("../src/server.mjs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("one canonical MCP route uses the current dual-era SDK handler", () => {
  assert.match(server, /const MCP_ROUTE = "\/mcp"/);
  assert.match(server, /createMcpHandler\(buildMcpServer, \{ legacy: "stateless" \}\)/);
  assert.match(server, /toNodeHandler\(mcpHandler\)/);
  assert.equal(Boolean(pkg.dependencies["@modelcontextprotocol/server"]), true);
  assert.equal(Boolean(pkg.dependencies["@modelcontextprotocol/node"]), true);
});

test("MCP route is bearer protected and engine credentials remain server-side", () => {
  assert.match(server, /bearerAuthorized\(req\.headers\.authorization, MCP_KEY\)/);
  assert.match(server, /const ENGINE_KEY = process\.env\.ENGINE_API_KEY/);
  assert.doesNotMatch(server, /structuredResult\([^)]*ENGINE_KEY/);
  assert.match(server, /SENSITIVE_ENGINE_ACTIONS/);
});
