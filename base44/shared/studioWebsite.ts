import { canAccessBuild } from './factoryAuth.ts';
import { secrets } from 'base44:runtime';
import { vercelRequest, encodeWebsiteFile } from './vercelApi.ts';
import { ensureStudioContact } from './websiteAssets.ts';

export function websiteUrl(build) {
  for (const value of [build.deployment_url, build.result, build.deliver_to]) {
    if (typeof value !== 'string') continue;
    try { const url = new URL(value); if (url.protocol === 'https:' && /^[a-z0-9-]+\.vercel\.app$/i.test(url.hostname)) return url.origin; } catch {}
  }
  return null;
}
export function validateHtml(value) {
  if (typeof value !== 'string' || value.length < 500 || new TextEncoder().encode(value).length > 180000 || !/<html\b/i.test(value) || !/<\/html>\s*$/i.test(value) || !/<body\b/i.test(value)) throw new Error('Provide a complete website document smaller than 180 KB.');
  return value;
}
export async function studioBuild(base44, user, id) {
  if (typeof id !== 'string' || !id || id.length > 100) throw new Error('Choose a website first.');
  const build = await base44.asServiceRole.entities.SystemBuild.get(id);
  if (!build || !canAccessBuild(user, build)) throw new Error('This website is not accessible to your account.');
  return build;
}
export async function storeWebsiteSource(base44, html) {
  validateHtml(html);
  const name='studio-source-'+secrets.get('BASE44_APP_ID').slice(-12).toLowerCase();
  let project;
  try { project=await vercelRequest('/v9/projects/'+name); } catch(error) {
    if(error.status!==404)throw error;
    project=await vercelRequest('/v11/projects',{method:'POST',body:JSON.stringify({name,framework:null,publicSource:false,outputDirectory:'public',ssoProtection:{deploymentType:'preview'}})});
  }
  if(!['preview','all','prod_deployment_urls_and_all_previews'].includes(project.ssoProtection?.deploymentType) || project.publicSource===true) throw new Error('Draft storage must have Vercel authentication enabled and public source access disabled. No draft was uploaded.');
  const deployment=await vercelRequest('/v13/deployments',{method:'POST',body:JSON.stringify({name,project:project.id,files:[{file:'private/website.html',data:encodeWebsiteFile(html),encoding:'base64'},{file:'public/index.html',data:'<!doctype html><html><body>Private website draft storage</body></html>'}],projectSettings:{framework:null,buildCommand:'',outputDirectory:'public'}})});
  const hash=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(html));
  const fileId=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
  return `vercel-source://${deployment.id}/${fileId}`;
}
export async function readWebsiteSource(base44, build) {
  const uri = build.studio_draft_uri || build.artifact_uri;
  if (uri?.startsWith('vercel-source://')) {
    const match=uri.match(/^vercel-source:\/\/(dpl_[a-zA-Z0-9]+)\/([a-f0-9]{40})$/);
    if(!match)throw new Error('The draft source reference is invalid.');
    const data=await vercelRequest('/v8/deployments/'+match[1]+'/files/'+match[2]);
    if(typeof data.data!=='string')throw new Error('The draft source is not available yet. Try opening it again.');
    return ensureStudioContact(validateHtml(new TextDecoder().decode(Uint8Array.from(atob(data.data),char=>char.charCodeAt(0)))));
  }
  if (uri) {
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: uri });
    const response = await fetch(signed_url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('The saved website source could not be opened.');
    return ensureStudioContact(validateHtml(await response.text()));
  }
  if (build.source_html) return ensureStudioContact(validateHtml(build.source_html));
  const url = websiteUrl(build);
  if (!url) throw new Error('This build has no website source yet. Create a website or generate this build first.');
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`The live website returned HTTP ${response.status}. Its source cannot be imported until it is accessible.`);
  return ensureStudioContact(validateHtml(await response.text()));
}
export function studioSettings(value = {}) {
  const result = {};
  for (const [key, max] of Object.entries({meta_title:200,meta_description:500,target_keywords:1000,competitors:1000,canonical_url:500})) {
    if (value[key] !== undefined) { if (typeof value[key] !== 'string' || value[key].length > max) throw new Error(`Invalid ${key.replaceAll('_',' ')}.`); result[key] = value[key]; }
  }
  if (result.canonical_url) { const url = new URL(result.canonical_url); if (url.protocol !== 'https:') throw new Error('The sitemap page URL must use HTTPS.'); }
  if (value.indexable !== undefined) result.indexable = value.indexable === true;
  return result;
}