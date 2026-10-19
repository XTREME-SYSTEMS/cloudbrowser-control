import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { callAI } from '../../shared/aiRouter.ts';
import { prepareWebsite } from '../../shared/websiteAssets.ts';
import { requireFactoryExecutor } from '../../shared/factoryAuth.ts';
import { storeWebsiteSource } from '../../shared/studioWebsite.ts';
import { publishWebsite } from '../../shared/websiteDeployment.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await requireFactoryExecutor(base44, body);

    const niche = (body.niche || '').trim() || 'local business';
    const style = (body.style || '').trim() || 'modern professional';
    const businessName = (body.business_name || '').trim();
    const buildId = typeof body.build_id === 'string' ? body.build_id : null;
    const batchId = typeof body.batch_id === 'string' ? body.batch_id : null;

    const db = base44.asServiceRole.entities;
    let build = buildId ? await db.SystemBuild.get(buildId).catch(() => null) : null;

    if (build && user.role !== 'admin' && build.created_by_id !== user.id && build.owner_id !== user.id) {
      return Response.json({ error: 'You do not own this build.' }, { status: 403 });
    }

    const ownerId = build?.owner_id || user.id || null;

    if (niche.length > 4000 || style.length > 500 || businessName.length > 150) return Response.json({error:'The website brief is too long.'},{status:400});
    if (!build) build = await db.SystemBuild.create({title:businessName || `${niche.slice(0,120)} website`,build_type:'website',what_to_build:niche,owner_id:ownerId,batch_id:batchId || undefined,status:'building'});
    await db.SystemBuild.update(build.id, { status: 'building', build_stage: 'Generating website via AI Gateway', last_error: '' });

    const systemPrompt = 'You are an elite front-end developer and web designer. You generate complete, production-ready, self-contained HTML websites with embedded CSS and JavaScript. You return ONLY raw HTML code — no markdown, no code fences, no explanation, no commentary. The output must start with <!DOCTYPE html> and end with </html>.';

    const userPrompt = `Generate a complete, beautiful, fully responsive single-page website for a ${niche} business.${businessName ? ` The business name is "${businessName}".` : ''} Design style: ${style}.

Requirements — every one of these MUST be in the output:
1. Complete HTML5 document: <!DOCTYPE html>, <html lang="en">, <head> with charset, viewport meta, title (50-60 chars), meta description (150-160 chars), Open Graph tags, JSON-LD LocalBusiness schema markup.
2. Google Fonts via <link> in <head>.
3. All CSS in a single <style> tag in <head> — modern, clean, professional. CSS custom properties for the color palette. Mobile-first responsive. Smooth transitions and subtle hover effects. No external CSS files.
4. Sticky navigation bar with logo text, nav links (Home, Services, About, Contact), and a hamburger menu for mobile (vanilla JS toggle).
5. Hero section: full-viewport-height background with a compelling headline, subheadline, and a prominent CTA button. CSS gradient background.
6. Services section: 3-4 cards with inline SVG icons, titles, and descriptions specific to a ${niche} business.
7. About section: 2-column layout with text and a visual element.
8. Testimonials section: 2-3 customer quotes with names and inline SVG star ratings.
9. Contact section: a contact form (name, email, phone, message) with labels and a submit button, plus business hours and contact info.
10. Footer: copyright, quick links, inline SVG social icons.
11. All JavaScript in a <script> tag before </body> — hamburger toggle, smooth scroll, form validation, scroll-triggered fade-in via IntersectionObserver.
12. All content specific to a ${niche} business — real-sounding service names, realistic testimonials, actual business hours. No "Lorem ipsum".
13. The page must look polished at every viewport from 320px to 1920px.

Return ONLY the complete HTML file. Start with <!DOCTYPE html> and end with </html>. No markdown fences, no explanation.`;

    const vercelKey = secrets.get('VERCEL_AI_GATEWAY_API_KEY') || secrets.get('AI_GATEWAY_API_KEY');
    let rawHtml;
    let provider = 'vercel_ai_gateway';
    let model = 'openai/gpt-4o';
    try {
      const ai = await callAI(base44, {
        vercelKey,
        taskType: 'code_generation',
        systemPrompt,
        userPrompt,
        timeoutMs: 90000,
      });
      rawHtml = ai.result;
      provider = ai.provider;
      model = ai.model;
    } catch (e) {
      if (build) await db.SystemBuild.update(build.id, { status: 'failed', last_error: `AI generation failed: ${e.message}`.slice(0, 1500) });
      return Response.json({ error: `Website generation failed: ${e.message}` }, { status: 502 });
    }

    const html = prepareWebsite(rawHtml,build.id);
    const uri = await storeWebsiteSource(base44,html);
    const updated = await db.SystemBuild.update(build.id,{studio_draft_uri:uri,draft_saved_at:new Date().toISOString(),ai_provider:provider,ai_model:model,how_it_looks:style,build_stage:'Draft ready',status:'spec_submitted'});
    if (body.draft_only === true) return Response.json({build_id:build.id,status:'draft_ready',ai_provider:provider,ai_model:model});
    const result = await publishWebsite(base44,updated,html);
    return Response.json({...result,niche,style,business_name:businessName,ai_provider:provider,ai_model:model});
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}