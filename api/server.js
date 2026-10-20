import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  newRequestId,
  normalizeError,
  problemJson,
  RateLimiter,
  NotFoundError,
} from "./lib/http.js";
import { authenticate } from "./lib/auth.js";
import jobsRouter from "./routes/jobs.js";
import sessionsRouter from "./routes/sessions.js";

export const API_VERSION = "1.0.0";

const here = path.dirname(fileURLToPath(import.meta.url));
const openApiDocument = JSON.parse(readFileSync(path.join(here, "openapi.json"), "utf8"));

/**
 * Builds the API gateway. Exported separately from the listener so tests and
 * future in-process callers can mount it without binding a port.
 */
export function createApp() {
  const app = express();
  const allowlist = (process.env.CORS_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const limiter = new RateLimiter({
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
    windowMs: 60_000,
  });

  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: process.env.API_BODY_LIMIT || "1mb" }));

  // Correlation ID: honoured from the caller, otherwise generated.
  app.use((req, res, next) => {
    req.id = req.get("x-request-id") || newRequestId();
    res.set("x-request-id", req.id);
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowlist.length === 0 || allowlist.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Origin not allowed by CORS"));
      },
    }),
  );

  // Unauthenticated surface: liveness and the machine-readable contract.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "cloudbrowser-api", version: API_VERSION });
  });
  app.get("/openapi.json", (_req, res) => res.json(openApiDocument));

  // Authenticated surface.
  const v1 = express.Router();
  v1.use(async (req, res, next) => {
    try {
      const auth = await authenticate(req);
      const decision = limiter.check(`tenant:${auth.tenantId}`);
      res.set("x-ratelimit-limit", String(limiter.limit));
      res.set("x-ratelimit-remaining", String(decision.remaining));
      res.set("x-ratelimit-reset", String(Math.ceil(decision.resetAt / 1000)));
      if (!decision.allowed) {
        res.status(429);
        return res.json(
          problemJson({
            requestId: req.id,
            status: 429,
            code: "rate_limited",
            message: "Too many requests",
            retryable: true,
          }),
        );
      }
      req.auth = auth;
      return next();
    } catch (err) {
      return next(err);
    }
  });
  v1.use("/jobs", jobsRouter);
  v1.use("/sessions", sessionsRouter);
  app.use("/v1", v1);

  app.use((req, _res, next) => next(new NotFoundError(`No route for ${req.method} ${req.path}`)));

  // Terminal error handler: one normalized shape for every failure.
  app.use((err, req, res, next) => {
    void next;
    const normalized = normalizeError(err);
    if (normalized.status >= 500) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "unhandled_error",
          request_id: req.id,
          name: err?.name,
          error: err?.message,
        }),
      );
    }
    res.status(normalized.status).json(problemJson({ requestId: req.id, ...normalized }));
  });

  return app;
}

const isEntrypoint =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntrypoint) {
  const port = Number(process.env.API_PORT || 4000);
  const server = createApp().listen(port, () => {
    console.log(JSON.stringify({ level: "info", msg: "api_listening", port, version: API_VERSION }));
  });

  const shutdown = (signal) => {
    console.log(JSON.stringify({ level: "info", msg: "api_shutdown", signal }));
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}