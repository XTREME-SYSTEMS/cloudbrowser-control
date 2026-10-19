import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Full lifecycle orchestrator: takes an engagement, runs the 12-step discovery pipeline,
// generates the build spec, and progresses the engagement through every factory stage.
// Called after onboarding completes. Updates engagement status live as it progresses.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { engagement_id } = body;
    if (!engagement_id) return Response.json({ error: 'engagement_id required' }, { status: 400 });

    const engagement = await base44.entities.ClientEngagement.get(engagement_id);
    if (!engagement) return Response.json({ error: 'Engagement not found' }, { status: 404 });

    const log = async (stage, status, message) => {
      const fresh = await base44.entities.ClientEngagement.get(engagement_id);
      await base44.entities.ClientEngagement.update(engagement_id, {
        factory_stage_log: [
          ...(fresh.factory_stage_log || []),
          { stage, status, timestamp: new Date().toISOString(), message: message || '' }
        ]
      });
    };

    // Stage 1: Create/link intelligence pipeline
    let pipeline = null;
    if (engagement.pipeline_id) {
      try { pipeline = await base44.entities.IntelligencePipeline.get(engagement.pipeline_id); } catch (e) {}
    }
    if (!pipeline) {
      pipeline = await base44.entities.IntelligencePipeline.create({
        industry: engagement.industry,
        target_market: engagement.target_market,
        goals: engagement.business_goals,
        budget_range: engagement.budget_range,
        timeline: engagement.timeline,
        geo_focus: engagement.geo_focus,
        status: 'running',
        current_step: 1,
        total_steps: 12,
        step_results: {}
      });
      await base44.entities.ClientEngagement.update(engagement_id, { pipeline_id: pipeline.id });
    }
    const pipelineId = pipeline.id;
    const ctx = { industry: engagement.industry, target_market: engagement.target_market, goals: engagement.business_goals, geo_focus: engagement.geo_focus, budget_range: engagement.budget_range, pipeline_id: pipelineId };

    await base44.entities.ClientEngagement.update(engagement_id, { factory_status: 'discovery', factory_progress: 10 });
    await log('discovery', 'started', 'Intelligence pipeline initialized');

    // Helper to run a step and capture results
    const runStep = async (stepNum, stepName, fn) => {
      try {
        await log(stepName, 'running', `Step ${stepNum} started`);
        const result = await fn();
        // Save step result to pipeline
        const freshPipeline = await base44.entities.IntelligencePipeline.get(pipelineId);
        await base44.entities.IntelligencePipeline.update(pipelineId, {
          current_step: stepNum,
          step_results: { ...(freshPipeline.step_results || {}), [stepNum]: { status: 'complete', data: result, completed_at: new Date().toISOString() } }
        });
        await log(stepName, 'complete', `Step ${stepNum} complete`);
        return result;
      } catch (e) {
        await log(stepName, 'error', `Step ${stepNum} failed: ${e.message}`);
        return null;
      }
    };

    // Steps 2-12: Run discovery pipeline (parallelizable groups run together)
    // Group A: Independent scans (steps 2, 3, 5, 6) — run in parallel
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 20 });

    const [demand, social, buyers, competitors] = await Promise.allSettled([
      runStep(2, 'national_demand', () => base44.functions.invoke('runNationalDemandMap', { pipeline_id: pipelineId }).then(r => r.data || r)),
      runStep(3, 'social_scan', () => base44.functions.invoke('runSocialMediaScan', { industry: ctx.industry, target_market: ctx.target_market, pipeline_id: pipelineId }).then(r => r.data || r)),
      runStep(5, 'buyer_profiles', () => base44.functions.invoke('architectProductIdea', { industry: ctx.industry, target_market: ctx.target_market }).then(r => r.data || r)),
      runStep(6, 'competitor_intel', () => base44.functions.invoke('scrapeSimilarSystems', { query: ctx.industry, target_market: ctx.target_market }).then(r => r.data || r)),
    ]);

    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 40 });

    // Group B: Sequential dependent steps (7, 8, 9, 10, 11, 12)
    await runStep(7, 'skip_trace', () => base44.functions.invoke('runBatchSkipTrace', { industry: ctx.industry, target_market: ctx.target_market }).then(r => r.data || r));
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 50 });

    await runStep(8, 'strategy_simulation', () => base44.functions.invoke('runStrategySimulation', { industry: ctx.industry, goals: ctx.goals, target_market: ctx.target_market, budget_range: ctx.budget_range, pipeline_id: pipelineId }).then(r => r.data || r));
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 60 });

    const brandResult = await runStep(9, 'brand_generation', () => base44.functions.invoke('runBrandGenerator', { industry: ctx.industry, target_market: ctx.target_market, pipeline_id: pipelineId }).then(r => r.data || r));
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 70 });

    await runStep(10, 'sales_assets', () => base44.functions.invoke('runSalesAssetGenerator', { industry: ctx.industry, target_market: ctx.target_market, pipeline_id: pipelineId }).then(r => r.data || r));
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 80 });

    await runStep(11, 'builders_docs', () => base44.functions.invoke('runBuildersDocCompiler', { pipeline_id: pipelineId }).then(r => r.data || r));
    await runStep(12, 'google_sync', () => base44.functions.invoke('runGoogleIntelSync', { pipeline_id: pipelineId }).then(r => r.data || r).catch(() => ({ skipped: true })));

    // Mark pipeline complete
    await base44.entities.IntelligencePipeline.update(pipelineId, { status: 'complete', current_step: 12 });
    await base44.entities.ClientEngagement.update(engagement_id, { factory_progress: 85 });
    await log('discovery', 'complete', 'All 12 discovery steps complete');

    // Generate build spec
    await base44.entities.ClientEngagement.update(engagement_id, { factory_status: 'spec_ready', factory_progress: 88 });
    await log('spec_generation', 'running', 'Generating machine-readable build spec');

    try {
      const specRes = await base44.functions.invoke('generateBuildSpec', { engagement_id, pipeline_id: pipelineId });
      const spec = specRes.data?.spec || specRes.data || specRes;
      await base44.entities.ClientEngagement.update(engagement_id, {
        build_spec: spec,
        build_spec_version: new Date().toISOString(),
        factory_status: 'building',
        factory_progress: 90
      });
      await log('spec_generation', 'complete', 'Build spec generated and ready for coding agent');
    } catch (e) {
      await log('spec_generation', 'error', `Build spec failed: ${e.message}`);
      await base44.entities.ClientEngagement.update(engagement_id, { factory_status: 'failed', factory_progress: 88 });
      return Response.json({ error: 'Build spec generation failed', detail: e.message }, { status: 500 });
    }

    // The coding agent (external, via factorySync) takes over from here.
    // It will call update_factory_status as it builds, QA validates, and deploys.
    await log('handoff', 'complete', 'Discovery complete. Build spec ready. Awaiting autonomous coding agent.');
    await base44.entities.ClientEngagement.update(engagement_id, { factory_status: 'building', factory_progress: 90 });

    return Response.json({
      ok: true,
      engagement_id,
      pipeline_id: pipelineId,
      factory_status: 'building',
      factory_progress: 90,
      message: 'Discovery pipeline complete. Build spec generated. Awaiting coding agent handoff via factorySync.'
    });
  } catch (error) {
    console.error('runClientLifecycle error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}