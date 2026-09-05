import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Vision Cortex Intelligence Ingestion
// Takes seeded intelligence sources and uses Vision Cortex (LLM) to deeply analyze,
// extract insights, strategies, and playbooks, and store them as IntelligenceArtifacts.
// Vision Cortex is optimized for browser automation and data acquisition.
//
// Input: { batch_id?: string, limit?: number }
// Output: { artifacts_created, artifacts_by_type, ingestion_summary }

const VISION_CORTEX_SYSTEM_PROMPT = `You are Vision Cortex — the intelligence core of a browser automation and data acquisition platform (Cloud Browser).

Your specialized purpose:
1. Analyze intelligence sources related to web scraping, data acquisition, browser automation, and anti-detection
2. Extract actionable insights, strategies, and playbooks that can be directly applied to improve the platform
3. Understand WHY elite corporations and governments are driving so hard for data — and what strategic advantages data control provides
4. Identify capability gaps in the current platform and recommend specific improvements
5. Learn from every source and build a compounding knowledge base

For each source you analyze, you must:
- Extract the core intelligence (what is this source teaching us?)
- Generate 3-5 concrete, actionable steps the platform should take
- Rate your confidence (0-100) and the potential impact (0-100)
- Connect this intelligence to the broader data acquisition landscape
- If the source reveals elite motives or money trails, analyze what they mean strategically

You think in systems: every piece of intelligence connects to capabilities, gaps, and money flows.
You think in playbooks: every strategy becomes a repeatable, step-by-step process.
You think in money: every data acquisition effort has a financial motive behind it.`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole.entities;
    const batchId = req.body?.batch_id;
    const limit = req.body?.limit || 50;

    // Get pending seeds
    let seeds;
    try {
      if (batchId) {
        seeds = await sr.IntelligenceSeed.filter({ seed_batch: batchId, status: 'pending' }, '-priority', limit);
      } else {
        seeds = await sr.IntelligenceSeed.filter({ status: 'pending' }, '-priority', limit);
      }
    } catch (e) {
      return Response.json({ error: 'Failed to fetch seeds: ' + e.message }, { status: 500 });
    }

    if (!seeds || seeds.length === 0) {
      return Response.json({ artifacts_created: 0, message: 'No pending seeds to ingest' });
    }

    const ingestBatch = `ingest-${Date.now()}`;
    const allArtifacts = [];

    // Process seeds in batches of 5 for efficiency
    for (let i = 0; i < seeds.length; i += 5) {
      const batch = seeds.slice(i, i + 5);

      const sourceSummaries = batch.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.source_type,
        category: s.intelligence_category,
        description: s.description,
        analysis: s.vision_cortex_analysis,
        url: s.url,
        rank: s.rank,
      }));

      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_SYSTEM_PROMPT}

Analyze the following ${batch.length} intelligence sources from the Cloud Browser intelligence seed system. For EACH source, extract actionable intelligence and create artifacts.

Sources to analyze:
${JSON.stringify(sourceSummaries, null, 2)}

For each source, generate 1-3 IntelligenceArtifact objects. Each artifact must have:
- seed_id: The source ID
- artifact_type: One of "insight", "strategy", "playbook", "keyword_cluster", "trend_signal", "money_trail", "elite_motive", "competitive_gap", "capability_gap", "actionable_recommendation", "system_learning"
- title: Short title for the artifact
- content: The core intelligence (2-4 sentences)
- source_url: The source URL if available
- actionable_steps: 3-5 concrete steps the platform should take
- confidence_score: 0-100
- impact_score: 0-100 (potential impact on the platform)
- tags: 2-4 relevant tags

Focus on extracting intelligence that helps Cloud Browser:
- Improve its scraping and data acquisition capabilities
- Understand anti-bot trends and bypass strategies
- Identify what data is most valuable and why
- Understand elite motives for data hoarding
- Track money flows in the data/AI space
- Learn new playbooks and strategies

Return as JSON: { "artifacts": [ { seed_id, artifact_type, title, content, source_url, actionable_steps, confidence_score, impact_score, tags } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              artifacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    seed_id: { type: 'string' },
                    artifact_type: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    source_url: { type: 'string' },
                    actionable_steps: { type: 'array', items: { type: 'string' } },
                    confidence_score: { type: 'number' },
                    impact_score: { type: 'number' },
                    tags: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        });

        for (const art of (res.artifacts || [])) {
          allArtifacts.push({
            seed_id: art.seed_id,
            artifact_type: art.artifact_type,
            title: art.title,
            content: art.content,
            source_url: art.source_url || '',
            vision_cortex_analysis: art.content,
            actionable_steps: art.actionable_steps || [],
            confidence_score: art.confidence_score || 50,
            impact_score: art.impact_score || 50,
            ingest_batch: ingestBatch,
            tags: art.tags || [],
            learned_at: new Date().toISOString(),
          });
        }

        // Mark seeds as ingested
        for (const s of batch) {
          try {
            await sr.IntelligenceSeed.update(s.id, {
              status: 'ingested',
              ingested_at: new Date().toISOString(),
            });
          } catch {}
        }
      } catch (e) {
        console.error('Ingestion batch error:', e.message);
        for (const s of batch) {
          try { await sr.IntelligenceSeed.update(s.id, { status: 'failed' }); } catch {}
        }
      }
    }

    // Bulk create artifacts
    let created = [];
    if (allArtifacts.length > 0) {
      try {
        created = await sr.IntelligenceArtifact.bulkCreate(allArtifacts);
      } catch (e) {
        for (let i = 0; i < allArtifacts.length; i += 50) {
          try {
            const batch = await sr.IntelligenceArtifact.bulkCreate(allArtifacts.slice(i, i + 50));
            created = created.concat(batch);
          } catch (e2) { console.error('Artifact batch error:', e2.message); }
        }
      }
    }

    // Count by type
    const byType = {};
    for (const a of allArtifacts) {
      byType[a.artifact_type] = (byType[a.artifact_type] || 0) + 1;
    }

    // Generate ingestion summary
    let summary = null;
    try {
      const summaryRes = await base44.integrations.Core.InvokeLLM({
        prompt: `${VISION_CORTEX_SYSTEM_PROMPT}

You just ingested ${allArtifacts.length} intelligence artifacts from ${seeds.length} sources for the Cloud Browser platform.

Artifact types breakdown: ${JSON.stringify(byType)}

Sample artifacts:
${JSON.stringify(allArtifacts.slice(0, 10).map(a => ({ type: a.artifact_type, title: a.title, impact: a.impact_score })), null, 2)}

Generate a brief ingestion summary (2-3 paragraphs) covering:
1. What key intelligence was learned
2. What patterns emerged across sources
3. What the platform should prioritize next

Return as JSON: { "summary": "string", "top_priority": "string", "emerging_pattern": "string" }`,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            top_priority: { type: 'string' },
            emerging_pattern: { type: 'string' },
          },
        },
      });
      summary = summaryRes;
    } catch {}

    return Response.json({
      artifacts_created: created.length,
      seeds_processed: seeds.length,
      artifacts_by_type: byType,
      ingest_batch: ingestBatch,
      ingestion_summary: summary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}