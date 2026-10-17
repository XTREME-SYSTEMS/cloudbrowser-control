import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Bidirectional JSON sync endpoint for ChatGPT / external orchestrator
// Actions: start_engagement, get_status, get_build_spec, update_factory_status, list_engagements, submit_review
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // Authenticate — allow service role for factory agents, or user auth for dashboard
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // Service role invocation — validate via WORKER_SECRET
      if (body.sync_secret !== process.env.WORKER_SECRET) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    switch (action) {
      case 'start_engagement': {
        // ChatGPT pushes client intake data → creates engagement + kicks off discovery pipeline
        const { client_name, client_email, client_company, industry, target_market, geo_focus, goals, budget_range, timeline, success_metrics, brand_preferences, competitor_urls, differentiators } = body;
        if (!client_name || !client_email || !industry) {
          return Response.json({ error: 'client_name, client_email, industry required' }, { status: 400 });
        }

        const token = crypto.randomUUID();
        const engagement = await base44.asServiceRole.entities.ClientEngagement.create({
          client_name, client_email, client_company,
          industry, target_market, geo_focus,
          business_goals: goals, budget_range, timeline,
          success_metrics: success_metrics || [],
          brand_preferences: brand_preferences || {},
          competitor_urls: competitor_urls || [],
          differentiators,
          factory_status: 'discovery',
          factory_progress: 5,
          client_portal_token: token,
          status: 'active',
          factory_stage_log: [{ stage: 'intake', status: 'complete', timestamp: new Date().toISOString(), message: 'Engagement created via factory sync' }]
        });

        // Kick off intelligence pipeline
        const pipeline = await base44.asServiceRole.entities.IntelligencePipeline.create({
          industry, target_market, goals, budget_range, timeline, geo_focus,
          status: 'running', current_step: 1, total_steps: 12, step_results: {}
        });

        await base44.asServiceRole.entities.ClientEngagement.update(engagement.id, { pipeline_id: pipeline.id });

        return Response.json({
          ok: true,
          engagement_id: engagement.id,
          pipeline_id: pipeline.id,
          portal_token: token,
          portal_url: `/client-delivery?token=${token}`
        });
      }

      case 'get_status': {
        const { engagement_id } = body;
        if (!engagement_id) return Response.json({ error: 'engagement_id required' }, { status: 400 });
        const engagement = await base44.asServiceRole.entities.ClientEngagement.get(engagement_id);
        return Response.json({
          ok: true,
          factory_status: engagement.factory_status,
          factory_progress: engagement.factory_progress,
          deployment_url: engagement.deployment_url,
          preview_url: engagement.preview_url,
          review_status: engagement.review_status,
          stage_log: engagement.factory_stage_log || []
        });
      }

      case 'get_build_spec': {
        const { engagement_id } = body;
        if (!engagement_id) return Response.json({ error: 'engagement_id required' }, { status: 400 });
        const engagement = await base44.asServiceRole.entities.ClientEngagement.get(engagement_id);
        if (!engagement.build_spec) {
          return Response.json({ error: 'Build spec not generated yet', factory_status: engagement.factory_status }, { status: 404 });
        }
        return Response.json({
          ok: true,
          spec: engagement.build_spec,
          spec_version: engagement.build_spec_version,
          factory_status: engagement.factory_status
        });
      }

      case 'update_factory_status': {
        const { engagement_id, factory_status, progress, message, deployment_url, preview_url, supabase_ref, railway_id, vercel_id, github_repo } = body;
        if (!engagement_id || !factory_status) return Response.json({ error: 'engagement_id, factory_status required' }, { status: 400 });

        const engagement = await base44.asServiceRole.entities.ClientEngagement.get(engagement_id);
        const update = {
          factory_status,
          factory_progress: progress ?? engagement.factory_progress,
          factory_stage_log: [
            ...(engagement.factory_stage_log || []),
            { stage: factory_status, status: 'update', timestamp: new Date().toISOString(), message: message || '' }
          ]
        };
        if (deployment_url) update.deployment_url = deployment_url;
        if (preview_url) update.preview_url = preview_url;
        if (supabase_ref) update.supabase_ref = supabase_ref;
        if (railway_id) update.railway_id = railway_id;
        if (vercel_id) update.vercel_id = vercel_id;
        if (github_repo) update.github_repo = github_repo;

        await base44.asServiceRole.entities.ClientEngagement.update(engagement_id, update);
        return Response.json({ ok: true, factory_status, progress: update.factory_progress });
      }

      case 'list_engagements': {
        const { status } = body;
        const query = status ? { status } : {};
        const { items } = await base44.asServiceRole.entities.ClientEngagement.filter(query, { sort: '-created_date', limit: 50, fields: ['client_name', 'client_company', 'industry', 'factory_status', 'factory_progress', 'deployment_url', 'created_date'] });
        return Response.json({ ok: true, engagements: items });
      }

      case 'submit_review': {
        const { engagement_id, review_status, notes, rating, testimonial } = body;
        if (!engagement_id) return Response.json({ error: 'engagement_id required' }, { status: 400 });
        const engagement = await base44.asServiceRole.entities.ClientEngagement.get(engagement_id);
        const update = {
          review_status: review_status || engagement.review_status,
          review_notes: notes || engagement.review_notes,
          factory_stage_log: [
            ...(engagement.factory_stage_log || []),
            { stage: 'client_review', status: review_status, timestamp: new Date().toISOString(), message: notes || '' }
          ]
        };
        if (rating) update.rating = rating;
        if (testimonial) update.testimonial = testimonial;
        if (review_status === 'approved') {
          update.factory_status = 'delivered';
          update.handoff_date = new Date().toISOString();
          update.factory_progress = 100;
        }
        await base44.asServiceRole.entities.ClientEngagement.update(engagement_id, update);
        return Response.json({ ok: true, review_status: update.review_status });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}. Supported: start_engagement, get_status, get_build_spec, update_factory_status, list_engagements, submit_review` }, { status: 400 });
    }
  } catch (error) {
    console.error('factorySync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}