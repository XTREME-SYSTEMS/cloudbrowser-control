/**
 * Railway Autonomous Operator
 * Monitors, deploys, fixes, scales all Railway services 24/7
 */
const express = require('express');
const axios = require('axios');
const { EventEmitter } = require('events');

const app = express();
app.use(express.json());

// API router — mounted at /operator prefix for Vercel services routing
const api = express.Router();

const operator = new EventEmitter();
const handledFailedDeployments = new Set();

// Configuration from env vars
const CONFIG = {
 RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN,
 RAILWAY_PROJECT_TOKEN: process.env.RAILWAY_TOKEN,
 RAILWAY_API_ENDPOINT: 'https://backboard.railway.com/graphql/v2',
 GITHUB_TOKEN: process.env.GITHUB_TOKEN,
 GITHUB_OWNER: process.env.GITHUB_OWNER || 'XTREME-SYSTEMS',
 GITHUB_REPO: process.env.GITHUB_REPO || 'cloudbrowser-control',
 PROJECT_ID: process.env.PROJECT_ID || 'b68545a5-c9f8-482d-8e1b-4c1574f7af3b',
 CLOUD_BROWSER_UI_WEBHOOK: process.env.CLOUD_BROWSER_UI_WEBHOOK || 'https://cloud-browser.base44.app/functions/receiveRailwayWebhook',
 CLOUD_BROWSER_UI_FALLBACK: 'https://cloud-browser.base44.app/functions/receiveRailwayWebhook',
 POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000,
 MAX_RETRY_ATTEMPTS: 3,
 RATE_LIMIT_THRESHOLD: 100,
 AUTO_FIX_DEPLOYS: process.env.AUTO_FIX_DEPLOYS === 'true',
};

// Validate required config
if (!CONFIG.RAILWAY_API_TOKEN && !CONFIG.RAILWAY_PROJECT_TOKEN) {
 console.error('FATAL: Missing Railway API token. Set RAILWAY_API_TOKEN or RAILWAY_TOKEN.');
 process.exit(1);
}
if (!CONFIG.GITHUB_TOKEN) {
 console.warn('[Config] GITHUB_TOKEN is not set; commit-pinned repair deployments are disabled.');
}

// Metrics
const METRICS = {
 deploymentsTotal: 0,
 deploymentsSuccess: 0,
 deploymentsFailed: 0,
 autoFixesAttempted: 0,
 autoFixesSuccess: 0,
 scalingEventsTotal: 0,
 webhooksReceived: 0,
 lastPollAt: null,
 apiRateLimitRemaining: 10000,
 startedAt: new Date(),
};

// ============================================================================
// RAILWAY API HELPERS
// ============================================================================
async function railwayGQL(query, variables = {}) {
 try {
 const response = await axios.post(CONFIG.RAILWAY_API_ENDPOINT, 
 {
 query,
 variables,
 },
 {
 headers: {
 ...(CONFIG.RAILWAY_API_TOKEN
   ? { 'Authorization': `Bearer ${CONFIG.RAILWAY_API_TOKEN}` }
   : { 'Project-Access-Token': CONFIG.RAILWAY_PROJECT_TOKEN }),
 'Content-Type': 'application/json',
 },
 timeout: 30000,
 }
 );
 
 // Track rate limit
 if (response.headers['x-ratelimit-remaining']) {
 METRICS.apiRateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining']);
 }
 
 if (response.data.errors) {
 const error = new Error(JSON.stringify(response.data.errors[0]));
 error.traceId = response.data.errors[0].extensions?.traceId;
 throw error;
 }
 
 return response.data.data;
 } catch (error) {
 const apiErrors = error.response?.data?.errors || error.response?.data || null;
 console.error('[Railway API]', error.message, apiErrors ? JSON.stringify(apiErrors) : '');
 throw error;
 }
}

async function getAllServices() {
 const projectQuery = `
 query project($id: String!) {
   project(id: $id) {
     id
     name
     services { edges { node { id name } } }
     environments { edges { node { id name } } }
   }
 }`;
 const projectData = await railwayGQL(projectQuery, { id: CONFIG.PROJECT_ID });
 const project = projectData.project;
 const services = project?.services?.edges?.map(edge => edge.node) || [];
 const environments = project?.environments?.edges?.map(edge => edge.node) || [];
 const environment = environments.find(item => item.name === 'production') || environments[0];
 if (!environment) return [];

 const environmentQuery = `
 query environment($id: String!) {
   environment(id: $id) {
     id
     name
     serviceInstances {
       edges {
         node {
           id
           serviceName
           latestDeployment { id status createdAt }
         }
       }
     }
   }
 }`;
 const environmentData = await railwayGQL(environmentQuery, { id: environment.id });
 const instances = environmentData.environment?.serviceInstances?.edges?.map(edge => edge.node) || [];
 const instanceByName = new Map(instances.map(instance => [instance.serviceName, instance]));

 return services.map(service => {
   const instance = instanceByName.get(service.name);
   const latestDeployment = instance?.latestDeployment || null;
   return {
     ...service,
     environmentId: environment.id,
     serviceInstanceId: instance?.id || null,
     activeDeployments: { edges: latestDeployment ? [{ node: latestDeployment }] : [] },
   };
 });
}

