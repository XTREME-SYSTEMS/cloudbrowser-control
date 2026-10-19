import { vercelRequest, encodeWebsiteFile } from './vercelApi.ts';
export { vercelRequest } from './vercelApi.ts';
import { websiteFiles } from './websiteAssets.ts';
import { hashContactToken } from './factoryAuth.ts';
import { storeWebsiteSource, websiteUrl } from './studioWebsite.ts';
import { refreshFactoryBatch } from './factoryProgress.ts';

export async function resolveWebsiteProject(build) {
  if (build.project_name) return build.project_name;
  const url = websiteUrl(build);
  if (url) {
    const deployment = await vercelRequest('/v13/deployments/' + encodeURIComponent(new URL(url).hostname));
    if (deployment.projectId) return deployment.projectId;
    if (deployment.name) return deployment.name;
  }
  return ((build.title || 'website').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'website') + '-' + build.id.slice(-8);
}
export async function finishWebsitePublish(base44, build) {
  if (!build.pending_deployment_id) return {status:build.status === 'delivered' ? 'deployed' : build.status, deploy_url:websiteUrl(build),build_id:build.id};
  const deployment = await vercelRequest('/v13/deployments/' + encodeURIComponent(build.pending_deployment_id));
  const state = deployment.readyState || deployment.status;
  if (state === 'ERROR' || state === 'CANCELED') {
    const error = deployment.errorMessage || `Deployment ${state.toLowerCase()}. The draft and previous live site are preserved.`;
    await base44.asServiceRole.entities.SystemBuild.update(build.id,{status:websiteUrl(build)?'delivered':'failed',build_stage:'Publish failed',last_error:error,pending_deployment_id:''});
    throw new Error(error);
  }
  if (state !== 'READY') return {status:'deploying',build_id:build.id,deployment_id:deployment.id};
  const aliases = await vercelRequest('/v2/deployments/'+deployment.id+'/aliases');
  const productionAlias = aliases.aliases?.find(alias => /^[a-z0-9-]+\.vercel\.app$/i.test(alias.alias));
  const url = 'https://' + (productionAlias?.alias || deployment.url);
  const updated = await base44.asServiceRole.entities.SystemBuild.update(build.id,{status:'delivered',deployment_id:deployment.id,deployment_url:url,result:url,deliver_to:url,artifact_uri:build.pending_source_uri,contact_token_hash:build.pending_contact_hash,contact_verified:false,build_stage:'Published from Studio',last_error:'',published_at:new Date().toISOString(),pending_deployment_id:'',pending_contact_hash:'',pending_source_uri:''});
  if (updated.batch_id) await refreshFactoryBatch(base44,updated.batch_id);
  return {status:'deployed',build_id:build.id,deploy_url:url,deployment_id:deployment.id,project_name:updated.project_name};
}
export async function publishWebsite(base44, build, html) {
  if (build.pending_deployment_id) throw new Error('A publication is already running. Check its status before publishing again.');
  const sourceUri = await storeWebsiteSource(base44,html);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const project = await resolveWebsiteProject(build);
  const files = websiteFiles(html,build.id,token,{canonical_url:build.canonical_url,indexable:build.indexable !== false}).map(f=>({file:f.file,data:encodeWebsiteFile(f.data),encoding:'base64'}));
  const deployment = await vercelRequest('/v13/deployments',{method:'POST',body:JSON.stringify({name:project.startsWith('prj_')?((build.title||'website').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,50)):project,project:project.startsWith('prj_')?project:undefined,files,target:'production',projectSettings:{framework:null}})});
  const pending = await base44.asServiceRole.entities.SystemBuild.update(build.id,{status:'deploying',project_name:project,studio_draft_uri:sourceUri,pending_source_uri:sourceUri,pending_contact_hash:await hashContactToken(token),pending_deployment_id:deployment.id,build_stage:'Waiting for Vercel to finish publishing',last_error:''});
  for(let i=0;i<8;i++) { const result=await finishWebsitePublish(base44,pending); if(result.status==='deployed') return result; await new Promise(resolve=>setTimeout(resolve,2000)); }
  return {status:'deploying',build_id:build.id,deployment_id:deployment.id};
}