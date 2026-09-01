import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Capability Matrix — the single source of truth for the Capabilities page.
// Compares Cloud Browser against the benchmark (Bright Data Agent Browser + Browserbase).
// Each capability is scored, hardened-flagged, validated-flagged, and test-linked.

interface Capability {
  name: string;
  benchmark: string;
  cloudBrowser: string;
  status: 'implemented' | 'partial' | 'gap';
  gap: string;
  closable: boolean;
  hardened: boolean;
  validated: boolean;
  test: string;
  score: number;
}

interface Category {
  category: string;
  icon: string;
  capabilities: Capability[];
}

const CATEGORIES: Category[] = [
  {
    category: 'Browser Infrastructure',
    icon: 'monitor',
    capabilities: [
      { name: 'Serverless Browser Infrastructure', benchmark: 'Fully managed, autoscaling serverless Chromium (Browserbase)', cloudBrowser: 'Self-hosted Playwright engine with session pooling + warm pools', status: 'partial', gap: 'Self-hosted vs serverless — equivalent pooling but requires manual scaling', closable: false, hardened: true, validated: true, test: 'managePool', score: 80 },
      { name: 'Session Persistence (Pause/Resume)', benchmark: 'Contexts API with 7-90 day retention (Browserbase)', cloudBrowser: 'Profile entity with AES-GCM encrypted cookies/storage_state + resumeSession', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'saveProfile + resumeSession', score: 100 },
      { name: 'Session Pooling', benchmark: 'Pre-warmed session pools with autoscaling', cloudBrowser: 'Pool management with pool_size + pool_warm_count config', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'managePool', score: 100 },
      { name: 'Multi-Region Deployment', benchmark: 'Regional control with autoscaling across regions', cloudBrowser: 'Single engine region — proxy region selection available', status: 'partial', gap: 'Single engine region vs multi-region fleet', closable: false, hardened: true, validated: true, test: 'engineHealth', score: 60 },
      { name: 'Environment Pinning', benchmark: 'Environment pinning + reproducible runners (Browserbase)', cloudBrowser: 'Session config with viewport, UA, locale, timezone, proxy, headers', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 95 },
      { name: 'Chrome Version Management', benchmark: 'Chrome 132+ with auto-updates (Browserbase)', cloudBrowser: 'Playwright-managed Chromium with version tracking', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineHealth', score: 90 },
      { name: 'Mobile Device Emulation', benchmark: 'Device emulation for mobile testing', cloudBrowser: 'Viewport + user agent + touch config per session', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
    ],
  },
  {
    category: 'Anti-Detection & Stealth',
    icon: 'shield',
    capabilities: [
      { name: 'Stealth Browser (Basic)', benchmark: 'Automatic CAPTCHA detection + realistic fingerprints (Browserbase)', cloudBrowser: 'Self-hosted captcha solver + fingerprint config + stealth options', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 90 },
      { name: 'Stealth Browser (Advanced)', benchmark: 'Custom Chromium with randomized agent behavior (Browserbase)', cloudBrowser: 'Fingerprint randomizer (WebGL, Canvas, AudioContext, fonts, plugins)', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 95 },
      { name: 'CAPTCHA Solving (reCAPTCHA v2)', benchmark: 'Built-in reCAPTCHA v2 solver (Bright Data)', cloudBrowser: 'Self-hosted audio solver + 2captcha/anticaptcha/capmonster fallback', status: 'implemented', gap: 'Self-solver limited on high-security targets', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 80 },
      { name: 'CAPTCHA Solving (hCaptcha)', benchmark: 'Built-in hCaptcha solver including image challenges (Bright Data)', cloudBrowser: 'Self-hosted hCaptcha solver + provider fallback', status: 'partial', gap: 'Image challenge solver incomplete for hCaptcha', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 70 },
      { name: 'CAPTCHA Solving (Turnstile)', benchmark: 'Cloudflare Turnstile bypass (Bright Data)', cloudBrowser: 'Self-hosted Turnstile solver', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 85 },
      { name: 'TLS/JA3 Fingerprinting', benchmark: 'Reliable TLS fingerprints to avoid detection (Bright Data)', cloudBrowser: 'Configurable TLS fingerprint via engine config', status: 'partial', gap: 'TLS fingerprint matching not fully automated', closable: false, hardened: true, validated: true, test: 'engineAction', score: 70 },
      { name: 'Browser Fingerprint Randomization', benchmark: 'WebGL, Canvas, AudioContext randomization (Hyperbrowser)', cloudBrowser: 'Fingerprint randomizer module with 4 WebGL configs, 5 screens, 7 languages', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 95 },
      { name: 'Human Behavior Simulation', benchmark: 'Behavior simulation + human interaction patterns (Hyperbrowser)', cloudBrowser: 'Bezier curve mouse paths, typing jitter, ease-in-out scroll', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 95 },
      { name: 'Residential Proxy Network', benchmark: '400M+ residential IPs across 195 countries (Bright Data)', cloudBrowser: 'Proxy CRUD with rotation groups + external proxy support', status: 'partial', gap: 'No built-in proxy network — user must supply proxies', closable: false, hardened: true, validated: true, test: 'testProxy', score: 60 },
      { name: 'City/State/ASN/ZIP Targeting', benchmark: 'City/state/ASN/ZIP-level proxy targeting (Bright Data)', cloudBrowser: 'Country-level proxy field only', status: 'partial', gap: 'No city/state/ASN/ZIP targeting fields', closable: true, hardened: false, validated: false, test: 'pending', score: 40 },
      { name: 'Cookie Management', benchmark: 'Contexts API for cookies + state (Browserbase)', cloudBrowser: 'Cookie import/export + encrypted storage in Profile entity', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'saveProfile', score: 95 },
    ],
  },
  {
    category: 'Session Management & Debugging',
    icon: 'eye',
    capabilities: [
      { name: 'Live Session Viewing', benchmark: 'Live View with Chrome DevTools (Browserbase)', cloudBrowser: 'LiveView component with share token + CDP URL', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
      { name: 'Session Replay', benchmark: 'Session Replay with video + logs (Browserbase)', cloudBrowser: 'Video recording + LogEntry timeline + Screenshot capture', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 85 },
      { name: 'Session Inspector', benchmark: 'Session Inspector with network + console (Browserbase)', cloudBrowser: 'HAR file generation + console log capture + network mocks', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 90 },
      { name: 'Session Sharing', benchmark: 'Shareable session URLs (Browserbase)', cloudBrowser: 'Share token with ShareView page', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'ShareView', score: 95 },
      { name: 'Data Retention', benchmark: '7-90+ day retention with auto-cleanup (Browserbase)', cloudBrowser: 'Configurable retention (screenshot/log/video) + reapExpired function', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'reapExpired', score: 95 },
      { name: 'Network Interception', benchmark: 'Network interception for request visibility (Browserbase)', cloudBrowser: 'Network mocks + capture_response step + HAR generation', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 90 },
      { name: 'Console Log Capture', benchmark: 'Console log capture for debugging (Browserbase)', cloudBrowser: 'LogEntry entity with level + message + timestamp', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 95 },
      { name: 'HAR File Generation', benchmark: 'HAR file export (Browserbase)', cloudBrowser: 'HAR 1.2 compliant generator from network logs', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 100 },
      { name: 'Multi-Tab Support', benchmark: 'Multi-tab browser management', cloudBrowser: 'Tab state tracking in Session entity + new_tab/switch_tab/close_tab steps', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
      { name: 'CDP Debugging', benchmark: 'Chrome DevTools Protocol access (Browserbase)', cloudBrowser: 'CDP URL exposure + enable_cdp config', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
      { name: 'Video Recording', benchmark: 'Session video recording (Browserbase)', cloudBrowser: 'Video recording config + video_url + retention', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
    ],
  },
  {
    category: 'AI & Automation',
    icon: 'sparkles',
    capabilities: [
      { name: 'AI-Assisted Element Targeting', benchmark: 'Stagehand with visual/semantic element recognition (Browserbase)', cloudBrowser: 'Self-healing selectors via LLM + AI job builder', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'selfHealSelector', score: 90 },
      { name: 'Self-Healing Selectors', benchmark: 'AI-powered selector recovery (Browserbase)', cloudBrowser: 'selfHealSelector function with LLM + confidence scoring', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateEnhancements', score: 100 },
      { name: 'Intelligent Retry', benchmark: 'Smart retries with error analysis (Browserbase)', cloudBrowser: 'intelligentRetry function with LLM category + delay + strategy', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateEnhancements', score: 100 },
      { name: 'AI Job Builder', benchmark: 'Natural language to automation steps (Skyvern)', cloudBrowser: 'AiJobBuilder page + aiBuildSteps function', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'aiBuildSteps', score: 90 },
      { name: 'Multi-Step Workflow Chaining', benchmark: 'Multi-step workflow chaining (Skyvern)', cloudBrowser: 'Job dependencies + fan-out/fan-in + dependency conditions', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runJob', score: 90 },
      { name: 'MCP Server for AI Agents', benchmark: 'MCP Server connecting AI agents to browser (Bright Data)', cloudBrowser: 'MCP tools endpoint + mcpTools function', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runMcpBlackBox', score: 85 },
      { name: 'Anti-Bot System Detection', benchmark: 'Detect + bypass 30+ anti-bot systems (Bright Data)', cloudBrowser: 'antiBotDetection module — detects Cloudflare, Akamai, DataDome, reCAPTCHA, hCaptcha, Turnstile, +10 more', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 90 },
      { name: 'PII Redaction', benchmark: 'Data privacy in extracted content', cloudBrowser: 'Regex-based PII redaction (email, SSN, CC, phone, IP, API key, IBAN)', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateEnhancements', score: 100 },
      { name: 'Anomaly Detection', benchmark: 'Data quality + anomaly detection in results', cloudBrowser: 'MAD-based outlier detection + duplicates + missing fields', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateEnhancements', score: 100 },
      { name: 'Shadow Mode', benchmark: 'Read-only safe testing before live execution', cloudBrowser: 'Shadow mode toggle + shadow_report with defense analysis', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runJob', score: 95 },
    ],
  },
  {
    category: 'Security & Enterprise',
    icon: 'lock',
    capabilities: [
      { name: 'SSO/SAML', benchmark: 'SSO/SAML authentication (Browserbase)', cloudBrowser: 'Base44 built-in auth (email + Google OAuth)', status: 'partial', gap: 'No SAML/OIDC enterprise SSO', closable: false, hardened: true, validated: true, test: 'AuthContext', score: 60 },
      { name: 'RBAC', benchmark: 'Role-based access control (Browserbase)', cloudBrowser: 'Admin/user roles with RLS on all entities', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runTenantIsolationTests', score: 95 },
      { name: 'Per-Project Isolation', benchmark: 'Per-project isolation (Browserbase)', cloudBrowser: 'Project entity + project_id on Job/Session + RLS', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runTenantIsolationTests', score: 95 },
      { name: 'Encrypted Storage', benchmark: 'Encrypted storage for credentials (Browserbase)', cloudBrowser: 'AES-GCM encryption for proxies, profiles, webhooks, store credentials', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'saveProxy + saveProfile', score: 100 },
      { name: 'API Key Management', benchmark: 'API key management with scopes + rotation (Browserbase)', cloudBrowser: 'ApiKey entity with SHA-256 hashing, scopes, expiration, rotation', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateSecurity', score: 100 },
      { name: 'IP Allowlist', benchmark: 'IP allowlist for API access (Browserbase)', cloudBrowser: 'SystemSettings.ip_allowlist config', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'apiGateway', score: 90 },
      { name: 'SSRF Protection', benchmark: 'SSRF prevention for URL navigation', cloudBrowser: 'SSRF protection module — blocks private IPs, metadata endpoints, dangerous protocols', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateSecurity', score: 100 },
      { name: 'Rate Limiting', benchmark: 'API rate limiting (Browserbase)', cloudBrowser: 'Fixed-window rate limiter with SHA-256 hashed keys', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateSecurity', score: 100 },
      { name: 'URL Validation', benchmark: 'URL sanitization for safe navigation', cloudBrowser: 'URL validator — blocks javascript:, data:, file:, embedded credentials', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateSecurity', score: 100 },
      { name: 'Audit Logging', benchmark: 'Audit logging for compliance (Browserbase)', cloudBrowser: 'AuditLog entity + logAudit function + comprehensive trail', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'logAudit', score: 95 },
      { name: 'Budget Enforcement', benchmark: 'Cost controls + budget alerts', cloudBrowser: 'checkBudget function with per-project limits + audit', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateEnhancements', score: 100 },
      { name: 'SOC 2 / HIPAA Compliance', benchmark: 'SOC 2 Type II + HIPAA (Bright Data)', cloudBrowser: 'Not certified — architectural security controls in place', status: 'gap', gap: 'Requires external audit + certification', closable: false, hardened: false, validated: false, test: 'N/A — external audit', score: 30 },
    ],
  },
  {
    category: 'Data & Observability',
    icon: 'activity',
    capabilities: [
      { name: 'Artifact Capture (Video/HAR/Screenshots)', benchmark: 'Video, HAR, screenshots capture (Browserbase)', cloudBrowser: 'Video recording + HAR generation + Screenshot entity + diff', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateCapabilities', score: 95 },
      { name: 'Granular Logs', benchmark: 'Granular logs for root-cause analysis (Browserbase)', cloudBrowser: 'LogEntry entity with level + message + session/job linking', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 95 },
      { name: 'Metrics & Monitoring', benchmark: 'Metrics + monitoring dashboard (Browserbase)', cloudBrowser: 'getMetrics + getObservabilityMetrics + engineHealth functions', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'getMetrics', score: 90 },
      { name: 'Cost Tracking', benchmark: 'Cost tracking + usage analytics (Browserbase)', cloudBrowser: 'CostEntry entity + costTracker module + calculateCost + forecastCost', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateReliability', score: 100 },
      { name: 'Usage Analytics', benchmark: 'Usage analytics dashboard (Browserbase)', cloudBrowser: 'Analytics page with charts + CostEntry aggregation', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'getMetrics', score: 85 },
      { name: 'Error Tracking', benchmark: 'Error tracking + pattern grouping (Browserbase)', cloudBrowser: 'ErrorPattern entity with fingerprinting + category + affected jobs', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'ErrorsPage', score: 90 },
      { name: 'Real-Time Alerts', benchmark: 'Real-time alerts + notifications (Browserbase)', cloudBrowser: 'Notification entity + sendNotification + webhook alerts', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'sendNotification', score: 85 },
      { name: 'Change Detection', benchmark: 'Change detection + monitoring (Browse.ai)', cloudBrowser: 'diffScreenshots function + ChangeAlert entity', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'diffScreenshots', score: 85 },
    ],
  },
  {
    category: 'Data Extraction',
    icon: 'table',
    capabilities: [
      { name: 'Structured Data Extraction', benchmark: 'Structured data extraction with schema validation', cloudBrowser: 'extract_text/extract_html/extract_table/extract_json + output_schema', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 95 },
      { name: 'AI-Powered Extraction', benchmark: 'AI-powered extraction with LLM (Browserbase Stagehand)', cloudBrowser: 'ai_extract step type + InvokeLLM integration', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'aiBuildSteps', score: 90 },
      { name: 'Screenshot Capture', benchmark: 'Screenshot capture + comparison (Browserbase)', cloudBrowser: 'Screenshot entity + screenshot step + diffScreenshots', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'diffScreenshots', score: 95 },
      { name: 'PDF Generation', benchmark: 'PDF generation from pages', cloudBrowser: 'pdf step type in Step entity', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 90 },
      { name: 'CSV/JSON Export', benchmark: 'Data export in multiple formats', cloudBrowser: 'exportResults function with CSV/JSON', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'exportResults', score: 90 },
      { name: 'Webhook Delivery', benchmark: 'Webhook delivery with retry + signing (Browserbase)', cloudBrowser: 'webhookDelivery module with HMAC-SHA256 + exponential backoff + tracking', status: 'implemented', gap: 'none', closable: true, hardened: true, validated: true, test: 'validateReliability', score: 100 },
      { name: 'Crawling + Pagination', benchmark: 'Auto-crawling + pagination support', cloudBrowser: 'crawl + paginate step types', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 85 },
    ],
  },
  {
    category: 'Scalability & Orchestration',
    icon: 'layers',
    capabilities: [
      { name: 'Distributed Job Queue', benchmark: 'Distributed job queue with priority (Browserbase)', cloudBrowser: 'Job entity with status + priority + fan-out/fan-in', status: 'partial', gap: 'No external queue (Kafka/RabbitMQ) — in-app queue only', closable: false, hardened: true, validated: true, test: 'runJob', score: 75 },
      { name: 'Scheduled Jobs (Cron)', benchmark: 'Scheduled job execution (Browserbase)', cloudBrowser: 'Schedule entity + checkSchedules + runScheduledJob + workflow', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'checkSchedules', score: 95 },
      { name: 'Fan-Out/Fan-In', benchmark: 'Parallel job execution across URLs', cloudBrowser: 'fan_out_urls + parent_job_id + dependency_condition', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'runJob', score: 90 },
      { name: 'Concurrency Management', benchmark: 'Concurrency limits + quotas (Browserbase)', cloudBrowser: 'Concurrency quotas module + max_concurrent_sessions', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'concurrencyQuotas', score: 90 },
      { name: 'Autoscaling', benchmark: 'Autoscaling to thousands of sessions (Browserbase)', cloudBrowser: 'Manual pool sizing — no autoscaling', status: 'partial', gap: 'No autoscaling — requires manual pool config', closable: false, hardened: true, validated: true, test: 'managePool', score: 50 },
      { name: 'Template System', benchmark: 'Reusable automation templates', cloudBrowser: 'Template entity + Templates page', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'Templates', score: 85 },
      { name: 'Orphan Recovery', benchmark: 'Automatic recovery of orphaned sessions', cloudBrowser: 'recoverOrphans function', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'recoverOrphans', score: 90 },
      { name: 'Settings Reconciliation', benchmark: 'Settings sync + drift detection', cloudBrowser: 'reconcileSettings + Setting entity with drift_status', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'reconcileSettings', score: 90 },
    ],
  },
  {
    category: 'Developer Experience',
    icon: 'code',
    capabilities: [
      { name: 'REST API', benchmark: 'REST API with OpenAPI docs (Browserbase)', cloudBrowser: 'apiGateway function + ApiDocs page', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'apiGateway', score: 90 },
      { name: 'JavaScript SDK', benchmark: 'JavaScript SDK (Browserbase)', cloudBrowser: 'base44 SDK + API client', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'base44Client', score: 85 },
      { name: 'Python SDK', benchmark: 'Python SDK (Browserbase)', cloudBrowser: 'Not available — JS-only platform', status: 'gap', gap: 'No Python SDK', closable: false, hardened: false, validated: false, test: 'N/A', score: 0 },
      { name: 'Playwright Integration', benchmark: 'Playwright integration (Browserbase)', cloudBrowser: 'Engine built on Playwright', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 100 },
      { name: 'Puppeteer Integration', benchmark: 'Puppeteer integration (Browserbase)', cloudBrowser: 'CDP endpoint enables Puppeteer connection', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'engineAction', score: 85 },
      { name: 'CI/CD Integration', benchmark: 'CI/CD integration with reproducible runners (Browserbase)', cloudBrowser: 'GitHub sync + Railway deploy + release gates', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'release-gate.yml', score: 85 },
      { name: 'Webhook Integrations', benchmark: 'Webhook integrations (Slack, Discord, generic) (Browserbase)', cloudBrowser: 'Webhook entity with Slack/Discord/generic providers', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'triggerWebhook', score: 90 },
      { name: 'Code Generation Playground', benchmark: 'AI codegen playground (Browserbase)', cloudBrowser: 'AiJobBuilder + aiBuildSteps — NL to automation steps', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'aiBuildSteps', score: 85 },
      { name: 'Command Palette', benchmark: 'Quick keyboard-accessible navigation', cloudBrowser: 'CommandPalette with Cmd+K + recent jobs + theme toggle', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'CommandPalette', score: 95 },
      { name: 'Dark Mode', benchmark: 'Dark mode support', cloudBrowser: 'next-themes with persisted toggle', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'ThemeProvider', score: 100 },
      { name: 'Kanban Board', benchmark: 'Visual job management', cloudBrowser: 'JobKanban with drag-and-drop status management', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'JobKanban', score: 95 },
    ],
  },
  {
    category: 'Anti-Bot Bypass Coverage',
    icon: 'shield-check',
    capabilities: [
      { name: 'Cloudflare Turnstile', benchmark: 'Cloudflare Turnstile bypass (Bright Data)', cloudBrowser: 'Self-hosted Turnstile solver', status: 'implemented', gap: 'none', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 85 },
      { name: 'reCAPTCHA v2/v3', benchmark: 'reCAPTCHA v2/v3 bypass (Bright Data)', cloudBrowser: 'Self-hosted audio solver + provider fallback', status: 'implemented', gap: 'Self-solver limited on high-security', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 75 },
      { name: 'hCaptcha', benchmark: 'hCaptcha bypass including image challenges (Bright Data)', cloudBrowser: 'Self-hosted hCaptcha solver + provider fallback', status: 'partial', gap: 'Image challenge solver incomplete', closable: false, hardened: true, validated: true, test: 'testCaptchaSolver', score: 65 },
      { name: 'Akamai Bot Manager', benchmark: 'Akamai Bot Manager bypass (Bright Data)', cloudBrowser: 'Detection module — bypass requires engine-level sensor data', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'DataDome', benchmark: 'DataDome bypass (Bright Data)', cloudBrowser: 'Detection module — bypass requires residential proxy + fingerprint', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'PerimeterX', benchmark: 'PerimeterX bypass (Bright Data)', cloudBrowser: 'Detection module — bypass requires proxy + behavior', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'Kasada', benchmark: 'Kasada bypass (Bright Data)', cloudBrowser: 'Detection module — bypass requires custom Chromium', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'Imperva/Incapsula', benchmark: 'Imperva bypass (Bright Data)', cloudBrowser: 'Detection module', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'Arkose Labs (FunCaptcha)', benchmark: 'Arkose Labs bypass (Bright Data)', cloudBrowser: 'Detection module', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
      { name: 'GeeTest', benchmark: 'GeeTest bypass (Bright Data)', cloudBrowser: 'Detection module', status: 'partial', gap: 'Detection only — no automated bypass', closable: false, hardened: true, validated: true, test: 'validateCapabilities', score: 50 },
    ],
  },
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Calculate aggregate scores
    let totalScore = 0;
    let totalCapabilities = 0;
    let implementedCount = 0;
    let partialCount = 0;
    let gapCount = 0;
    let hardenedCount = 0;
    let validatedCount = 0;
    let closableGaps = 0;

    for (const cat of CATEGORIES) {
      for (const cap of cat.capabilities) {
        totalScore += cap.score;
        totalCapabilities++;
        if (cap.status === 'implemented') implementedCount++;
        else if (cap.status === 'partial') partialCount++;
        else gapCount++;
        if (cap.hardened) hardenedCount++;
        if (cap.validated) validatedCount++;
        if (cap.status !== 'implemented' && cap.closable) closableGaps++;
      }
    }

    const averageScore = Math.round(totalScore / totalCapabilities);

    // Collect all gaps
    const gaps: any[] = [];
    for (const cat of CATEGORIES) {
      for (const cap of cat.capabilities) {
        if (cap.status !== 'implemented') {
          gaps.push({
            category: cat.category,
            capability: cap.name,
            status: cap.status,
            gap: cap.gap,
            closable: cap.closable,
            currentScore: cap.score,
          });
        }
      }
    }

    return Response.json({
      benchmark: 'Bright Data Agent Browser + Browserbase (combined)',
      categories: CATEGORIES,
      summary: {
        totalCapabilities,
        implemented: implementedCount,
        partial: partialCount,
        gaps: gapCount,
        closableGaps,
        hardened: hardenedCount,
        validated: validatedCount,
        averageScore,
        benchmarkMatch: averageScore >= 90,
      },
      gaps,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}