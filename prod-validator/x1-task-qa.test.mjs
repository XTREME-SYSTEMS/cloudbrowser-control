import test from "node:test";
import assert from "node:assert/strict";
import {Readable} from "node:stream";
import {makeX1QaEndpoint} from "./x1-task-qa.mjs";

const token="synthetic-private-local-test-token-only";
const validatorId="staging-independent-qa-1";
const src="a".repeat(40),html="b".repeat(64);
const q={
  kind:"X1_PREVIEW_INDEPENDENT_BROWSER_QA_V1",
  work_id:"11111111-1111-4111-8111-111111111111",
  tenant_id:"22222222-2222-4222-8222-222222222222",
  task_id:"x1-safe-canary-task-001",lease_id:"lease-id-001",
  builder_id:"x1-swarm-preview-1",expected_validator_id:validatorId,
  approved_source_sha:src,build_source_sha:src,html_sha256:html,
  deployment_id:"dpl_SyntheticTest1",
  preview_url:"https://website-launch-engine-test.vercel.app/",
  release:"PREVIEW_ONLY",
  required_checks:["responsive_layout","navigation","estimate_calculator","no_console_errors","source_hash","noindex"],
  required_viewports:[{width:1440,height:900},{width:390,height:844}]
};
const authoritative={
 work_id:q.work_id,tenant_id:q.tenant_id,task_id:q.task_id,lease_id:q.lease_id,
 source_sha:src,status:"LEASED",lease_status:"ACTIVE",holder_agent_id:q.builder_id,
 action_class:"NON_PRODUCTION_MUTATION",environment:"preview",
 lease_expires_at:new Date(Date.now()+600000).toISOString()
};
const browser={
  preview_url:q.preview_url,deployment_id:q.deployment_id,
  html_sha256:html,source_sha:src,noindex:true,
  browser_identity:validatorId,browser_session_id:"qa-browser-independent-session",
  checks:Object.fromEntries(q.required_checks.map(x=>[x,"PASS"]))
};
const proof={
  persisted:true,receipt_id:"qa-test-receipt-20261017",validator_id:validatorId,
  work_id:q.work_id,tenant_id:q.tenant_id,lease_id:q.lease_id,source_sha:src,
  html_sha256:html,deployment_id:q.deployment_id,status:"PASS"
};
function deps(overrides={}) {
 return {bearerToken:token,validatorId,readWork:async()=>authoritative,
  inspectPreview:async()=>browser,persistAndReadBack:async()=>proof,...overrides};
}
async function call(config=deps(),input=q,options={}) {
 const req=Readable.from([JSON.stringify(input)]);
 req.url="/api/x1/validate-preview";req.method=options.method||"POST";
 req.headers={authorization:options.auth===false?"":"Bearer "+token,"content-type":"application/json"};
 let status=null,out="";
 const res={writeHead(n){status=n;},end(s){out=s;}};
 await makeX1QaEndpoint(config)(req,res);
 return {status,body:JSON.parse(out)};
}
test("refuses GET; no state effect",async()=>assert.equal((await call(deps(),q,{method:"GET"})).status,405));
test("does not allow unauthenticated POST",async()=>assert.equal((await call(deps(),q,{auth:false})).status,401));
test("route fails closed when independent provider not bound",async()=>{
 const r=await call({bearerToken:token,validatorId});assert.equal(r.status,503);
 assert.equal(r.body.code,"VALIDATOR_PROVIDER_NOT_BOUND");
});
test("task-linked independent browser and database readback gives single PASS",async()=>{
 let reads=0,persists=0;
 const r=await call(deps({readWork:async()=>{reads++;return authoritative;},
  persistAndReadBack:async()=>{persists++;return proof;}}));
 assert.equal(r.status,200);assert.equal(r.body.database_receipt_persisted,true);
 assert.equal(r.body.receipt_id,proof.receipt_id);
 assert.equal(reads,2);assert.equal(persists,1);
});
test("cross tenant is rejected against authoritative lease",async()=>{
 assert.equal((await call(deps({readWork:async()=>({...authoritative,tenant_id:"other"})}))).status,409);
});
test("source SHA drift is rejected",async()=>{
 assert.equal((await call(deps(),{...q,build_source_sha:"c".repeat(40)})).status,422);
});
test("self-validation identity is rejected",async()=>{
 assert.equal((await call(deps(),{...q,builder_id:validatorId})).status,422);
});
test("unapproved target rejected",async()=>{
 assert.equal((await call(deps(),{...q,preview_url:"https://example.com/"})).status,422);
});
test("expired lease rejected",async()=>{
 assert.equal((await call(deps({readWork:async()=>({...authoritative,lease_expires_at:new Date(Date.now()-1000).toISOString()})}))).status,409);
});
test("browser must prove noindex and all required checks",async()=>{
 const r=await call(deps({inspectPreview:async()=>({...browser,noindex:false})}));
 assert.equal(r.status,409);
});
test("reported success without independently persisted receipt fails closed",async()=>{
 const r=await call(deps({persistAndReadBack:async()=>({...proof,persisted:false})}));
 assert.equal(r.status,503);
});
test("interruption before persist then retry with idempotent store yields one durable effect",async()=>{
 let fails=true,commits=0;
 const durable=new Map();
 const bind=deps({
 inspectPreview:async()=>{if(fails){fails=false;throw new Error("INJECTED_WORKER_INTERRUPTION");}return browser;},
 persistAndReadBack:async()=>{if(!durable.has(q.work_id)){durable.set(q.work_id,proof);commits++;}return durable.get(q.work_id);}
 });
 const first=await call(bind),second=await call(bind),third=await call(bind);
 assert.equal(first.status,503);
 assert.equal(second.status,200);
 assert.equal(third.status,200);
 assert.equal(commits,1);
 assert.equal(durable.size,1);
});
