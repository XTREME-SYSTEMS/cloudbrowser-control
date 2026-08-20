import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const SCORING_VERSION = "1.0.0";
const MAX_SOURCES_PER_RUN = 12;
const MAX_CONTENT_CHARS = 160000;

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

async function sha256(input) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function scoreSignal(x) {
  const parts = {
    capital_impact: Number(x.capital_impact || 0),
    urgency: Number(x.urgency || 0),
    novelty: Number(x.novelty || 0),
    actionability: Number(x.actionability || 0),
    source_authority: Number(x.source_authority || 0),
    corroboration: Number(x.corroboration || 0),
    confidence: Number(x.confidence || 0),
    competitive_scarcity: Number(x.competitive_scarcity || 0),
    lead_time_advantage: Number(x.lead_time_advantage || 0),
  };
  const weights = {
    capital_impact: 0.18,
    urgency: 0.10,
    novelty: 0.12,
    actionability: 0.14,
    source_authority: 0.10,
    corroboration: 0.10,
    confidence: 0.12,
    competitive_scarcity: 0.07,
    lead_time_advantage: 0.07,
  };
  let score = 0;
  for (const key of Object.keys(weights)) score += Math.max(0, Math.min(100, parts[key])) * weights[key];
  return { score: Math.round(score), parts };
}

function reviewStatus(score) {
  if (score >= 95) return "exceptional";
  if (score >= 85) return "high_value";
  if (score >= 70) return "meaningful";
  if (score >= 50) return "watch";
  return "archive";
}

