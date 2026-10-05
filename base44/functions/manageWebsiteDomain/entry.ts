import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { studioBuild } from '../../shared/studioWebsite.ts';
import { vercelRequest, resolveWebsiteProject } from '../../shared/websiteDeployment.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({error:'Sign in to manage website domains.'},{status:401});
    if (user.role !== 'admin') return Response.json({error:'Only administrators can connect website domains.'},{status:403});
    const body = await req.json();
    if (!['inspect','connect','verify'].includes(body.operation)) return Response.json({error:'Unsupported domain operation.'},{status:400});
    const build = await studioBuild(base44,user,body.build_id);
    if (!build.deployment_url && !build.result?.startsWith('https://')) return Response.json({error:'Publish the website before connecting a domain.'},{status:400});
    const domain = String(body.domain || build.custom_domain || '').trim().toLowerCase();
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) || domain.length > 253) return Response.json({error:'Enter a domain such as example.com, without https:// or a path.'},{status:400});
    const project = await resolveWebsiteProject(build);
    const path = '/v9/projects/' + encodeURIComponent(project) + '/domains';
    if (body.operation === 'connect') {
      await vercelRequest(path,{method:'POST',body:JSON.stringify({name:domain})});
      await base44.asServiceRole.entities.SystemBuild.update(build.id,{custom_domain:domain,domain_status:'pending',project_name:project});
    }
    if (body.operation === 'verify') await vercelRequest(path+'/'+encodeURIComponent(domain)+'/verify',{method:'POST'});
    const [details,config] = await Promise.all([vercelRequest(path+'/'+encodeURIComponent(domain)),vercelRequest('/v6/domains/'+encodeURIComponent(domain)+'/config?projectIdOrName='+encodeURIComponent(project))]);
    const records = (details.verification || []).map(v=>({type:v.type,name:v.domain,value:v.value}));
    const recommended = domain.split('.').length > 2 ? config.recommendedCNAME : config.recommendedIPv4;
    const target = recommended?.find(v=>v.rank===1) || recommended?.[0];
    const values = target ? (Array.isArray(target.value)?target.value:[target.value]) : [];
    records.push(...values.filter(Boolean).map(value=>({type:domain.split('.').length>2?'CNAME':'A',name:domain,value})));
    const connected = details.verified === true && config.misconfigured === false;
    await base44.asServiceRole.entities.SystemBuild.update(build.id,{domain_status:connected?'connected':'pending'});
    return Response.json({domain,status:connected?'connected':'pending',verified:details.verified===true,dns_configured:config.misconfigured===false,records});
  } catch(error) { return Response.json({error:error.message},{status:400}); }
}