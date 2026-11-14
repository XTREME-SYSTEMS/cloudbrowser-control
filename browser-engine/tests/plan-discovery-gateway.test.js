import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gateway = readFileSync(new URL("../../base44/functions/mcpGateway/entry.ts", import.meta.url), "utf8");
const engine = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const manifest = JSON.parse(readFileSync(new URL("../../base44/mcp/config.json", import.meta.url), "utf8"));

test("MCP plan discovery requires read-only session scope", () => {
  assert.match(gateway, /extract_plan_manifest:\s*"sessions:read"/);
  assert.match(gateway, /case "extract_plan_manifest":/);
  assert.match(gateway, /return \{ manifest: r\.data, source_url: r\.url, read_only: true, downloaded_documents: 0 \}/);
});

test("MCP plan discovery refuses unbound or mismatched project sessions", () => {
  assert.match(gateway, /!keyRecord\.project_id\s*\|\|\s*!s\.project_id\s*\|\|\s*s\.project_id\s*!==\s*keyRecord\.project_id/);
  assert.match(gateway, /Plan discovery requires a project-bound authorized browser session/);
});

test("Browser engine registers new read-only action on existing session", () => {
  assert.match(engine, /import \{ discoverPlansOnPage \} from '\.\/plan-discovery\.js'/);
  assert.match(engine, /case "plan_manifest": \{ result\.data = await discoverPlansOnPage\(page,/);
});

test("MCP manifest advertises plan finder without creating a new app", () => {
  const functions = manifest?.tools?.functions || [];
  const control = functions.find(x => x.name === "browser_control");
  assert.ok(control);
  assert.ok(control.description.includes("extract_plan_manifest"));
  assert.ok(control.description.includes("read-only, no download"));
});