function dueForHourlyCycle(now = new Date()) {
  const fiveMinuteTick = Math.floor(now.getTime() / 300000);
  return fiveMinuteTick % 12 === 0;
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const started = Date.now();
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const now = new Date();

  if (!body.force && !dueForHourlyCycle(now)) {
    return Response.json({ ok: true, due: false, reason: "hourly_cycle_not_due", checked_at: now.toISOString() });
  }

  const runId = uid("run");
  const errors = [];
  let attempted = 0;
  let successful = 0;
  let newSnapshots = 0;
  let changedSources = 0;
  let eventsCreated = 0;
  let signalsCreated = 0;
  let highValueSignals = 0;

  const run = await base44.asServiceRole.entities.IntelligenceRun.create({
    run_id: runId,
    cycle_type: body.force ? "manual" : "hourly_intelligence",
    started_at: now.toISOString(),
    status: "running",
    scheduler_tick: Math.floor(now.getTime() / 300000),
  });

  try {
    const allSources = await base44.asServiceRole.entities.IntelligenceSource.filter({ enabled: true });
    const eligible = allSources
      .filter((s) => s.terms_status === "allowed")
      .filter((s) => !s.next_eligible_check || new Date(s.next_eligible_check) <= now)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .slice(0, MAX_SOURCES_PER_RUN);

    for (const source of eligible) {
      attempted++;
      try {
        if (["browser", "pdf"].includes(source.access_method)) {
          // Browser/PDF collectors are intentionally routed through governed CloudBrowser jobs, not raw fetch.
          continue;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        let res;
        try {
          res = await fetch(source.url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
              "Accept": "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
              "User-Agent": "StrategicMinds-PrivateCapitalIntel/1.0 (+governed-public-source-monitor)",
            },
          });
        } finally {
          clearTimeout(timeout);
        }

        const text = (await res.text()).slice(0, MAX_CONTENT_CHARS);
        const checksum = await sha256(text);
        const prior = await base44.asServiceRole.entities.IntelligenceSnapshot.filter({ source_id: source.source_id });
        prior.sort((a, b) => new Date(b.captured_at || b.created_date).getTime() - new Date(a.captured_at || a.created_date).getTime());
        const changed = !prior.length || prior[0].checksum !== checksum;

        await base44.asServiceRole.entities.IntelligenceSnapshot.create({
          snapshot_id: uid("snap"),
          source_id: source.source_id,
          captured_at: new Date().toISOString(),
          checksum,
          content_excerpt: text.slice(0, 24000),
          changed_from_previous: changed,
          evidence_url: source.url,
          retrieval_status: res.ok ? (changed ? "success" : "unchanged") : "failed",
          http_status: res.status,
          metadata: { content_type: res.headers.get("content-type") || "", run_id: runId },
        });
        newSnapshots++;

        const nextEligible = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await base44.asServiceRole.entities.IntelligenceSource.update(source.id, {
          last_checked: new Date().toISOString(),
          next_eligible_check: nextEligible,
          health: res.ok ? "healthy" : "degraded",
          failure_count: res.ok ? 0 : (source.failure_count || 0) + 1,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        successful++;
        if (!changed || !prior.length) continue;
        changedSources++;

        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: `You are analyzing a changed public or permissioned source for early economic signals. Never invent facts. Separate evidence from inference. Identify at most 3 economically meaningful event candidates involving capital movement, AI/data-center/power/industrial infrastructure, government money, M&A, distress, forced transactions, private capital, or commercial real estate.\n\nSOURCE NAME: ${source.source_name}\nSOURCE CATEGORY: ${source.category}\nSOURCE AUTHORITY SCORE: ${source.authority_score || 50}\nSOURCE URL: ${source.url}\n\nCHANGED CONTENT:\n${text.slice(0, 60000)}`,
          response_json_schema: {
            type: "object",
            properties: {
              events: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    event_type: { type: "string" },
                    title: { type: "string" },
                    entities: { type: "array", items: { type: "string" } },
                    geography: { type: "string" },
                    verified_facts: { type: "array", items: { type: "string" } },
                    inferences: { type: "array", items: { type: "string" } },
                    estimated_capital_impact: { type: "string" },
                    explanation: { type: "string" },
                    predicted_outcome: { type: "string" },
                    action_window: { type: "string" },
                    capital_impact: { type: "number" },
                    urgency: { type: "number" },
                    novelty: { type: "number" },
                    actionability: { type: "number" },
                    confidence: { type: "number" },
                    competitive_scarcity: { type: "number" },
                    lead_time_advantage: { type: "number" },
                  },
                  required: ["event_type", "title", "verified_facts", "inferences", "capital_impact", "urgency", "novelty", "actionability", "confidence", "competitive_scarcity", "lead_time_advantage"],
                },
              },
            },
            required: ["events"],
          },
        });

        for (const candidate of (analysis?.events || [])) {
          if (!(candidate.verified_facts || []).length) continue;
          const eventId = uid("evt");
          await base44.asServiceRole.entities.IntelligenceEvent.create({
            event_id: eventId,
            event_type: candidate.event_type,
            title: candidate.title,
            entity_names: candidate.entities || [],
            geography: candidate.geography || "",
            first_seen: new Date().toISOString(),
            latest_seen: new Date().toISOString(),
            source_ids: [source.source_id],
            source_count: 1,
            evidence: [{ source_id: source.source_id, url: source.url, checksum }],
            status: "watch",
            verified_facts: candidate.verified_facts || [],
            inferences: candidate.inferences || [],
            metadata: { run_id: runId },
          });
          eventsCreated++;

          const scored = scoreSignal({
            ...candidate,
            source_authority: source.authority_score || 50,
            corroboration: 20,
          });
          if (scored.score < 50) continue;
          const status = reviewStatus(scored.score);
          await base44.asServiceRole.entities.IntelligenceSignal.create({
            signal_id: uid("sig"),
            event_id: eventId,
            title: candidate.title,
            category: source.category,
            first_detected_at: new Date().toISOString(),
            score: scored.score,
            ...scored.parts,
            estimated_capital_impact: candidate.estimated_capital_impact || "Could not verify",
            explanation: candidate.explanation || "",
            predicted_outcome: candidate.predicted_outcome || "",
            action_window: candidate.action_window || "",
            evidence: [{ source_id: source.source_id, url: source.url, checksum }],
            review_status: status,
            scoring_version: SCORING_VERSION,
            metadata: { run_id: runId, independent_source_count: 1 },
          });
          signalsCreated++;
          if (scored.score >= 85) highValueSignals++;
        }
      } catch (error) {
        errors.push({ source_id: source.source_id, error: String(error?.message || error) });
        try {
          await base44.asServiceRole.entities.IntelligenceSource.update(source.id, {
            last_checked: new Date().toISOString(),
            health: "degraded",
            failure_count: (source.failure_count || 0) + 1,
          });
        } catch (_) {}
      }
    }

    const status = errors.length === 0 ? "completed" : (successful > 0 ? "partial" : "failed");
    await base44.asServiceRole.entities.IntelligenceRun.update(run.id, {
      completed_at: new Date().toISOString(),
      status,
      sources_eligible: eligible.length,
      sources_attempted: attempted,
      sources_successful: successful,
      failures: errors.length,
      new_snapshots: newSnapshots,
      changed_sources: changedSources,
      events_created: eventsCreated,
      signals_created: signalsCreated,
      high_value_signals: highValueSignals,
      duration_ms: Date.now() - started,
      errors,
      evidence: [{ type: "base44_function", function: "runIntelligenceCycle" }],
      metadata: { scoring_version: SCORING_VERSION, captcha_bypass: false },
    });

    await base44.asServiceRole.entities.AuditLog.create({
      action: "run",
      entity_type: "private_capital_intelligence",
      entity_id: runId,
      description: `Private Capital intelligence cycle ${status}`,
      metadata: { attempted, successful, changedSources, eventsCreated, signalsCreated, highValueSignals, errors: errors.length },
      timestamp: new Date().toISOString(),
    });

    return Response.json({ ok: status !== "failed", run_id: runId, status, attempted, successful, changedSources, eventsCreated, signalsCreated, highValueSignals, errors });
  } catch (error) {
    errors.push({ error: String(error?.message || error) });
    await base44.asServiceRole.entities.IntelligenceRun.update(run.id, {
      completed_at: new Date().toISOString(),
      status: "failed",
      duration_ms: Date.now() - started,
      errors,
    });
    return Response.json({ ok: false, run_id: runId, error: error.message }, { status: 500 });
  }
}
