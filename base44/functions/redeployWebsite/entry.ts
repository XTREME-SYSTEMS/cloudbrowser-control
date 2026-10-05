import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { requireFactoryExecutor } from '../../shared/factoryAuth.ts';
import { studioBuild, readWebsiteSource, studioSettings, validateHtml } from '../../shared/studioWebsite.ts';
import { publishWebsite, finishWebsitePublish } from '../../shared/websiteDeployment.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await requireFactoryExecutor(base44, body);

    const build = await studioBuild(base44,user,body.build_id);
    if (body.operation === 'status') return Response.json(await finishWebsitePublish(base44,build));
    const html = body.html ? validateHtml(body.html) : await readWebsiteSource(base44,build);
    const settings = studioSettings(body.settings || body);
    const updated = await base44.asServiceRole.entities.SystemBuild.update(build.id,{...settings,owner_id:build.owner_id || (build.created_by_id && !build.created_by_id.startsWith('service_') ? build.created_by_id : user.id)});
    return Response.json(await publishWebsite(base44,updated,html));
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status || 400 });
  }
}