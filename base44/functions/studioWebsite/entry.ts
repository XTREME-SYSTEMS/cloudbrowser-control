import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { studioBuild, readWebsiteSource, storeWebsiteSource, studioSettings } from '../../shared/studioWebsite.ts';
import { prepareWebsite } from '../../shared/websiteAssets.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({error:'Sign in to open the Studio.'},{status:401});
    if (user.role !== 'admin') return Response.json({error:'Only administrators can edit and publish websites.'},{status:403});
    const body = await req.json();
    const operation = body.operation || 'load';
    const db = base44.asServiceRole.entities;
    if (operation === 'create') {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 150) return Response.json({error:'Enter a website name of up to 150 characters.'},{status:400});
      const build = await db.SystemBuild.create({title:body.title.trim(),build_type:'website',what_to_build:String(body.brief||body.title).slice(0,4000),owner_id:user.id,status:'spec_submitted',build_stage:'Draft'});
      const html = prepareWebsite(body.html,build.id);
      const uri = await storeWebsiteSource(base44,html);
      const site = await db.SystemBuild.update(build.id,{studio_draft_uri:uri,draft_saved_at:new Date().toISOString()});
      return Response.json({site,html});
    }
    const build = await studioBuild(base44,user,body.build_id);
    if (operation === 'load') {
      const html = await readWebsiteSource(base44,build);
      const {source_html,contact_token_hash,pending_contact_hash,...site} = build;
      return Response.json({site,html});
    }
    if (operation === 'save') {
      const uri = await storeWebsiteSource(base44,body.html);
      const site = await db.SystemBuild.update(build.id,{studio_draft_uri:uri,draft_saved_at:new Date().toISOString(),owner_id:build.owner_id || (build.created_by_id && !build.created_by_id.startsWith('service_') ? build.created_by_id : user.id),...studioSettings(body.settings)});
      return Response.json({site,saved:true});
    }
    return Response.json({error:'Unsupported Studio operation.'},{status:400});
  } catch(error) { return Response.json({error:error.message},{status:400}); }
}