async function getDeploymentLogs(deploymentId) {
 const query = `
 query deploymentLogs($deploymentId: String!, $limit: Int) {
   deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
     timestamp
     message
     severity
   }
 }`;
 const data = await railwayGQL(query, { deploymentId, limit: 100 });
 const logs = data.deploymentLogs || [];
 const failure = [...logs].reverse().find(entry =>
   entry.severity === 'error' || /fail|error|crash|oom|healthcheck/i.test(entry.message || '')
 );
 return {
   id: deploymentId,
   failureError: failure?.message || 'Deployment failed; inspect Railway deployment logs',
   failureStage: 'deployment',
   logs,
 };
}

async function triggerDeployment(serviceId, environmentId, commitSha = null) {
 if (!CONFIG.AUTO_FIX_DEPLOYS) {
   return { blocked: true, reason: 'AUTO_FIX_DEPLOYS is disabled; production deployment requires operator approval' };
 }
 const mutation = `
 mutation serviceInstanceDeployV2($serviceId: String!, $environmentId: String!, $commitSha: String) {
   serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId, commitSha: $commitSha)
 }`;
 const data = await railwayGQL(mutation, { serviceId, environmentId, commitSha });
 return { id: data.serviceInstanceDeployV2, status: 'TRIGGERED' };
}

async function updateServiceReplicas(serviceId, environmentId, numReplicas) {
 if (!CONFIG.AUTO_FIX_DEPLOYS) {
   return { blocked: true, reason: 'AUTO_FIX_DEPLOYS is disabled; production scaling requires operator approval' };
 }
 const mutation = `
 mutation serviceInstanceUpdate($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
   serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
 }`;
 const data = await railwayGQL(mutation, {
   serviceId,
   environmentId,
   input: { numReplicas },
 });
 return { blocked: false, updated: data.serviceInstanceUpdate === true };
}

// ============================================================================
// GITHUB INTEGRATION
// ============================================================================
async function getLatestCommitSHA(branch = 'main') {
 try {
 const response = await axios.get(
 `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/commits/${branch}`,
 {
 headers: { 'Authorization': `Bearer ${CONFIG.GITHUB_TOKEN}` },
 }
 );
 return response.data.sha;
 } catch (error) {
 console.error('[GitHub] Error getting commit:', error.message);
 return null;
 }
}

// ============================================================================
// AUTO-FIX LOGIC
// ============================================================================
async function analyzeAndFixFailure(service, failedDeployment) {
 METRICS.autoFixesAttempted++;
 
 const logs = await getDeploymentLogs(failedDeployment.id);
 const error = logs.failureError || 'Unknown error';
 const stage = logs.failureStage || 'Unknown';
 
 console.log(`[AutoFix] ${service.name}: ${stage} - ${error}`);
 
 // Parse error patterns
 if (error.includes('Cannot find module') || error.includes('missing')) {
 console.log(`[AutoFix] Detected missing dependency, redeploying...`);
 const latestSHA = await getLatestCommitSHA();
 if (latestSHA) {
 const newDeploy = await triggerDeployment(service.id, service.environmentId, latestSHA);
 if (newDeploy.blocked) return { fixed: false, blocked: true, reason: newDeploy.reason };
 METRICS.autoFixesSuccess++;
 return { fixed: true, deploymentId: newDeploy.id };
 }
 }
 
 if (error.includes('port') && error.includes('already in use')) {
 console.log(`[AutoFix] Port conflict, triggering redeploy...`);
 const newDeploy = await triggerDeployment(service.id, service.environmentId);
 if (newDeploy.blocked) return { fixed: false, blocked: true, reason: newDeploy.reason };
 METRICS.autoFixesSuccess++;
 return { fixed: true, deploymentId: newDeploy.id };
 }
 
 if (error.includes('SIGKILL') || error.includes('OOM')) {
 console.log(`[AutoFix] Out of memory detected`);
 return { fixed: false, reason: 'Needs manual scale-up' };
 }
 
 console.log(`[AutoFix] Cannot auto-fix`);
 return { fixed: false, reason: error };
}

