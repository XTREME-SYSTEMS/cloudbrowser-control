import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// Eyes → Brain push
// Pushes unsynced intelligence artifacts, seeds, and money trails to the Vision Cortex Brain (V-1)
// The Brain receives these at its /functions/syncFromEyes endpoint and stores them in IntelFeed.

const SYNC_BATCH_SIZE = 25;
const PUSH_TIMEOUT_MS = 15000;

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const startedAt = Date.now();
  const stats = { artifacts_pushed: 0, seeds_pushed: 0, money_trails_pushed: 0, failed: 0, skipped: 0 };

  const brainUrl = secrets.get("VISION_CORTEX_BRAIN_URL");
  const brainKey = secrets.get("VISION_CORTEX_BRAIN_API_KEY");

  if (!brainUrl || !brainKey) {
    return Response.json({
      ok: false,
      error: "Brain connection not configured — set VISION_CORTEX_BRAIN_URL and VISION_CORTEX_BRAIN_API_KEY secrets",
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  }

  const endpoint = `${brainUrl.replace(/\/$/, "")}/functions/syncFromEyes`;

  // Find what's already been synced to avoid duplicates
  const existingSyncs = await base44.asServiceRole.entities.BrainSyncLog.filter({
    direction: "eyes_to_brain",
    status: "success",
  }, "-synced_at", 500).catch(() => []);
  const syncedIds = new Set((existingSyncs || []).map((s) => s.source_id));

  // Gather unsynced intelligence
  const artifacts = await base44.asServiceRole.entities.IntelligenceArtifact.list("-learned_at", SYNC_BATCH_SIZE).catch(() => []);
  const seeds = await base44.asServiceRole.entities.IntelligenceSeed.filter({ status: "ingested" }, "-ingested_at", SYNC_BATCH_SIZE).catch(() => []);
  const moneyTrails = await base44.asServiceRole.entities.MoneyTrail.list("-date", SYNC_BATCH_SIZE).catch(() => []);

  const items = [];
  for (const a of (artifacts || [])) {
    if (!syncedIds.has(a.id)) {
      items.push({ source_type: "IntelligenceArtifact", source_id: a.id, data: { title: a.title, artifact_type: a.artifact_type, content: a.content, vision_cortex_analysis: a.vision_cortex_analysis, confidence_score: a.confidence_score, impact_score: a.impact_score, tags: a.tags, source_url: a.source_url, learned_at: a.learned_at } });
    }
  }
  for (const s of (seeds || [])) {
    if (!syncedIds.has(s.id)) {
      items.push({ source_type: "IntelligenceSeed", source_id: s.id, data: { title: s.title, source_type: s.source_type, intelligence_category: s.intelligence_category, description: s.description, url: s.url, vision_cortex_analysis: s.vision_cortex_analysis, relevance_score: s.relevance_score, tags: s.tags } });
    }
  }
  for (const m of (moneyTrails || [])) {
    if (!syncedIds.has(m.id)) {
      items.push({ source_type: "MoneyTrail", source_id: m.id, data: { entity_name: m.entity_name, entity_type: m.entity_type, flow_type: m.flow_type, amount_usd: m.amount_usd, category: m.category, description: m.description, vision_cortex_interpretation: m.vision_cortex_interpretation, elite_motive: m.elite_motive, date: m.date } });
    }
  }

  if (items.length === 0) {
    return Response.json({ ok: true, message: "Nothing new to sync", stats, duration_ms: Date.now() - startedAt, __v: DEPLOYMENT_VERSION });
  }

  // Push to Brain in a single batch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
  let brainResponse = null;
  let httpStatus = 0;
  let errorMsg = null;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-eyes-api-key": brainKey },
      body: JSON.stringify({ source: "cloud-browser-v2-eyes", batch: items }),
      signal: controller.signal,
    });
    httpStatus = res.status;
    const text = await res.text();
    brainResponse = text.slice(0, 500);
    if (!res.ok) {
      errorMsg = `Brain returned HTTP ${res.status}: ${text.slice(0, 200)}`;
    }
  } catch (err) {
    errorMsg = err.name === "AbortError" ? `Timeout after ${PUSH_TIMEOUT_MS}ms` : err.message;
  } finally {
    clearTimeout(timer);
  }

  const success = errorMsg === null;
  const now = new Date().toISOString();

  // Log the sync batch
  for (const item of items) {
    try {
      await base44.asServiceRole.entities.BrainSyncLog.create({
        direction: "eyes_to_brain",
        source_type: item.source_type,
        source_id: item.source_id,
        payload_summary: item.data.title || item.data.entity_name || item.source_id,
        status: success ? "success" : "failed",
        http_status: httpStatus,
        brain_response: success ? "ok" : brainResponse,
        error_message: errorMsg,
        synced_at: now,
      });
      if (success) {
        if (item.source_type === "IntelligenceArtifact") stats.artifacts_pushed++;
        else if (item.source_type === "IntelligenceSeed") stats.seeds_pushed++;
        else if (item.source_type === "MoneyTrail") stats.money_trails_pushed++;
      } else {
        stats.failed++;
      }
    } catch (e) {
      stats.failed++;
      console.error("Sync log failed:", e.message);
    }
  }

  return Response.json({
    ok: success,
    endpoint,
    items_attempted: items.length,
    stats,
    http_status: httpStatus,
    error: errorMsg,
    duration_ms: Date.now() - startedAt,
    __v: DEPLOYMENT_VERSION,
  }, { status: 200 });
}