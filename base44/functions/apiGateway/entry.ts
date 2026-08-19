import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineDelete, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
// v5.0.0 — deployment refresh
import {
  hashKey, deriveClientIP, ipAllowed, checkRateLimit, matchRoute, ROUTE_SCOPES, dispatch
} from "../../shared/gatewayCore.ts";

// ═══════════════════════════════════════════════
// API Gateway v1 — legacy identity (kept for compatibility)
// All new callers should use cloudBrowserGatewayV6.
// ═══════════════════════════════════════════════

const GATEWAY_IDENTITY = "apiGateway";

function errorResponse(status, error, requestId) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION, gateway: GATEWAY_IDENTITY }, { status });
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers.get("x-request-id") || "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    const body = await req.json();
    const { path: requestPath, method: requestMethod = "GET", data = {} } = body;

    const authHeader = req.headers.get("authorization") || "";
    const headerKey = authHeader.replace(/^Bearer\s+/i, "");
    const headerIsApiKey = headerKey.startsWith("cb_live_") || headerKey.startsWith("cb_test_");
    const apiKey = (headerIsApiKey ? headerKey : "") || body.api_key || "";

    if (!apiKey) return errorResponse(401, "Missing API key. Provide Authorization: Bearer <key> header.", requestId);

    const keyHash = await hashKey(apiKey);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return errorResponse(401, "Invalid or revoked API key", requestId);
    const keyRecord = keys[0];

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return errorResponse(401, "API key expired", requestId);
    }

    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sysSettings = settings[0] || {};

    if (sysSettings.ip_allowlist?.length) {
      const ip = deriveClientIP(req);
      if (!ip) return errorResponse(403, "Unable to determine client IP — allowlist requires transparent proxy header", requestId);
      if (!ipAllowed(ip, sysSettings.ip_allowlist)) {
        return errorResponse(403, `IP ${ip} is not allowlisted`, requestId);
      }
    }

    const rateLimit = sysSettings.rate_limit_per_minute || 60;
    if (!await checkRateLimit(base44, keyHash, rateLimit)) {
      return errorResponse(429, "Rate limit exceeded", requestId);
    }

    const matched = matchRoute(requestMethod, requestPath);
    if (!matched) return errorResponse(404, `Unknown route: ${requestMethod} ${requestPath}`, requestId);

    const requiredScope = ROUTE_SCOPES[matched.route];
    if (requiredScope && !(keyRecord.scopes || []).includes(requiredScope)) {
      return errorResponse(403, `Insufficient scope. Required: ${requiredScope}`, requestId);
    }

    return await dispatch(base44, matched.route, matched.params, data, keyRecord, requestId, GATEWAY_IDENTITY, enginePost, engineDelete, isEngineConfigured);
  } catch (error) {
    return errorResponse(500, error.message, requestId);
  }
}