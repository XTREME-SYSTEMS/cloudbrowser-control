import {
  Box, Monitor, Eye, Repeat, History, Terminal,
  Workflow, Activity, Layers, Puzzle, Clock,
  Search, Radar, Sparkles, Camera, FileText, Copy,
  Network, Users, Database, BarChart3,
  Globe, Shield, Fingerprint, MapPin, KeyRound,
  Bot, Send, Cpu,
  Plug, Code2, Scale, Archive, Gauge,
} from "lucide-react";

/**
 * THE CAPABILITY MAP OF A CLOUD BROWSER PLATFORM
 * ==========================================================================
 * Assembled from what the established platforms in this category actually
 * sell — Browserbase, Browserless, Bright Data, Cloudflare Browser Run,
 * Browser Use, Firecrawl, Apify, Oxylabs, Zyte. Their published capability
 * sets were reduced to the functions that recur across all of them, then
 * mapped onto this app.
 *
 * `route` is the working screen for that capability. A null route means the
 * capability is not built here yet, and it is shown as such rather than
 * presented as if it worked.
 */
export const CAPABILITY_GROUPS = [
  {
    group: "Browser Infrastructure",
    note: "One browser per machine, no reuse between customers.",
    items: [
      { label: "Build a Sandbox", desc: "Isolated browser environment, zero reuse", icon: Box, route: "/sandboxes" },
      { label: "Browser Sessions", desc: "Live Chromium you drive remotely", icon: Monitor, route: "/sessions" },
      { label: "Live View", desc: "Watch a running browser, take it over", icon: Eye, route: null },
      { label: "Persistent Contexts", desc: "Reusable logged-in browser state", icon: Repeat, route: null },
      { label: "Session Recordings", desc: "Replay DOM, clicks and navigation", icon: History, route: null },
      { label: "Session Logs", desc: "Network, console and CDP events", icon: Terminal, route: null },
    ],
  },
  {
    group: "Workflows & Automation",
    note: "The work itself: triggered, chained, scheduled.",
    items: [
      { label: "Build a Workflow", desc: "Trigger, branch, wait, chain steps", icon: Workflow, route: "/autonomous-workflows" },
      { label: "Run a Job", desc: "Queue a browser task and track it", icon: Activity, route: "/jobs" },
      { label: "Batch Operations", desc: "Thousands of rows in one pass", icon: Layers, route: "/batch" },
      { label: "Visual Job Builder", desc: "Assemble a job without code", icon: Puzzle, route: null },
      { label: "Schedules", desc: "Run on a cron or fixed interval", icon: Clock, route: null },
    ],
  },
  {
    group: "Search & Extraction",
    note: "Finding the data, and getting it out clean.",
    items: [
      { label: "Deep Search", desc: "Recursive multi-level source discovery", icon: Search, route: "/skip-tracing" },
      { label: "Crawl & Scrape", desc: "Walk a site and extract its structure", icon: Radar, route: null },
      { label: "Structured Extraction", desc: "Model-parsed fields from any page", icon: Sparkles, route: null },
      { label: "Screenshots & PDFs", desc: "Captures and documents at scale", icon: Camera, route: null },
      { label: "Page to Markdown", desc: "Clean text for AI pipelines", icon: FileText, route: null },
      { label: "Site Clone", desc: "Rebuild a site to parity", icon: Copy, route: "/clone-studio" },
    ],
  },
  {
    group: "Data Intelligence",
    note: "Records turned into something you can act on.",
    items: [
      { label: "Skip Trace", desc: "Owner, contacts, relatives, associates", icon: Network, route: "/skip-tracing" },
      { label: "Heir & Probate Search", desc: "Kinship graph with claim-level evidence", icon: Users, route: "/heir-search" },
      { label: "Data Enrichment", desc: "Append, verify and score records", icon: Layers, route: null },
      { label: "Datasets", desc: "Bulk historical records on demand", icon: Database, route: null },
      { label: "Keyword Intelligence", desc: "Demand and keyword discovery", icon: BarChart3, route: "/keyword-intelligence" },
      { label: "Signal Command Center", desc: "Signals turned into decisions", icon: Radar, route: "/intelligence-command-center" },
    ],
  },
  {
    group: "Access, Stealth & Geolocation",
    note: "Reaching sites that resist automation.",
    items: [
      { label: "Proxy Pool", desc: "Geo-targeted, health-scored rotation", icon: Globe, route: null },
      { label: "CAPTCHA Solving", desc: "Engine, vision and third-party fallback", icon: Shield, route: null },
      { label: "Fingerprint Control", desc: "Consistent browser identity per session", icon: Fingerprint, route: null },
      { label: "Geographic Targeting", desc: "Country, city, state and ASN", icon: MapPin, route: null },
      { label: "Authenticated Sessions", desc: "Portals and accounts behind a login", icon: KeyRound, route: null },
    ],
  },
  {
    group: "AI Agents",
    note: "The browser driven by a model instead of a script.",
    items: [
      { label: "Build an Agent", desc: "Tools, memory and guardrails", icon: Bot, route: "/agent-builder" },
      { label: "Swarm Orchestrator", desc: "Many agents on one prompt", icon: Network, route: "/swarm-orchestrator" },
      { label: "Mission Control", desc: "Observe every agent run", icon: Activity, route: "/mission-control" },
      { label: "Autonomous Mission", desc: "Goal in, result out", icon: Send, route: "/mission" },
      { label: "Dream Factory", desc: "Self-improvement cycles", icon: Sparkles, route: "/dream-factory" },
      { label: "Meta Architect", desc: "Designs its own systems", icon: Cpu, route: "/architect" },
    ],
  },
  {
    group: "Delivery, API & Governance",
    note: "Getting the output out, and proving how it was made.",
    items: [
      { label: "MCP Server", desc: "Expose your tools to AI clients", icon: Plug, route: "/mcp-creator" },
      { label: "REST API", desc: "Call every capability directly", icon: Code2, route: "/api-docs" },
      { label: "Integrations", desc: "Connect external services", icon: Network, route: "/connect" },
      { label: "Reports & Exports", desc: "Sheets, PDFs, delivery packs", icon: FileText, route: "/strategic-report" },
      { label: "Quality Gates", desc: "Certification before delivery", icon: Scale, route: "/standards" },
      { label: "Team & Roles", desc: "Invite and permission your staff", icon: Users, route: "/team" },
      { label: "Audit Logs", desc: "Every action, attributable", icon: Archive, route: null },
      { label: "Cost Control", desc: "Spend per job and per browser hour", icon: Gauge, route: null },
    ],
  },
];

/**
 * What buyers in this market actually come for, taken from the published
 * solution pages of the platforms above (Browserless markets web scraping,
 * automation, testing, AI agents and screenshots/PDFs as five separate
 * products; Bright Data sells proxies, scrapers, search APIs and datasets).
 */
export const BUYER_NEEDS = [
  "Web scraping & data extraction",
  "AI agent browser access",
  "Lead generation & prospecting",
  "Price & competitor monitoring",
  "SEO & SERP measurement",
  "Property & owner intelligence",
  "Authenticated portal automation",
  "Screenshots & PDF evidence",
  "QA & visual regression testing",
  "Site change monitoring & alerts",
  "Bulk enrichment pipelines",
  "Compliance evidence capture",
  "Market & portfolio research",
  "Dataset licensing",
];