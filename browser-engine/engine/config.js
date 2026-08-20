export const ENGINE_API_KEY = process.env.ENGINE_API_KEY;
export const PORT = Number(process.env.PORT || 8080);
export const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 10);
export const DEFAULT_TIMEOUT = Number(process.env.DEFAULT_TIMEOUT || 30000);
export const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 300000);
export const POOL_SIZE = Number(process.env.POOL_SIZE || 3);
const requestedWarmBudget = Number(process.env.WARM_POOL_INSTANCE_BUDGET || Math.min(MAX_SESSIONS, POOL_SIZE + 1));
export const WARM_POOL_INSTANCE_BUDGET = Math.min(MAX_SESSIONS, Math.max(POOL_SIZE, requestedWarmBudget));
export const VIDEO_DIR = process.env.VIDEO_DIR || "/tmp/videos";
export const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 50 * 1024 * 1024);
export const DOWNLOAD_MAX_BYTES = Number(process.env.DOWNLOAD_MAX_BYTES || 100 * 1024 * 1024);
export const ENFORCE_HTTPS = process.env.ENFORCE_HTTPS === "true";
export const CORS_ALLOWLIST = (process.env.CORS_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
export const CRAWL_MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 50);
export const CRAWL_MAX_DEPTH = Number(process.env.CRAWL_MAX_DEPTH || 3);
export const CRAWL_DELAY_MS = Number(process.env.CRAWL_DELAY_MS || 1000);
export const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";
export const REGION = process.env.RAILWAY_REGION || process.env.REGION || "unknown";
export const ENGINE_VERSION = "3.1.0-fortress";
export const SCHEMA_VERSION = "3.0";
export const CONFIG_VERSION = process.env.CONFIG_VERSION || "unknown";
export const EXTENSION_BASE = process.env.EXTENSION_DIR || "/data/extensions";
export const ALLOW_CDP = process.env.ALLOW_CDP === "true";
export const DEFAULT_EGRESS_POLICY = Object.freeze({
  allowed_ports: [80, 443],
  private_network_access: false,
  metadata_access: false,
  enforce_https: ENFORCE_HTTPS,
});

export function assertEngineConfig() {
  if (!ENGINE_API_KEY || ENGINE_API_KEY.length < 16) {
    throw new Error("ENGINE_API_KEY must be set to a strong value (>=16 chars)");
  }
  if (!Number.isInteger(MAX_SESSIONS) || MAX_SESSIONS < 1) throw new Error("MAX_SESSIONS must be a positive integer");
  if (!Number.isInteger(POOL_SIZE) || POOL_SIZE < 0 || POOL_SIZE > MAX_SESSIONS) throw new Error("POOL_SIZE must be an integer between 0 and MAX_SESSIONS");
  if (!Number.isInteger(WARM_POOL_INSTANCE_BUDGET) || WARM_POOL_INSTANCE_BUDGET < POOL_SIZE || WARM_POOL_INSTANCE_BUDGET > MAX_SESSIONS) {
    throw new Error("WARM_POOL_INSTANCE_BUDGET must be between POOL_SIZE and MAX_SESSIONS");
  }
}
