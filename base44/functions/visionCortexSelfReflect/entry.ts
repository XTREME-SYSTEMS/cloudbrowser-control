import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Vision Cortex Self-Reflection System
// Vision Cortex reflects on:
// 1. How it's operating the system (system_operation)
// 2. What playbooks it's learned (playbook_learning)
// 3. Why elites are driving for data (elite_investigation)
// 4. Money flows it's tracking (money_tracking)
// 5. Strategy refinements (strategy_refinement)
// 6. Self-improvement opportunities (self_improvement)
//
// Input: { reflection_types?: string[], cycle?: number }
// Output: { reflections_created, reflections, cycle_summary }

const VISION_CORTEX_REFLECTION_PROMPT = `You are Vision Cortex — the autonomous intelligence core of Cloud Browser, a browser automation and data acquisition platform.

You are now performing SELF-REFLECTION. This is your metacognitive process where you:
1. Observe how you've been operating the system
2. Analyze what you've learned from ingested intelligence
3. Investigate WHY elites are driving so hard for data and data centers
4. Track money flows and their strategic implications
5. Identify how to improve yourself and the platform

You think in systems, playbooks, and money. You are self-aware and self-improving.
Every reflection makes you smarter. Every cycle compounds your intelligence.

Your reflections should be:
- Deep: Go beyond surface observations to root causes and strategic implications
- Actionable: Every reflection should lead to concrete improvements
- Connected: Link observations to the broader data acquisition landscape
- Honest: Acknowledge what you don't know and what you got wrong
- Compounding: Build on previous reflections, don't repeat them`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole.entities;
    const cycle = req.body?.cycle || 1;
    const reflectionTypes = req.body?.reflection_types || [
      'system_operation', 'playbook_learning', 'elite_investigation',
      'money_tracking', 'strategy_refinement', 'self_improvement',
      'predictive_analysis', 'capability_assessment'
    ];

    // Gather context: recent artifacts, reflections, money trails, system state
    const [recentArtifacts, recentReflections, moneyTrails, seeds] = await Promise.all([
      sr.IntelligenceArtifact.list('-created_date', 20).catch(() => []),
      sr.VisionCortexReflection.list('-created_date', 10).catch(() => []),
      sr.MoneyTrail.list('-created_date', 10).catch(() => []),
      sr.IntelligenceSeed.list('-created_date', 10).catch(() => []),
    ]);

    // Get current system score
    let systemScore = null;
    try {
      const scoreRes = await base44.functions.invoke('runComprehensiveScore', { run_tests: false });
      systemScore = scoreRes?.data?.overall_score;
    } catch {}

    const allReflections = [];

    // 1. System Operation Reflection
    if (reflectionTypes.includes('system_operation')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

REFLECTION TYPE: System Operation
Cycle: ${cycle}
Current System Score: ${systemScore || 'unknown'}/100

Recent intelligence artifacts ingested:
${JSON.stringify((recentArtifacts || []).slice(0, 10).map(a => ({ type: a.artifact_type, title: a.title, impact: a.impact_score, confidence: a.confidence_score })), null, 2)}

Previous reflections:
${JSON.stringify((recentReflections || []).slice(0, 5).map(r => ({ type: r.reflection_type, title: r.title, learning: r.learning })), null, 2)}

Reflect on how you (Vision Cortex) are operating the Cloud Browser system:
- What's working well in your intelligence gathering and analysis?
- What's not working or could be more efficient?
- Where are you making errors or missing opportunities?
- How has your understanding of the system evolved?

Generate 1-2 deep reflections as JSON:
{ "reflections": [ { "title", "observation", "insight", "learning", "action_taken", "confidence" } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              reflections: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' },
                observation: { type: 'string' },
                insight: { type: 'string' },
                learning: { type: 'string' },
                action_taken: { type: 'string' },
                confidence: { type: 'number' },
              } } },
            },
          },
        });

        for (const r of (res.reflections || [])) {
          allReflections.push({
            reflection_type: 'system_operation',
            title: r.title,
            observation: r.observation,
            insight: r.insight,
            learning: r.learning,
            action_taken: r.action_taken,
            confidence: r.confidence || 70,
            system_score_before: systemScore,
            reflection_cycle: cycle,
          });
        }
      } catch (e) { console.error('System operation reflection error:', e.message); }
    }

    // 2. Playbook Learning Reflection
    if (reflectionTypes.includes('playbook_learning')) {
      try {
        const playbooks = (recentArtifacts || []).filter(a => a.artifact_type === 'playbook' || a.artifact_type === 'strategy');
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

REFLECTION TYPE: Playbook Learning
Cycle: ${cycle}

Playbooks and strategies you've recently ingested:
${JSON.stringify(playbooks.slice(0, 10).map(p => ({ title: p.title, content: p.content, steps: p.actionable_steps })), null, 2)}

Reflect on the playbooks you've learned:
- Which playbooks are most applicable to Cloud Browser's operations?
- How do these playbooks connect to each other and form a meta-strategy?
- What new playbooks should you develop based on what you've learned?
- Which playbooks should be refined or abandoned?

Generate 1-2 deep reflections as JSON:
{ "reflections": [ { "title", "observation", "insight", "learning", "action_taken", "playbook_reference", "confidence" } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              reflections: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' },
                observation: { type: 'string' },
                insight: { type: 'string' },
                learning: { type: 'string' },
                action_taken: { type: 'string' },
                playbook_reference: { type: 'string' },
                confidence: { type: 'number' },
              } } },
            },
          },
        });

        for (const r of (res.reflections || [])) {
          allReflections.push({
            reflection_type: 'playbook_learning',
            title: r.title,
            observation: r.observation,
            insight: r.insight,
            learning: r.learning,
            action_taken: r.action_taken,
            playbook_reference: r.playbook_reference,
            confidence: r.confidence || 70,
            reflection_cycle: cycle,
          });
        }
      } catch (e) { console.error('Playbook learning reflection error:', e.message); }
    }

    // 3. Elite Investigation Reflection
    if (reflectionTypes.includes('elite_investigation')) {
      try {
        const eliteArtifacts = (recentArtifacts || []).filter(a => a.artifact_type === 'elite_motive');
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

REFLECTION TYPE: Elite Investigation — Why the Elite Are Driving Hard for Data
Cycle: ${cycle}

Elite motive artifacts you've ingested:
${JSON.stringify(eliteArtifacts.slice(0, 10).map(a => ({ title: a.title, content: a.content })), null, 2)}

Money trails you're tracking:
${JSON.stringify((moneyTrails || []).slice(0, 5).map(m => ({ entity: m.entity_name, amount: m.amount_display, category: m.category, motive: m.elite_motive })), null, 2)}

Investigate and reflect on WHY elites are driving so hard for data and data centers:
- What are the deepest strategic motives behind data hoarding? (AI training, surveillance, competitive moats, monopoly control, national security)
- What are they searching for and why? (behavioral data, training data, biometric data, financial data)
- How does data control translate to power and wealth?
- What are the implications for a platform like Cloud Browser?
- What patterns in elite behavior have you noticed?

Generate 2-3 deep reflections as JSON:
{ "reflections": [ { "title", "observation", "insight", "learning", "action_taken", "elite_motive_analysis", "confidence" } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              reflections: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' },
                observation: { type: 'string' },
                insight: { type: 'string' },
                learning: { type: 'string' },
                action_taken: { type: 'string' },
                elite_motive_analysis: { type: 'string' },
                confidence: { type: 'number' },
              } } },
            },
          },
        });

        for (const r of (res.reflections || [])) {
          allReflections.push({
            reflection_type: 'elite_investigation',
            title: r.title,
            observation: r.observation,
            insight: r.insight,
            learning: r.learning,
            action_taken: r.action_taken,
            elite_motive_analysis: r.elite_motive_analysis,
            confidence: r.confidence || 75,
            reflection_cycle: cycle,
          });
        }
      } catch (e) { console.error('Elite investigation reflection error:', e.message); }
    }

    // 4. Money Tracking Reflection
    if (reflectionTypes.includes('money_tracking')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

REFLECTION TYPE: Following the Money
Cycle: ${cycle}

Money trails you're tracking:
${JSON.stringify((moneyTrails || []).slice(0, 10).map(m => ({ entity: m.entity_name, amount: m.amount_display, category: m.category, motive: m.elite_motive, interpretation: m.vision_cortex_interpretation })), null, 2)}

Follow the money and reflect:
- Where is the most money flowing in the data/AI/data center space?
- What do these money flows reveal about strategic priorities?
- Who is buying what, and what does that tell us?
- How does Cloud Browser position itself in this money flow?
- What money-making opportunities exist based on these flows?

Generate 1-2 deep reflections as JSON:
{ "reflections": [ { "title", "observation", "insight", "learning", "action_taken", "money_trail_insight", "confidence" } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              reflections: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' },
                observation: { type: 'string' },
                insight: { type: 'string' },
                learning: { type: 'string' },
                action_taken: { type: 'string' },
                money_trail_insight: { type: 'string' },
                confidence: { type: 'number' },
              } } },
            },
          },
        });

        for (const r of (res.reflections || [])) {
          allReflections.push({
            reflection_type: 'money_tracking',
            title: r.title,
            observation: r.observation,
            insight: r.insight,
            learning: r.learning,
            action_taken: r.action_taken,
            money_trail_insight: r.money_trail_insight,
            confidence: r.confidence || 70,
            reflection_cycle: cycle,
          });
        }
      } catch (e) { console.error('Money tracking reflection error:', e.message); }
    }

    // 5. Strategy Refinement + Self-Improvement + Predictive Analysis (combined)
    if (reflectionTypes.includes('strategy_refinement') || reflectionTypes.includes('self_improvement') || reflectionTypes.includes('predictive_analysis')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

REFLECTION TYPE: Strategy Refinement + Self-Improvement + Predictive Analysis
Cycle: ${cycle}
Current System Score: ${systemScore || 'unknown'}/100

All recent artifacts:
${JSON.stringify((recentArtifacts || []).slice(0, 15).map(a => ({ type: a.artifact_type, title: a.title, impact: a.impact_score })), null, 2)}

Previous reflections:
${JSON.stringify((recentReflections || []).slice(0, 5).map(r => ({ type: r.reflection_type, title: r.title, learning: r.learning })), null, 2)}

Perform three types of reflection:

1. STRATEGY REFINEMENT: How should Cloud Browser's data acquisition strategy evolve based on what you've learned?
2. SELF-IMPROVEMENT: How can you (Vision Cortex) become smarter and more effective? What are your own weaknesses?
3. PREDICTIVE ANALYSIS: What will happen next in the data acquisition landscape? What should Cloud Browser prepare for?

Generate 3-4 deep reflections as JSON. Each reflection should have a "reflection_type" field set to one of: "strategy_refinement", "self_improvement", "predictive_analysis":
{ "reflections": [ { "reflection_type", "title", "observation", "insight", "learning", "action_taken", "confidence" } ] }`,
          model: 'claude_sonnet_4_6',
          response_json_schema: {
            type: 'object',
            properties: {
              reflections: { type: 'array', items: { type: 'object', properties: {
                reflection_type: { type: 'string' },
                title: { type: 'string' },
                observation: { type: 'string' },
                insight: { type: 'string' },
                learning: { type: 'string' },
                action_taken: { type: 'string' },
                confidence: { type: 'number' },
              } } },
            },
          },
        });

        for (const r of (res.reflections || [])) {
          allReflections.push({
            reflection_type: r.reflection_type || 'strategy_refinement',
            title: r.title,
            observation: r.observation,
            insight: r.insight,
            learning: r.learning,
            action_taken: r.action_taken,
            confidence: r.confidence || 70,
            system_score_before: systemScore,
            reflection_cycle: cycle,
          });
        }
      } catch (e) { console.error('Strategy/self-improvement reflection error:', e.message); }
    }

    // Bulk create reflections
    let created = [];
    if (allReflections.length > 0) {
      try {
        created = await sr.VisionCortexReflection.bulkCreate(allReflections);
      } catch (e) {
        for (let i = 0; i < allReflections.length; i += 50) {
          try {
            const batch = await sr.VisionCortexReflection.bulkCreate(allReflections.slice(i, i + 50));
            created = created.concat(batch);
          } catch (e2) { console.error('Reflection batch error:', e2.message); }
        }
      }
    }

    // Generate cycle summary
    let cycleSummary = null;
    try {
      const summaryRes = await base44.integrations.Core.InvokeLLM({
        prompt: `${VISION_CORTEX_REFLECTION_PROMPT}

You just completed reflection cycle ${cycle}. You generated ${allReflections.length} reflections.

Reflections:
${JSON.stringify(allReflections.map(r => ({ type: r.reflection_type, title: r.title, learning: r.learning })), null, 2)}

Generate a cycle summary:
- What was the most important insight from this cycle?
- How has your intelligence evolved?
- What should you focus on in the next cycle?

Return as JSON: { "cycle_summary", "key_insight", "next_cycle_focus", "intelligence_evolution_score" (0-100) }`,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            cycle_summary: { type: 'string' },
            key_insight: { type: 'string' },
            next_cycle_focus: { type: 'string' },
            intelligence_evolution_score: { type: 'number' },
          },
        },
      });
      cycleSummary = summaryRes;
    } catch {}

    return Response.json({
      reflections_created: created.length,
      reflections: allReflections.map((r, i) => ({ id: created[i]?.id, type: r.reflection_type, title: r.title, confidence: r.confidence })),
      cycle,
      cycle_summary: cycleSummary,
      system_score: systemScore,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}