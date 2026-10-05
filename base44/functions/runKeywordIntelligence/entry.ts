import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

const RESPONSE_SCHEMA = {
  "type": "object",
  "properties": {
    "topic": { "type": "string" },
    "top_words": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "word": { "type": "string" },
          "search_volume_estimate": { "type": "string" },
          "trend_direction": { "type": "string", "enum": ["rising", "stable", "declining"] },
          "category": { "type": "string" }
        },
        "required": ["word", "trend_direction"]
      }
    },
    "top_categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": { "type": "string" },
          "search_volume_estimate": { "type": "string" },
          "trend_direction": { "type": "string", "enum": ["rising", "stable", "declining"] }
        },
        "required": ["category", "trend_direction"]
      }
    },
    "top_phrases": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "phrase": { "type": "string" },
          "search_volume_estimate": { "type": "string" },
          "trend_direction": { "type": "string", "enum": ["rising", "stable", "declining"] }
        },
        "required": ["phrase", "trend_direction"]
      }
    },
    "summary": { "type": "string" },
    "sources": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["top_words", "top_categories", "top_phrases", "summary"]
};

function buildPrompt(topic) {
  const scope = topic
    ? `the topic "${topic}"`
    : `all niches and general trending searches (no specific topic — find what the world is searching for on Google right now)`;
  return `You are a search-trend intelligence analyst. Use live web search to research ${scope}.

Return structured JSON with:
- top_words: the 15 highest-impact search terms / keywords people are searching on Google right now. For each: word, search_volume_estimate (use ranges like "100K+/mo", "10K-100K/mo", "1K-10K/mo"), trend_direction (rising/stable/declining), and the category it belongs to.
- top_categories: the 10 hottest search categories right now. For each: category, search_volume_estimate, trend_direction.
- top_phrases: the 15 top long-tail search phrases / queries. For each: phrase, search_volume_estimate, trend_direction.
- summary: 2-3 sentence executive summary of what is trending and why it matters.
- sources: list of source URLs or publications you used.

Base every volume and trend claim on real current evidence from web search. If you cannot verify an exact number, give a best-estimate range and set trend_direction to "stable". Never fabricate exact numeric search-volume figures — always use ranges.`;
}

function formatDigest(record) {
  const L = [];
  L.push("KEYWORD INTELLIGENCE REPORT");
  L.push(`Topic: ${record.topic}`);
  L.push(`Run: ${record.run_type} at ${record.run_at}`);
  L.push("");
  L.push(`SUMMARY: ${record.summary || "(no summary)"}`);
  L.push("");
  L.push("TOP WORDS:");
  (record.top_words || []).slice(0, 10).forEach((w, i) => {
    L.push(`${i + 1}. ${w.word} — ${w.search_volume_estimate || "?"} (${w.trend_direction}) [${w.category || "—"}]`);
  });
  L.push("");
  L.push("TOP CATEGORIES:");
  (record.top_categories || []).slice(0, 10).forEach((c, i) => {
    L.push(`${i + 1}. ${c.category} — ${c.search_volume_estimate || "?"} (${c.trend_direction})`);
  });
  L.push("");
  L.push("TOP PHRASES:");
  (record.top_phrases || []).slice(0, 10).forEach((p, i) => {
    L.push(`${i + 1}. ${p.phrase} — ${p.search_volume_estimate || "?"} (${p.trend_direction})`);
  });
  return L.join("\n");
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const started = Date.now();
  let body = {};
  try { body = await req.json(); } catch (_) {}
  const topic = (body.topic || "").trim();
  const triggeredBy = body.triggered_by === "scheduled" ? "scheduled" : "manual";
  const runType = topic ? "topic" : "broad";
  const label = topic || "General trending searches";

  try {
    const llm = await invokeLLM({
      prompt: buildPrompt(topic),
      add_context_from_internet: true,
      response_json_schema: RESPONSE_SCHEMA,
    });

    const now = new Date().toISOString();
    const record = await base44.asServiceRole.entities.KeywordIntelligence.create({
      topic: label,
      run_type: runType,
      top_words: llm.top_words || [],
      top_categories: llm.top_categories || [],
      top_phrases: llm.top_phrases || [],
      summary: llm.summary || "",
      sources: llm.sources || [],
      triggered_by: triggeredBy,
      run_at: now,
      alert_sent: false,
    });

    // Alert all admins (notification + email)
    let alertSent = false;
    try {
      const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" });
      const digest = formatDigest(record);
      for (const admin of admins) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            user_id: admin.id,
            type: "system",
            title: `Keyword Intelligence: ${label}`,
            body: digest.slice(0, 1000),
            link: "/keyword-intelligence",
          });
        } catch (_) {}
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Keyword Intelligence Report — ${label}`,
            body: digest,
          });
          alertSent = true;
        } catch (_) {}
      }
    } catch (_) {}

    try {
      await base44.asServiceRole.entities.KeywordIntelligence.update(record.id, { alert_sent: alertSent });
    } catch (_) {}

    return Response.json({
      ok: true,
      report_id: record.id,
      topic: label,
      run_type: runType,
      triggered_by: triggeredBy,
      alert_sent: alertSent,
      duration_ms: Date.now() - started,
      findings: {
        top_words: record.top_words,
        top_categories: record.top_categories,
        top_phrases: record.top_phrases,
        summary: record.summary,
        sources: record.sources,
      },
    });
  } catch (error) {
    const msg = String(error?.message || error);
    try {
      await base44.asServiceRole.entities.KeywordIntelligence.create({
        topic: label,
        run_type: runType,
        triggered_by: triggeredBy,
        run_at: new Date().toISOString(),
        alert_sent: false,
        error_message: msg,
        top_words: [],
        top_categories: [],
        top_phrases: [],
      });
    } catch (_) {}
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}