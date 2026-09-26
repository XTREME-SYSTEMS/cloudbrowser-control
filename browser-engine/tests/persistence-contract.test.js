import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "..", "server.js");
const gatewayPath = path.resolve(here, "..", "..", "base44", "functions", "mcpGateway", "entry.ts");

test("durable session save returns an internal snapshot to the authenticated gateway", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /case "save_state"/);
  assert.match(server, /snapshot = \{ cookies, storageState, url: s\.url, title: s\.title \}/);
  assert.match(server, /result\.data = \{ stateToken, url: s\.url, snapshot \}/);
});

test("gateway persists encrypted state and never returns raw context credentials", async () => {
  const gateway = await readFile(gatewayPath, "utf8");
  assert.match(gateway, /"persist_" \+ crypto\.randomUUID\(\)/);
  assert.match(gateway, /cookies_encrypted:/);
  assert.match(gateway, /storage_state_encrypted:/);
  assert.match(gateway, /case "context_attach"/);
  assert.doesNotMatch(gateway, /return \{ cookies, storage_state:/);
});

test("durable restore creates a new runtime session from encrypted server-side context", async () => {
  const gateway = await readFile(gatewayPath, "utf8");
  assert.match(gateway, /restoreStoredContext/);
  assert.match(gateway, /persistence: "durable"/);
  assert.match(gateway, /target_url: targetUrl/);
});
