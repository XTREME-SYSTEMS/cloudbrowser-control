/**
 * Railway Autonomous Operator
 * Monitors, deploys, fixes, scales all Railway services 24/7
 */
const express = require('express');
const axios = require('axios');
const { EventEmitter } = require('events');

const app = express();
app.use(express.json());

const operator = new EventEmitter();

// Configuration from env vars
const CONFIG = {
 RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN,
 RAILWAY_API_ENDPOINT: 'https://backboard.railway.com/graphql/v2',
 GITHUB_TOKEN: process.env.GITHUB_TOKEN,
 GITHUB_OWNER: process.env.GITHUB_OWNER || 'XTREME-SYSTEMS',
 GITHUB_REPO: process.env.GITHUB_REPO || 'cloudbrowser-control',
 PROJECT_ID: process.env.PROJECT_ID || 'b68545a5-c9f8-482d-8e1b-4c1574f7af3b',
 CLOUD_BROWSER_UI_WEBHOOK: process.env.CLOUD_BROWSER_UI_WEBHOOK,
 POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 5 * 60 * 1000,
 MAX_RETRY_ATTEMPTS: 3,
 RATE_LIMIT_THRESHOLD: 100,
};

// Validate required config
const requiredEnvVars = ['RAILWAY_API_TOKEN', 'GITHUB_TOKEN'];
for (const envVar of requiredEnvVars) {
 if (!process.env[envVar]) {
 console.error(`FATAL: Missing required environment variable: ${envVar}`);
 process.exit(1);
 }
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
 'Authorization': `Bearer ${CONFIG.RAILWAY_API_TOKEN}`,
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
 console.error('[Railway API]', error.message);
 throw error;
 }
}

async function getAllServices() {
 const query = `
 query {
 project(id: "${CONFIG.PROJECT_ID}") {
 id
 name
 services(first: 50) {
 edges {
 node {
 id
 name
 activeDeployments(first: 5) {
 edges {
 node {
 id
 status
 failureError
 failureStage
 createdAt
 }
 }
 }
 }
 }
 }
 }
 `;
 
 const data = await railwayGQL(query);
 return data.project.services.edges.map(e => e.node);
}

async function getDeploymentLogs(deploymentId) {
 const query = `
 query {
 deployment(id: "${deploymentId}") {
 id
 status
 failureError
 failureStage
 }
 }
 `;
 
 const data = await railwayGQL(query);
 return data.deployment;
}

async function triggerDeployment(serviceId, commitSha = null) {
 const mutation = `
 mutation {
 deploymentTrigger(serviceId: "${serviceId}"${commitSha ? `, commitSha: "${commitSha}"` : ''}) {
 id
 status
 }
 }
 `;
 
 const data = await railwayGQL(mutation);
 return data.deploymentTrigger;
}

async function updateServiceReplicas(serviceId, environmentId, numReplicas) {
 const mutation = `
 mutation {
 serviceInstanceUpdate(
 serviceId: "${serviceId}",
 environmentId: "${environmentId}",
 input: { numReplicas: ${numReplicas} }
 ) {
 id
 numReplicas
 }
 }
 `;
 
 const data = await railwayGQL(mutation);
 return data.serviceInstanceUpdate;
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
 const newDeploy = await triggerDeployment(service.id, latestSHA);
 METRICS.autoFixesSuccess++;
 return { fixed: true, deploymentId: newDeploy.id };
 }
 }
 
 if (error.includes('port') && error.includes('already in use')) {
 console.log(`[AutoFix] Port conflict, triggering redeploy...`);
 const newDeploy = await triggerDeployment(service.id);
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
 METRICS.deploymentsFailed++;
 console.log(`[Alert] ${service.name} deployment FAILED`);
 
 const fixResult = await analyzeAndFixFailure(service, latestDeployment);
 
 await notifyCloudBrowserUI({
 event: 'deployment_failed',
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
app.post('/webhooks/railway-deploy', async (req, res) => {
 try {
 METRICS.webhooksReceived++;
 const { event, deploymentId, serviceId } = req.body;
 
 console.log(`[Webhook] ${event} (${deploymentId})`);
 
 if (event === 'Deployment.failed') {
 const logs = await getDeploymentLogs(deploymentId);
 const services = await getAllServices();
 const service = services.find(s => s.id === serviceId);
 
 if (service) {
 const fixResult = await analyzeAndFixFailure(service, logs);
 await notifyCloudBrowserUI({
 event: 'deployment_failed_webhook',
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
 deploymentId,
 timestamp: new Date().toISOString(),
 });
 }
 
 res.json({ ok: true });
 } catch (error) {
 console.error('[Webhook] Error:', error.message);
 res.status(500).json({ error: error.message });
 }
});

// ============================================================================
// UI NOTIFICATION
// ============================================================================
async function notifyCloudBrowserUI(payload) {
 if (!CONFIG.CLOUD_BROWSER_UI_WEBHOOK) {
 console.log('[UI] No webhook URL configured, skipping notification');
 return;
 }
 
 try {
 await axios.post(CONFIG.CLOUD_BROWSER_UI_WEBHOOK, payload, {
 timeout: 10000,
 });
 console.log(`[UI] Notified: ${payload.event}`);
 } catch (error) {
 console.warn(`[UI] Notification failed: ${error.message}`);
 }
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================
app.get('/health', (req, res) => {
 res.json({
 status: 'healthy',
 version: '1.0.0',
 uptime: process.uptime(),
 });
});

app.get('/status', (req, res) => {
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

app.post('/api/manual/deploy', async (req, res) => {
 try {
 const { serviceId } = req.body;
 const deployment = await triggerDeployment(serviceId);
 res.json({ ok: true, deploymentId: deployment.id });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

app.post('/api/manual/scale', async (req, res) => {
 try {
 const { serviceId, environmentId, replicas } = req.body;
 const result = await updateServiceReplicas(serviceId, environmentId, replicas);
 res.json({ ok: true, result });
 } catch (error) {
 res.status(500).json({ error: error.message });
 }
});

// ============================================================================
// STARTUP
// ============================================================================
const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
 console.log(`[Start] Railway Autonomous Operator v1.0.0 on port ${PORT}`);
 console.log(`[Config] Project: ${CONFIG.PROJECT_ID}`);
 console.log(`[Config] Repo: ${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}`);
 console.log(`[Config] Poll: every ${CONFIG.POLL_INTERVAL_MS / 1000 / 60} minutes`);
 
 // Start polling
 setInterval(pollServices, CONFIG.POLL_INTERVAL_MS);
 
 // Initial poll
 setTimeout(pollServices, 5000);
});

module.exports = app;
