import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { studioBuild, websiteUrl } from '../../shared/studioWebsite.ts';

function attribute(tag,name) { return tag?.match(new RegExp('\\b'+name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1] || ''; }
async function inspectUrl(url) {
  const response = await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});
  const text = (await response.text()).slice(0,200000);
  return {ok:response.ok,status:response.status,text,noindex:/noindex/i.test(response.headers.get('x-robots-tag')||'')};
}
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({error:'Sign in to audit a website.'},{status:401});
    if (user.role !== 'admin') return Response.json({error:'Only administrators can audit managed websites.'},{status:403});
    const body = await req.json();
    const build = await studioBuild(base44,user,body.build_id);
    const url = websiteUrl(build);
    if (!url) return Response.json({error:'Publish the website before running a live SEO audit.'},{status:400});
    const [page,robots,sitemap] = await Promise.all([inspectUrl(url),inspectUrl(url+'/robots.txt'),inspectUrl(url+'/sitemap.xml')]);
    const title = page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const tags = page.text.match(/<meta\b[^>]*>/gi)||[];
    const description = attribute(tags.find(t=>attribute(t,'name').toLowerCase()==='description'),'content');
    const robotsMeta = attribute(tags.find(t=>attribute(t,'name').toLowerCase()==='robots'),'content');
    const blocked = page.noindex || /noindex/i.test(robotsMeta) || /disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots.text);
    const images = page.text.match(/<img\b[^>]*>/gi)||[];
    const checks = [
      {label:'Public page',passed:page.ok,detail:'HTTP '+page.status},
      {label:'Search title',passed:title.length>=10&&title.length<=70,detail:title?`${title.length} characters: ${title.slice(0,100)}`:'Title is missing.'},
      {label:'Description',passed:description.length>=50&&description.length<=170,detail:description?`${description.length} characters`:'Meta description is missing.'},
      {label:'Main heading',passed:(page.text.match(/<h1\b/gi)||[]).length===1,detail:`${(page.text.match(/<h1\b/gi)||[]).length} H1 headings`},
      {label:'Image descriptions',passed:images.every(t=>/\balt\s*=/i.test(t)),detail:`${images.filter(t=>!(/\balt\s*=/i.test(t))).length} images missing an alt attribute`},
      {label:'Canonical URL',passed:/<link\b[^>]*rel=["']canonical["']/i.test(page.text),detail:'A canonical URL helps avoid duplicate pages.'},
      {label:'Robots file',passed:robots.ok,detail:'HTTP '+robots.status},
      {label:'Sitemap',passed:sitemap.ok&&/<urlset\b/i.test(sitemap.text)&&/<loc>https:\/\//i.test(sitemap.text),detail:sitemap.ok?`${(sitemap.text.match(/<loc>/gi)||[]).length} sitemap URLs`:'HTTP '+sitemap.status},
      {label:'Indexability',passed:page.ok&&!blocked,detail:blocked?'Search engines are instructed not to index this page.':'No noindex directive or global robots block found.'}
    ];
    const report={checked_at:new Date().toISOString(),live_url:url,score:Math.round(checks.filter(c=>c.passed).length/checks.length*100),indexability:page.ok?(blocked?'blocked':'indexable'):'unreachable',sitemap_url:url+'/sitemap.xml',checks};
    await base44.asServiceRole.entities.SystemBuild.update(build.id,{seo_report:report,seo_status:checks.every(c=>c.passed)?'audited':'issues'});
    return Response.json({report});
  } catch(error) { return Response.json({error:error.message},{status:400}); }
}