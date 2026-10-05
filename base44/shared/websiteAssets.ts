export const contactForm = `<form id="factory-contact" action="/api/contact" method="post"><label for="contact-name">Name</label><input id="contact-name" name="name" maxlength="150" autocomplete="name" required><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" maxlength="254" autocomplete="email" required><label for="contact-phone">Phone (optional)</label><input id="contact-phone" name="phone" type="tel" maxlength="60" autocomplete="tel"><label for="contact-message">Message</label><textarea id="contact-message" name="message" maxlength="4000" required></textarea><div hidden><label for="contact-trap">Leave blank</label><input id="contact-trap" name="company_website" tabindex="-1" autocomplete="off"></div><button type="submit">Send enquiry</button><p id="contact-feedback" role="status" aria-live="polite"></p></form>`;
export const browserScript = `<script>
document.querySelector('[data-menu-toggle]')?.addEventListener('click',function(){const n=document.querySelector('[data-menu]');const open=this.getAttribute('aria-expanded')!=='true';this.setAttribute('aria-expanded',String(open));n?.classList.toggle('open',open);});
const factoryForm=document.getElementById('factory-contact')||document.querySelector('[data-factory-contact]');factoryForm?.addEventListener('submit',async function(e){e.preventDefault();e.stopImmediatePropagation();if(!this.reportValidity())return;const button=this.querySelector('button[type="submit"]');const feedback=document.getElementById('contact-feedback');button.disabled=true;feedback.textContent='Sending…';try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(this)))});const d=await r.json();if(!r.ok||!d.saved)throw new Error(d.error||'Your enquiry could not be saved. Please try again.');feedback.textContent='Your enquiry has been received.';this.reset();}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}},true);
</script>`;
export function prepareWebsite(raw, buildId) {
  let html = String(raw).replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (html.length < 1000 || html.length > 180000 || !/^<!doctype html>/i.test(html) || !/<\/html>\s*$/i.test(html)) throw new Error('Generation did not return a complete HTML document.');
  if (!/<h1\b/i.test(html) || !/name=["']viewport["']/i.test(html) || !/<title>[^<]+<\/title>/i.test(html)) throw new Error('Generated document is missing essential page metadata.');
  if ((html.match(/<form\b/gi) || []).length !== 1) throw new Error('The website must contain exactly one contact form.');
  html = html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (all, attrs) => /application\/ld\+json/i.test(attrs) ? all : '');
  html = html.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  html = html.replace(/<form\b[\s\S]*?<\/form>/i, contactForm);
  html = html.replace(/<\/head>/i, `<meta name="factory-build" content="${buildId}"><style>#factory-contact{display:grid;gap:.7rem}#factory-contact input,#factory-contact textarea{box-sizing:border-box;width:100%;padding:.8rem;font:inherit}#factory-contact label{font-weight:600}#factory-contact button:disabled{opacity:.6}#contact-feedback{min-height:1.5em}:focus-visible{outline:2px solid currentColor;outline-offset:3px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}</style></head>`);
  return html.replace(/<\/body>/i, browserScript + '</body>');
}
export function contactHandler(buildId, token) {
  return `module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='POST'){return res.status(405).json({error:'Use POST.'});}const origin=req.headers.origin;if(origin&&origin!=='https://'+req.headers.host)return res.status(403).json({error:'Origin refused.'});let b=req.body;try{if(typeof b==='string')b=JSON.parse(b);}catch{return res.status(400).json({error:'Invalid message.'});}if(!b||JSON.stringify(b).length>7000)return res.status(400).json({error:'Message too large.'});if(b.company_website)return res.status(400).json({error:'Submission refused.'});try{const response=await fetch('https://cloud-browser.base44.app/functions/saveWebsiteContact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({build_id:${JSON.stringify(buildId)},access_token:${JSON.stringify(token)},name:b.name,email:b.email,phone:b.phone,message:b.message,is_verification:req.headers['x-factory-proof']===${JSON.stringify(token)}}),signal:AbortSignal.timeout(20000)});const data=await response.json();return res.status(response.status).json(response.ok?{saved:data.saved,submission_id:data.submission_id}:{error:data.error||'Could not save your enquiry.'});}catch{return res.status(502).json({error:'Could not reach the enquiry inbox. Please try again.'});}};`;
}
export function ensureStudioContact(html) {
  if (/id=["']factory-contact["']|data-factory-contact/i.test(html) || !/<form\b/i.test(html)) return html;
  const updated=html.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/i,(full,attributes,content)=>{
    const attrs=attributes.replace(/\s(?:action|method|onsubmit)\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
    const feedback=/<[^>]+id=["']contact-feedback["']/i.test(content)?'':'<p id="contact-feedback" role="status" aria-live="polite"></p>';
    return `<form${attrs} data-factory-contact action="/api/contact" method="post">${content}${feedback}</form>`;
  });
  return updated.replace(/<\/body>/i,browserScript+'</body>');
}
export function websiteFiles(html, buildId, token, options = {}) {
  const canonical = options.canonical_url ? new URL(options.canonical_url).href.replace(/[<>&"']/g,'') : null;
  const indexable = options.indexable !== false;
  return [
    { file: 'index.html', data: html },
    { file: 'api/contact.js', data: contactHandler(buildId, token) },
    { file: 'api/sitemap.js', data: `module.exports=(req,res)=>{res.setHeader('Content-Type','application/xml');const loc=${JSON.stringify(canonical)}||('https://'+req.headers.host+'/');res.end('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+loc.replace(/&/g,'&amp;')+'</loc></url></urlset>');};` },
    { file: 'api/robots.js', data: `module.exports=(req,res)=>{res.setHeader('Content-Type','text/plain');res.end('User-agent: *\\n${indexable ? 'Allow: /' : 'Disallow: /'}\\nSitemap: https://'+req.headers.host+'/sitemap.xml');};` },
    { file: 'vercel.json', data: JSON.stringify({ version: 2, rewrites: [{source:'/sitemap.xml',destination:'/api/sitemap'},{source:'/robots.txt',destination:'/api/robots'}] }) }
  ];
}