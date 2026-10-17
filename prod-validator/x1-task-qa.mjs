import { createHash, timingSafeEqual } from "node:crypto";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const DEPLOY=/^dpl_[A-Za-z0-9]+$/;
const ID=/^[A-Za-z0-9_.:-]{12,150}$/;
const EXPECTED_CHECKS=["responsive_layout","navigation","estimate_calculator","no_console_errors","source_hash","noindex"];
const MAX_BYTES=32768;
function eq(a,b){
  if(typeof a!=="string"||typeof b!=="string") return false;
  const x=createHash("sha256").update(a).digest(),y=createHash("sha256").update(b).digest();
  return timingSafeEqual(x,y);
}
function err(code,status=422){ const e=new Error(code);e.status=status;return e; }
function assertRequest(q,validatorId) {
  if(!q||typeof q!=="object"||Array.isArray(q)||q.kind!=="X1_PREVIEW_INDEPENDENT_BROWSER_QA_V1")
    throw err("QA_REQUEST_KIND_INVALID");
  for(const k of ["work_id","tenant_id","task_id","lease_id","builder_id","expected_validator_id"])
    if(typeof q[k]!=="string"||!q[k].trim())throw err("QA_IDENTITY_REQUIRED");
  if(!UUID.test(q.work_id)||!UUID.test(q.tenant_id)||!SHA40.test(q.approved_source_sha)||
     !SHA40.test(q.build_source_sha)||q.approved_source_sha!==q.build_source_sha||
     !SHA64.test(q.html_sha256)||!DEPLOY.test(q.deployment_id)||
     q.expected_validator_id!==validatorId||q.builder_id===validatorId||q.release!=="PREVIEW_ONLY")
    throw err("QA_CONTEXT_INVALID");
  const v=new URL(q.preview_url);
  if(v.protocol!=="https:"||!/^website-launch-engine-[a-z0-9-]+\.vercel\.app$/.test(v.hostname)||
     v.username||v.password||v.port||v.pathname!=="/"||v.search||v.hash)throw err("QA_PREVIEW_HOST_DENIED");
  if(!Array.isArray(q.required_checks)||q.required_checks.length!==EXPECTED_CHECKS.length||
     EXPECTED_CHECKS.some(c=>!q.required_checks.includes(c))||
     !Array.isArray(q.required_viewports)||q.required_viewports.length!==2||
     q.required_viewports[0]?.width!==1440||q.required_viewports[0]?.height!==900||
     q.required_viewports[1]?.width!==390||q.required_viewports[1]?.height!==844)
    throw err("QA_TEST_SCOPE_MISMATCH");
}
function assertAuthoritative(q,a){
  if(!a||a.work_id!==q.work_id||a.tenant_id!==q.tenant_id||a.task_id!==q.task_id||
     a.lease_id!==q.lease_id||a.source_sha!==q.approved_source_sha||
     a.status!=="LEASED"||a.lease_status!=="ACTIVE"||a.holder_agent_id!==q.builder_id||
     a.action_class!=="NON_PRODUCTION_MUTATION"||a.environment!=="preview"||
     !Number.isFinite(Date.parse(a.lease_expires_at))||
     Date.parse(a.lease_expires_at)<=Date.now()+5000)
    throw err("QA_AUTHORITATIVE_LEASE_MISMATCH",409);
}
function assertBrowserProof(q,v){
  if(!v||v.preview_url!==q.preview_url||v.deployment_id!==q.deployment_id||
     v.html_sha256!==q.html_sha256||v.source_sha!==q.approved_source_sha||
     v.noindex!==true||v.browser_identity===q.builder_id||
     !v.browser_identity||!v.browser_session_id||
     EXPECTED_CHECKS.some(c=>v.checks?.[c]!=="PASS"))
    throw err("QA_BROWSER_PROOF_INCOMPLETE",409);
}
export function makeX1QaEndpoint({bearerToken,validatorId,readWork,inspectPreview,persistAndReadBack}={}){
  return async function handle(req,res) {
    const reply=(status,obj)=>{res.writeHead(status,{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(JSON.stringify(obj));};
    if(req.url!=="/api/x1/validate-preview")return false;
    if(req.method!=="POST"){reply(405,{ok:false,code:"METHOD_NOT_ALLOWED"});return true;}
    const header=String(req.headers.authorization||"");
    if(!bearerToken||bearerToken.length<24||!eq(header,"Bearer "+bearerToken)){
      reply(401,{ok:false,code:"VALIDATOR_AUTH_REQUIRED"});return true;
    }
    if(!validatorId||!readWork||!inspectPreview||!persistAndReadBack){
      reply(503,{ok:false,code:"VALIDATOR_PROVIDER_NOT_BOUND"});return true;
    }
    if(!String(req.headers["content-type"]||"").toLowerCase().startsWith("application/json")){
      reply(415,{ok:false,code:"JSON_REQUIRED"});return true;
    }
    let body="";
    try {
      for await(const chunk of req){
        body+=chunk.toString("utf8");
        if(Buffer.byteLength(body)>MAX_BYTES)throw err("QA_REQUEST_TOO_LARGE",413);
      }
      const q=JSON.parse(body);
      assertRequest(q,validatorId);
      const original=await readWork(q);
      assertAuthoritative(q,original);
      const browser=await inspectPreview(q);
      assertBrowserProof(q,browser);
      const checked=await readWork(q);
      assertAuthoritative(q,checked);
      const proof=await persistAndReadBack({request:q,authoritative:checked,browser,validatorId});
      if(!proof||proof.persisted!==true||!ID.test(proof.receipt_id||"")||
         proof.validator_id!==validatorId||proof.work_id!==q.work_id||
         proof.tenant_id!==q.tenant_id||proof.lease_id!==q.lease_id||
         proof.source_sha!==q.approved_source_sha||proof.html_sha256!==q.html_sha256||
         proof.deployment_id!==q.deployment_id||proof.status!=="PASS")
        throw err("QA_DATABASE_READBACK_MISMATCH",503);
      reply(200,{status:"PASS",database_receipt_persisted:true,receipt_id:proof.receipt_id,
        validator_id:validatorId,work_id:q.work_id,tenant_id:q.tenant_id,
        source_sha:q.approved_source_sha,html_sha256:q.html_sha256,deployment_id:q.deployment_id});
    } catch(e) {
      const code=e instanceof SyntaxError?"QA_INVALID_JSON":String(e?.message||"QA_INTERNAL_ERROR");
      const known=/^(QA_[A-Z_]+|VALIDATOR_PROVIDER_NOT_BOUND)$/.test(code);
      reply(known?(e.status||422):503,{ok:false,code:known?code:"QA_VALIDATION_UNCONFIRMED"});
    }
    return true;
  };
}
