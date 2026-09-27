import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { EngineClient, EngineError } from "../src/engine-client.mjs";

async function withMockEngine(run) {
  const key = "e".repeat(32);
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;

    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, status: "healthy", engine_version: "3.1.0" }));
    }

    if (req.headers["x-api-key"] !== key) {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }

    if (req.method === "POST" && req.url === "/sessions") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ sessionId: "sess_test", status: "idle", received: body }));
    }
    if (req.method === "GET" && req.url === "/sessions/sess_test") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ sessionId: "sess_test", status: "idle", url: "https://example.com" }));
    }
    if (req.method === "POST" && req.url === "/sessions/sess_test/execute") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, ...body, url: "https://example.com" }));
    }
    if (req.method === "DELETE" && req.url === "/sessions/sess_test") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, closed: true }));
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    await run({ baseUrl: `http://127.0.0.1:${port}`, key });
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("engine client uses public health without auth and authenticated session routes", async () => {
  await withMockEngine(async ({ baseUrl, key }) => {
    const client = new EngineClient({ baseUrl, apiKey: key });
    assert.equal((await client.health()).ok, true);
    const started = await client.start({ usePool: true });
    assert.equal(started.sessionId, "sess_test");
    assert.equal(started.received.usePool, true);
    assert.equal((await client.status("sess_test")).url, "https://example.com");
    assert.equal((await client.execute("sess_test", { action_type: "goto", value: "https://example.com" })).ok, true);
    assert.equal((await client.end("sess_test")).closed, true);
  });
});

test("engine client surfaces non-2xx status without leaking credentials", async () => {
  await withMockEngine(async ({ baseUrl }) => {
    const client = new EngineClient({ baseUrl, apiKey: "w".repeat(32) });
    await assert.rejects(() => client.start({}), error => {
      assert.equal(error instanceof EngineError, true);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Unauthorized");
      assert.equal(error.message.includes("w".repeat(16)), false);
      return true;
    });
  });
});
