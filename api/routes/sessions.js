import express from "express";
import { requireScopes } from "../lib/auth.js";
import { withTenant } from "../../shared/db.js";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UpstreamError,
} from "../lib/http.js";

const router = express.Router();

function engineConfig() {
  const baseUrl = process.env.ENGINE_URL;
  const apiKey = process.env.ENGINE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new ValidationError("ENGINE_URL and ENGINE_API_KEY must be configured");
  }
  return { baseUrl: String(baseUrl).replace(/\/+$/, ""), apiKey };
}

/**
 * Calls the browser engine. The engine mounts its router at BOTH "/" and
 * "/engine" (browser-engine/server.js:1408-1409), so paths stay unprefixed.
 * Any transport failure is surfaced as UpstreamError (502), never a raw 500.
 */
async function engineRequest(path, { method = "GET", body } = {}) {
  const { baseUrl, apiKey } = engineConfig();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(process.env.ENGINE_REQUEST_TIMEOUT_MS || 60_000),
  );

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }
    return { status: response.status, payload };
  } catch (err) {
    throw new UpstreamError(`engine request failed: ${err?.message ?? "unknown transport error"}`);
  } finally {
    clearTimeout(timer);
  }
}

function toApiSession(row, tenantId) {
  const source = row && typeof row === "object" ? row : {};
  const id = source.sessionId ?? source.id ?? null;
  return {
    id,
    tenant_id: tenantId,
    status: source.status ?? null,
    url: source.url ?? null,
    title: source.title ?? null,
    created_at: source.createdAt ? new Date(source.createdAt).toISOString() : null,
    last_activity: source.lastActivity ? new Date(source.lastActivity).toISOString() : null,
    record_video: Boolean(source.recordVideo),
    worker_id: source.workerId ?? null,
    region: source.region ?? null,
  };
}

/** Unwraps either a bare session object or a { session } envelope. */
function extractSessionRow(payload) {
  if (payload && typeof payload === "object" && payload.session && typeof payload.session === "object") {
    return payload.session;
  }
  return payload;
}

async function recordOwner(tenantId, sessionId) {
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO session_owners (session_id, tenant_id)
            VALUES ($1, $2)
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId, tenantId],
    );
  });
}

/** RLS scopes this read to the caller's tenant, so no WHERE clause is needed. */
async function ownedSessionIds(tenantId) {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query("SELECT session_id FROM session_owners");
    return rows.map((row) => row.session_id);
  });
}

async function assertOwned(tenantId, sessionId) {
  const owned = await withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      "SELECT session_id FROM session_owners WHERE session_id = $1",
      [sessionId],
    );
    return rows.length === 1;
  });
  if (!owned) throw new ForbiddenError("Session does not belong to this tenant");
}

// GET /v1/sessions — only sessions this tenant created.
router.get("/", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["sessions:read"]);
    const owned = new Set(await ownedSessionIds(req.auth.tenantId));

    const { status, payload } = await engineRequest("/sessions");
    if (status >= 400) throw new UpstreamError(`engine session list failed with ${status}`);

    const rows = Array.isArray(payload?.sessions) ? payload.sessions : [];
    const sessions = rows
      .filter((row) => owned.has(row?.sessionId ?? row?.id))
      .map((row) => toApiSession(row, req.auth.tenantId));

    res.json({ sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// POST /v1/sessions — creates on the engine, then binds the session to the tenant.
router.post("/", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["sessions:write"]);
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (body.url !== undefined && typeof body.url !== "string") {
      throw new ValidationError("url must be a string");
    }
    if (body.usePool !== undefined && typeof body.usePool !== "boolean") {
      throw new ValidationError("usePool must be a boolean");
    }

    const { status, payload } = await engineRequest("/sessions", { method: "POST", body });
    if (status === 503) throw new UpstreamError("engine is at maximum concurrent sessions");
    if (status >= 400) throw new UpstreamError(`engine session create failed with ${status}`);

    const sessionId = payload?.sessionId ?? payload?.id;
    if (!sessionId) throw new UpstreamError("engine did not return a session identifier");

    await recordOwner(req.auth.tenantId, sessionId);

    res.status(201).json({
      ...toApiSession(
        { sessionId, status: payload.status, url: body.url ?? null, createdAt: payload.createdAt },
        req.auth.tenantId,
      ),
      from_pool: Boolean(payload.fromPool),
      expires_at: payload.expiresAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/sessions/:id
router.get("/:id", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["sessions:read"]);
    await assertOwned(req.auth.tenantId, req.params.id);

    const { status, payload } = await engineRequest(
      `/sessions/${encodeURIComponent(req.params.id)}`,
    );
    if (status === 404) throw new NotFoundError("Session not found");
    if (status >= 400) throw new UpstreamError(`engine session read failed with ${status}`);

    res.json(toApiSession(extractSessionRow(payload), req.auth.tenantId));
  } catch (err) {
    next(err);
  }
});

// DELETE /v1/sessions/:id — close and release ownership.
router.delete("/:id", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["sessions:write"]);
    await assertOwned(req.auth.tenantId, req.params.id);

    const { status } = await engineRequest(`/sessions/${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
    });
    if (status === 404) throw new NotFoundError("Session not found");
    if (status >= 400) throw new UpstreamError(`engine session close failed with ${status}`);

    await withTenant(req.auth.tenantId, async (client) => {
      await client.query("DELETE FROM session_owners WHERE session_id = $1", [req.params.id]);
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;