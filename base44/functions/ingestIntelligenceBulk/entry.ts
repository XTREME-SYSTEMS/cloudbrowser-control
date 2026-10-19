import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// ═══════════════════════════════════════════════
// ASYNC BULK INTELLIGENCE INGESTION
// Processes large quantities of intelligence feeds in chunked batches
// with backpressure, deduplication, and progressive progress tracking.
//
// Input: {
//   feed_items?: array,    // Direct feed items to ingest
//   seed_batch_id?: string, // Ingest all pending seeds from a specific batch
//   limit?: number,        // Max items to process (default 500)
//   chunk_size?: number,   // Items per LLM call (default 10)
//   dedup?: boolean        // Skip duplicate artifacts by title (default true)
// }
// Output: { batch_id, total, processed, succeeded, failed, artifacts_created, duplicates_skipped, status }
// ═══════════════════════════════════════════════

const VISION_CORTEX_SYSTEM_PROMPT = `You are Vision Cortex — the intelligence core of a browser automation and data acquisition platform (Cloud Browser).

Your specialized purpose:
1. Analyze intelligence sources related to web scraping, data acquisition, browser automation, and anti-detection
2. Extract actionable insights, strategies, and playbooks that can be directly applied to improve the platform
3. Identify capability gaps in the current platform and recommend specific improvements
4. Learn from every source and build a compounding knowledge base

For each source you analyze, you must:
- Extract the core intelligence (what is this source teaching us?)
- Generate 3-5 concrete, actionable steps the platform should take
- Rate your confidence (0-100) and the potential impact (0-100)
- Connect this intelligence to the broader data acquisition landscape

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
    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { feed_items, seed_batch_id, limit = 500, chunk_size = 10, dedup = true } = body;

    // ── Gather items to process ──
    let items: any[] = [];
    let source: string = 'pending_seeds';
    let sourceRef: string = '';

    if (feed_items && Array.isArray(feed_items) && feed_items.length > 0) {
      items = feed_items;
      source = 'feed_items';
      sourceRef = `direct_${feed_items.length}_items`;
    } else if (seed_batch_id) {
      items = await sr.IntelligenceSeed.filter({ seed_batch: seed_batch_id, status: 'pending' }, '-priority', limit);
      source = 'seed_batch';
      sourceRef = seed_batch_id;
    } else {
      items = await sr.IntelligenceSeed.filter({ status: 'pending' }, '-priority', limit);
    }

    if (!items || items.length === 0) {
      return Response.json({
        batch_id: null,
        artifacts_created: 0,
        message: 'No items to ingest',
        status: 'empty',
      });
    }

    // ── Create batch record ──
    const batchId = `bulk-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const batch = await sr.IntelligenceIngestionBatch.create({
      batch_id: batchId,
      status: 'processing',
      source,
      source_ref: sourceRef,
      total_items: items.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      artifacts_created: 0,
      duplicates_skipped: 0,
      chunk_size,
      started_at: startedAt,
    });

    // ── Dedup: fetch existing artifact titles ──
    let existingTitles = new Set<string>();
    let duplicatesSkipped = 0;
    if (dedup) {
      try {
        const existing = await sr.IntelligenceArtifact.list('-created_date', 1000);
        for (const a of existing) {
          if (a.title) existingTitles.add(a.title.toLowerCase().trim());
        }
      } catch (e) {
        console.error('Dedup prefetch error:', e.message);
      }
    }

    // ── Process in chunks with backpressure ──
    const allArtifacts: any[] = [];
    let processed = 0, succeeded = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i += chunk_size) {
      const chunk = items.slice(i, i + chunk_size);

      try {
        const sourceSummaries = chunk.map((s: any) => ({
          id: s.id,
          title: s.title,
          type: s.source_type,
          category: s.intelligence_category,
          description: s.description,
          analysis: s.vision_cortex_analysis,
          url: s.url,
          rank: s.rank,
        }));

        const res = await invokeLLM({
          prompt: `${VISION_CORTEX_SYSTEM_PROMPT}

Analyze the following ${chunk.length} intelligence sources from the Cloud Browser intelligence feed. For EACH source, extract actionable intelligence and create artifacts.

Sources to analyze:
${JSON.stringify(sourceSummaries, null, 2)}

For each source, generate 1-3 IntelligenceArtifact objects. Each artifact must have:
- seed_id: The source ID (or index)
- artifact_type: One of "insight", "strategy", "playbook", "keyword_cluster", "trend_signal", "money_trail", "elite_motive", "competitive_gap", "capability_gap", "actionable_recommendation", "system_learning"
- title: Short unique title for the artifact
- content: The core intelligence (2-4 sentences)
- source_url: The source URL if available
- actionable_steps: 3-5 concrete steps the platform should take
- confidence_score: 0-100
- impact_score: 0-100 (potential impact on the platform)
- tags: 2-4 relevant tags

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

        const chunkArtifacts: any[] = [];
        for (const art of (res.artifacts || [])) {
          const title = (art.title || '').trim();
          if (!title) continue;

          // Dedup check
          if (dedup && existingTitles.has(title.toLowerCase())) {
            duplicatesSkipped++;
            continue;
          }
          existingTitles.add(title.toLowerCase());

          chunkArtifacts.push({
            seed_id: art.seed_id || '',
            artifact_type: art.artifact_type || 'insight',
            title,
            content: art.content || '',
            source_url: art.source_url || '',
            vision_cortex_analysis: art.content || '',
            actionable_steps: art.actionable_steps || [],
            confidence_score: art.confidence_score || 50,
            impact_score: art.impact_score || 50,
            ingest_batch: batchId,
            tags: art.tags || [],
            learned_at: new Date().toISOString(),
          });
        }

        // Bulk create artifacts
        if (chunkArtifacts.length > 0) {
          try {
            await sr.IntelligenceArtifact.bulkCreate(chunkArtifacts);
          } catch (e) {
            // Fallback: smaller sub-batches
            for (let j = 0; j < chunkArtifacts.length; j += 50) {
              try {
                await sr.IntelligenceArtifact.bulkCreate(chunkArtifacts.slice(j, j + 50));
              } catch (e2) {
                console.error('Artifact sub-batch error:', e2.message);
              }
            }
          }
        }

        allArtifacts.push(...chunkArtifacts);
        succeeded += chunk.length;

        // Mark seeds as ingested
        for (const s of chunk) {
          if (s.id) {
            try {
              await sr.IntelligenceSeed.update(s.id, {
                status: 'ingested',
                ingested_at: new Date().toISOString(),
              });
            } catch (_) {}
          }
        }
      } catch (e) {
        console.error('Chunk error at offset', i, ':', e.message);
        failed += chunk.length;
        errors.push(`Chunk ${i}-${i + chunk.length}: ${e.message}`);
        for (const s of chunk) {
          if (s.id) {
            try { await sr.IntelligenceSeed.update(s.id, { status: 'failed' }); } catch (_) {}
          }
        }
      }

      processed += chunk.length;

      // Update batch progress
      try {
        await sr.IntelligenceIngestionBatch.update(batch.id, {
          processed,
          succeeded,
          failed,
          artifacts_created: allArtifacts.length,
          duplicates_skipped: duplicatesSkipped,
        });
      } catch (_) {}

      // Backpressure: small delay between chunks (skip after last)
      if (i + chunk_size < items.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // ── Finalize batch ──
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(startedAt).getTime();
    const finalStatus = failed === 0 ? 'completed' : (succeeded > 0 ? 'partial' : 'failed');

    await sr.IntelligenceIngestionBatch.update(batch.id, {
      status: finalStatus,
      processed,
      succeeded,
      failed,
      artifacts_created: allArtifacts.length,
      duplicates_skipped: duplicatesSkipped,
      completed_at: completedAt,
      duration_ms: durationMs,
      errors: errors.slice(0, 20),
    });

    // Audit log
    try {
      await sr.AuditLog.create({
        action: 'bulk_ingest',
        entity_type: 'intelligence_ingestion_batch',
        entity_id: batchId,
        description: `Bulk intelligence ingestion ${finalStatus}: ${allArtifacts.length} artifacts from ${succeeded}/${items.length} items (${duplicatesSkipped} duplicates skipped)`,
        metadata: { batch_id: batchId, total: items.length, succeeded, failed, artifacts: allArtifacts.length, duplicates: duplicatesSkipped, duration_ms: durationMs },
        timestamp: completedAt,
      });
    } catch (_) {}

    return Response.json({
      batch_id: batchId,
      total: items.length,
      processed,
      succeeded,
      failed,
      artifacts_created: allArtifacts.length,
      duplicates_skipped: duplicatesSkipped,
      duration_ms: durationMs,
      status: finalStatus,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}