// ============================================================================
// POLLING
// ============================================================================
async function pollServices() {
 try {
 console.log(`[Poll] Checking services...`);
 METRICS.lastPollAt = new Date();
 
 const services = await getAllServices();
 
 for (const service of services) {
 if (!service.activeDeployments.edges.length) continue;
 
 const latestDeployment = service.activeDeployments.edges[0].node;
 
 if (latestDeployment.status === 'FAILED') {
 if (handledFailedDeployments.has(latestDeployment.id)) continue;
 handledFailedDeployments.add(latestDeployment.id);
 if (handledFailedDeployments.size > 500) {
   const oldest = handledFailedDeployments.values().next().value;
   handledFailedDeployments.delete(oldest);
 }
 METRICS.deploymentsFailed++;
 console.log(`[Alert] ${service.name} deployment FAILED`);
 
 const fixResult = await analyzeAndFixFailure(service, latestDeployment);
 
 await notifyCloudBrowserUI({
 event: 'deployment_failed',
 status: 'failed',
 service: service.name,
 serviceId: service.id,
 deploymentId: latestDeployment.id,
 error: latestDeployment.failureError,
 autoFixResult: fixResult,
 timestamp: new Date().toISOString(),
 });
 } else if (latestDeployment.status === 'SUCCESS') {
 METRICS.deploymentsSuccess++;
 }
 
 METRICS.deploymentsTotal++;
 }
 
 if (METRICS.apiRateLimitRemaining < CONFIG.RATE_LIMIT_THRESHOLD) {
 console.warn(`[Alert] Rate limit low: ${METRICS.apiRateLimitRemaining} remaining`);
 }
 
 } catch (error) {
 console.error('[Poll] Error:', error.message);
 }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================
async function handleRailwayWebhook(req, res) {
 try {
 METRICS.webhooksReceived++;
 const event = req.body?.type || req.body?.event;
 const deploymentId = req.body?.resource?.deployment?.id || req.body?.deploymentId;
 const serviceId = req.body?.resource?.service?.id || req.body?.serviceId;
 
 console.log(`[Webhook] ${event || 'unknown'} (${deploymentId || 'no-deployment-id'})`);
 
 if (event === 'Deployment.failed') {
 const logs = await getDeploymentLogs(deploymentId);
 const services = await getAllServices();
 const service = services.find(s => s.id === serviceId);
 
 if (service) {
 const fixResult = await analyzeAndFixFailure(service, logs);
 await notifyCloudBrowserUI({
 event: 'deployment_failed_webhook',
 status: 'failed',
 service: service.name,
 serviceId,
 deploymentId,
 error: logs.failureError,
 autoFixResult: fixResult,
 timestamp: new Date().toISOString(),
 });
 }
 }
 
 if (event === 'Deployment.deployed') {
 console.log(`[Success] ${deploymentId}`);
 await notifyCloudBrowserUI({
 event: 'deployment_success',
 status: 'success',
 deploymentId,
 timestamp: new Date().toISOString(),
 });
 }
 
 res.json({ ok: true });
 } catch (error) {
 console.error('[Webhook] Error:', error.message);
 res.status(500).json({ error: error.message });
 }
}

api.post('/webhooks/railway-deploy', handleRailwayWebhook);

// ============================================================================
// UI NOTIFICATION
// ============================================================================
function safeWebhookLabel(value) {
 try {
   const url = new URL(value);
   return `${url.origin}${url.pathname}`;
 } catch {
   return 'invalid-webhook-url';
 }
}

async function notifyCloudBrowserUI(payload) {
 // Prefer the verified canonical Base44 receiver. Keep the configured URL only
 // as a secondary compatibility target if the canonical endpoint is unavailable.
 const targets = [...new Set([
   CONFIG.CLOUD_BROWSER_UI_FALLBACK,
   CONFIG.CLOUD_BROWSER_UI_WEBHOOK,
 ].filter(Boolean))];

 if (!targets.length) {
   console.log('[UI] No webhook URL configured, skipping notification');
   return { delivered: false, reason: 'not_configured' };
 }

 let lastError = null;
 for (let index = 0; index < targets.length; index++) {
   const target = targets[index];
   try {
     const response = await axios.post(target, payload, {
       timeout: 10000,
       headers: { 'Content-Type': 'application/json' },
       validateStatus: () => true,
     });

     if (response.status >= 200 && response.status < 300) {
       console.log(`[UI] Notified: ${payload.event} -> ${safeWebhookLabel(target)} (${response.status})`);
       return { delivered: true, status: response.status, target: safeWebhookLabel(target) };
     }

     lastError = new Error(`HTTP ${response.status}`);
     console.warn(`[UI] Notification rejected by ${safeWebhookLabel(target)}: HTTP ${response.status}`);

     const retryableConfigurationError = response.status === 404 || response.status === 405;
     if (!retryableConfigurationError) break;
   } catch (error) {
     lastError = error;
     console.warn(`[UI] Notification error for ${safeWebhookLabel(target)}: ${error.message}`);
   }
 }

 console.warn(`[UI] Notification failed after ${targets.length} target(s): ${lastError?.message || 'unknown error'}`);
 return { delivered: false, reason: lastError?.message || 'unknown_error' };
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================
api.get('/health', (req, res) => {
 res.json({
 status: 'healthy',
 version: '1.0.0',
 uptime: process.uptime(),
 });
});

api.get('/status', (req, res) => {
 res.json({
 status: 'running',
 config: {
 projectId: CONFIG.PROJECT_ID,
 githubRepo: `${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`,
 pollIntervalMs: CONFIG.POLL_INTERVAL_MS,
 },
 metrics: METRICS,
 });
});

api.post('/api/manual/deploy', async (req, res) => {
 try {
 const { serviceId } = req.body;
 const services = await getAllServices();
 const service = services.find(item => item.id === serviceId);
 if (!service) return res.status(404).json({ error: 'Service not found in project' });
 const deployment = await triggerDeployment(serviceId, service.environmentId);
 if (deployment.blocked) return res.status(403).json({ error: deployment.reason });
 res.json({ ok: true, deploymentId: deployment.id });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

api.post('/api/manual/scale', async (req, res) => {
 try {
 const { serviceId, environmentId, replicas } = req.body;
 const result = await updateServiceReplicas(serviceId, environmentId, replicas);
 if (result.blocked) return res.status(403).json({ error: result.reason });
 res.json({ ok: true, result });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// ============================================================================
// ONE-SHOT INFRA FIXUPS (hardcoded targets — safe on a public endpoint)
// ============================================================================
// POST /api/manual/scraper-domain — create the scraper service's public domain
api.post('/api/manual/scraper-domain', async (req, res) => {
  if (!CONFIG.AUTO_FIX_DEPLOYS) return res.status(403).json({ error: 'Protected infrastructure mutations are approval-gated' });
  try {
    const data = await railwayGQL(
      `mutation($input: CustomDomainCreateInput!) {
         customDomainCreate(input: $input) { id domain }
       }`,
      {
        input: {
          projectId: CONFIG.PROJECT_ID,
          environmentId: 'f2a884f8-924b-431c-a181-b7287e8b2137',
          serviceId: 'ae0a7cea-05c6-48f3-b387-ac78ffd97c47',
          domain: 'hidden-property-intel-scraper.up.railway.app',
        },
      }
    );
    res.json({ ok: true, domain: data.customDomainCreate });
  } catch (error) {
    res.status(500).json({ error: error.message, detail: error.response?.data?.errors || null });
  }
});

// POST /api/manual/scraper-server-mode — convert scraper from cron service to
// persistent server (clears cronSchedule, sets ALWAYS restart) and redeploys.
// Hardcoded target — safe on a public endpoint.
api.post('/api/manual/scraper-server-mode', async (req, res) => {
  if (!CONFIG.AUTO_FIX_DEPLOYS) return res.status(403).json({ error: 'Protected infrastructure mutations are approval-gated' });
  try {
    const INSTANCE_ID = 'c3633498-2692-4502-a455-04f77f08124e';
    const updated = await railwayGQL(
      `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
         serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
       }`,
      { serviceId: 'ae0a7cea-05c6-48f3-b387-ac78ffd97c47', environmentId: 'f2a884f8-924b-431c-a181-b7287e8b2137', input: { cronSchedule: null, restartPolicyType: 'ALWAYS' } }
    );
    res.json({ ok: true, updated: updated.serviceInstanceUpdate === true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// STARTUP
// ============================================================================
const PORT = process.env.PORT || 8081;

// Railway project webhooks currently target the root path.
app.post('/webhooks/railway-deploy', handleRailwayWebhook);

// Keep the /operator prefix for Vercel services routing and Railway health checks.
app.use('/operator', api);

app.listen(PORT, () => {
  console.log(`[Start] Railway Autonomous Operator v1.0.0 on port ${PORT}`);
 console.log(`[Config] Project: ${CONFIG.PROJECT_ID}`);
 console.log(`[Config] Repo: ${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`);
 console.log(`[Config] Poll: every ${CONFIG.POLL_INTERVAL_MS / 1000 / 60} minutes`);
 console.log(`[Config] Auto-fix deployments: ${CONFIG.AUTO_FIX_DEPLOYS ? 'ENABLED' : 'APPROVAL-GATED'}`);
 
 // Start polling
 setInterval(pollServices, CONFIG.POLL_INTERVAL_MS);
 
 // Initial poll
 setTimeout(pollServices, 5000);
});

module.exports = app;