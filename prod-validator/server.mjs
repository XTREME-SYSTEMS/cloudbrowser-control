import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const PORT = Number(process.env.PORT || 3000);
const gatewayBase = String(process.env.GATEWAY_URL || "").replace(/\/$/,"");
const mcpKey = String(process.env.CLOUD_BROWSER_MCP_KEY || "");
const targetUrl = "https://example.com/";

if (!gatewayBase) throw new Error("GATEWAY_URL_REQUIRED");
if (mcpKey.length < 24) throw new Error("CLOUD_BROWSER_MCP_KEY_REQUIRED");

let report = {
  status:"STARTING",
  validator:"cloud-browser-independent-staging-validator-v1",
  gateway_url:gatewayBase,
  target_url:targetUrl,
  started_at:new Date().toISOString(),
  checks:{}
};
let screenshot = null;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function value(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find(x=>x.type==="text")?.text;
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { text }; }
}
function authTransport() {
  return new StreamableHTTPClientTransport(new URL(gatewayBase+"/mcp"), {
    requestInit:{headers:{Authorization:"Bearer "+mcpKey}}
  });
}

async function runValidation() {
  let modern = null;
  let legacy = null;
  let sessionId = null;
  try {
    const health = await fetch(gatewayBase+"/healthz");
    assert.equal(health.ok,true);
    const healthData = await health.json();
    assert.equal(healthData?.engine?.ok,true);
    report.checks.gateway_health = "PASS";

    const unauth = await fetch(gatewayBase+"/mcp",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:"{}"
    });
    assert.equal(unauth.status,401);
    report.checks.unauthorized_rejected = "PASS";

    modern = new Client(
      {name:"cloud-browser-staging-modern-validator",version:"1.0.0"},
      {versionNegotiation:{mode:"auto"}}
    );
    await modern.connect(authTransport());
    assert.equal(modern.getProtocolEra(),"modern");
    const modernTools = await modern.listTools();
    assert.equal(modernTools.tools.some(t=>t.name==="browser_start"),true);
    report.checks.modern_mcp = "PASS";

    const healthTool = await modern.callTool({name:"browser_health",arguments:{}});
    assert.notEqual(healthTool.isError,true);
    report.checks.engine_health_tool = "PASS";

    const started = await modern.callTool({
      name:"browser_start",
      arguments:{use_pool:false,viewport_width:1024,viewport_height:768}
    });
    assert.notEqual(started.isError,true);
    sessionId = value(started).session_id;
    assert.ok(sessionId);

    report.checks.session_start = "PASS";

    const navigated = await modern.callTool({
      name:"browser_navigate",
      arguments:{session_id:sessionId,url:targetUrl,wait_until:"domcontentloaded",timeout_ms:30000}
    });
    assert.notEqual(navigated.isError,true);
    report.checks.navigate = "PASS";

    const observed = await modern.callTool({
      name:"browser_observe",
      arguments:{session_id:sessionId,max_chars:5000}
    });
    assert.notEqual(observed.isError,true);
    const observation = value(observed);
    assert.match(String(observation.url || ""),/example\.com/);
    assert.match(String(observation.text || ""),/Example Domain/i);
    report.checks.observe = "PASS";
    report.observation = {
      url:observation.url || null,
      title:observation.title || null,
      text_contains_example_domain:/Example Domain/i.test(String(observation.text || ""))
    };

    const shot = await modern.callTool({
      name:"browser_screenshot",
      arguments:{session_id:sessionId}
    });
    assert.notEqual(shot.isError,true);
    const image = shot.content?.find(x=>x.type==="image");
    assert.ok(image?.data);
    screenshot = Buffer.from(image.data,"base64");
    assert.ok(screenshot.length > 1000);
    report.checks.screenshot = "PASS";
    report.screenshot = {
      mime_type:image.mimeType || "image/png",
      byte_size:screenshot.length,
      sha256:sha256(screenshot)
    };

    const ended = await modern.callTool({
      name:"browser_end",
      arguments:{session_id:sessionId}
    });
    assert.notEqual(ended.isError,true);

    report.checks.session_end = "PASS";
    sessionId = null;
    await modern.close();
    modern = null;

    legacy = new Client({name:"cloud-browser-staging-legacy-validator",version:"1.0.0"});
    await legacy.connect(authTransport());
    assert.equal(legacy.getProtocolEra(),"legacy");
    const legacyTools = await legacy.listTools();
    assert.equal(legacyTools.tools.some(t=>t.name==="browser_health"),true);
    report.checks.legacy_mcp = "PASS";
    await legacy.close();
    legacy = null;

    report.status = "PASS";
    report.completed_at = new Date().toISOString();
  } catch (error) {
    report.status = "FAIL";
    report.error = String(error?.message || error).slice(0,500);
    report.completed_at = new Date().toISOString();
  } finally {
    if (sessionId && modern) {
      try { await modern.callTool({name:"browser_end",arguments:{session_id:sessionId}}); } catch {}
    }
    try { await modern?.close(); } catch {}
    try { await legacy?.close(); } catch {}
  }
}

createServer((req,res)=>{
  if (req.url === "/healthz") {
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({ok:true,validator_status:report.status}));
  }
  if (req.url === "/report") {
    res.writeHead(report.status==="PASS"?200:503,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify(report,null,2));
  }
  if (req.url === "/screenshot.png" && screenshot) {
    res.writeHead(200,{"content-type":"image/png","cache-control":"no-store"});
    return res.end(screenshot);
  }
  res.writeHead(404,{"content-type":"application/json"});
  res.end(JSON.stringify({error:"NOT_FOUND"}));
}).listen(PORT,"0.0.0.0",()=>void runValidation());
