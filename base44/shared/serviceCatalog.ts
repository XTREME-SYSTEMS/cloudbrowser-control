/**
 * SERVICE CATALOG — the single source of truth for what this platform sells.
 * ==========================================================================
 * Read by the admin dashboard, the service pages, the run engine, and the
 * marketing site, so all four can never drift apart.
 *
 * Every workflow below follows the same production spine that managed data
 * and browser-automation firms actually run, because that spine is what
 * buyers audit for: intake → authorization gate → feasibility sample →
 * build → human sample gate → production run → evidence capture → QA →
 * policy guardian → independent validation → delivery → monitoring.
 *
 * Per-service differences are in WHAT each step acts on, not in whether the
 * step exists. Pricing figures are published market ranges gathered from
 * competitor pricing pages, not quotes from this platform.
 */

export type WorkflowStep = {
  n: number;
  name: string;
  desc: string;
  result: string;
};

export type ServiceAgent = {
  name: string;
  role: "producer" | "monitor" | "qa" | "guardian" | "validator" | "delivery";
  specialty: string;
};

export type ServiceBenchmark = {
  company: string;
  how_they_run: string;
  price_signal: string;
  verification: "verified_primary_source" | "secondary_source" | "vendor_claim_unverified";
};

export type Service = {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  group: "Acquisition" | "Intelligence" | "Operations" | "Assurance";
  summary: string;
  buyer: string;
  workflow: WorkflowStep[];
  agents: ServiceAgent[];
  pricing: { model: string; range: string; unit: string; notes: string };
  deliverables: string[];
  initiation: string[];
  monitoring: { cadence: string; signals: string[]; alerts: string[] };
  benchmarks: ServiceBenchmark[];
  sources: string[];
};

export const SERVICE_CATALOG: Service[] = [
  {
    slug: "web-scraping-data-extraction",
    name: "Web Scraping & Data Extraction",
    tagline: "Structured records from sites that actively resist extraction",
    icon: "Radar",
    group: "Intelligence",
    summary:
      "Managed extraction of structured records from dynamic, protected sources, delivered on a schedule with hash-matched evidence for every record.",
    buyer: "Data teams, market researchers, agencies reselling datasets",
    workflow: [
      { n: 1, name: "Intake & Volume Scoping", desc: "Capture target sources, required fields, volume, cadence and delivery format.", result: "Scoped request with field map and volume estimate" },
      { n: 2, name: "Authorization Review", desc: "Confirm terms, robots posture, licensing and the lawful basis for this data.", result: "Documented lawful basis, or a refusal in writing" },
      { n: 3, name: "Feasibility Sample", desc: "Fingerprint the site's defences and test a live sample of real records.", result: "Feasibility verdict with expected yield" },
      { n: 4, name: "Extraction Build", desc: "Configure selectors, pagination, session rotation, proxy route and retry policy.", result: "Deployed extraction workflow, versioned" },
      { n: 5, name: "Human Sample Gate", desc: "Deliver a reviewed sample so the schema is locked before volume spend.", result: "Signed-off sample and frozen schema" },
      { n: 6, name: "Production Run", desc: "Run parallel isolated sessions with rotating proxies and fingerprints.", result: "Production records landed in the delivery store" },
      { n: 7, name: "Evidence Capture", desc: "Record source URL, retrieval timestamp and content hash per record.", result: "Hash-matched evidence ledger" },
      { n: 8, name: "QA Arbiter Review", desc: "Score completeness, accuracy and schema conformance against the locked sample.", result: "QA score with any failed rules named" },
      { n: 9, name: "Policy Guardian", desc: "Block delivery on any licensing, privacy or robots violation found.", result: "Approved, or blocked with the reason stated" },
      { n: 10, name: "Delivery & Drift Watch", desc: "Ship the dataset and watch the source for structural change.", result: "Delivery receipt plus drift alerts" },
    ],
    agents: [
      { name: "Extraction Architect", role: "producer", specialty: "Builds and versions the extractor for each source" },
      { name: "Drift Sentinel", role: "monitor", specialty: "Detects selector and layout drift before yield collapses" },
      { name: "QA Arbiter", role: "qa", specialty: "Scores completeness, accuracy and schema conformance" },
      { name: "Policy Guardian", role: "guardian", specialty: "Blocks delivery on licensing, privacy or robots breaches" },
      { name: "Independent Validator", role: "validator", specialty: "Re-fetches a random sample on a separate model family" },
      { name: "Delivery Steward", role: "delivery", specialty: "Formats, ships and logs each delivery against the SLA" },
    ],
    pricing: { model: "Per record plus managed build", range: "$0.004 – $0.05 per record; $2,000 – $25,000 per managed build", unit: "per record", notes: "API vendors sit at $49–$2,000/month for 98K–8M results. Managed builds price on difficulty, not just volume." },
    deliverables: ["Structured dataset (CSV, Sheets or API feed)", "Field map and schema document", "Evidence ledger with source hashes", "QA score report", "Drift monitors on every source"],
    initiation: ["Kickoff: target sources, fields and volume confirmed", "Authorization pack signed before any fetch", "Feasibility sample delivered within 72 hours", "Sample approved, schema frozen", "Production cadence and delivery channel agreed"],
    monitoring: { cadence: "Continuous, with per-run reporting", signals: ["Yield per source", "Block rate and CAPTCHA count", "Schema conformance", "Drift score per source"], alerts: ["Yield drop below 80% of baseline", "New anti-bot challenge detected", "Schema drift above threshold"] },
    benchmarks: [
      { company: "Bright Data", how_they_run: "Proxies, scrapers, search APIs and datasets sold as one unblocking suite with geo-targeted rotation.", price_signal: "Per-record and subscription; enterprise contracts", verification: "vendor_claim_unverified" },
      { company: "Oxylabs", how_they_run: "Proxies, scraping APIs, headless browsers and datasets; acquired ScrapingBee in 2025.", price_signal: "$49/month for 98K results up to $2,000/month for 8M", verification: "vendor_claim_unverified" },
      { company: "Firecrawl", how_they_run: "API-first scrape, crawl and search built for AI pipelines, with enterprise controls.", price_signal: "Usage-based API credits", verification: "secondary_source" },
    ],
    sources: ["https://www.firecrawl.dev/blog/best-enterprise-scraping-services", "https://oxylabs.io/"],
  },
  {
    slug: "ai-agent-browser-access",
    name: "AI Agent Browser Access",
    tagline: "A real browser for every agent, isolated and observable",
    icon: "Bot",
    group: "Intelligence",
    summary:
      "Managed remote browsers that an AI agent drives directly, with per-session isolation, live observation, replayable recordings and hard spend limits.",
    buyer: "AI product teams, automation engineers, agent platform builders",
    workflow: [
      { n: 1, name: "Task Definition", desc: "Turn the business goal into a bounded browser task with success criteria.", result: "Machine-readable task contract" },
      { n: 2, name: "Authorization Review", desc: "Confirm the agent is permitted to act on the target and what it may change.", result: "Permitted action list, or a refusal" },
      { n: 3, name: "Environment Provision", desc: "Provision one isolated browser per task with no reuse across tenants.", result: "Fresh sandbox with proxy and fingerprint" },
      { n: 4, name: "Agent Binding", desc: "Bind the chosen model, tools, memory and guardrails to the session.", result: "Agent configuration locked to the run" },
      { n: 5, name: "Supervised Dry Run", desc: "Run the task with live view on and no writes enabled.", result: "Replay with the risky steps identified" },
      { n: 6, name: "Autonomous Execution", desc: "Execute with retry, CAPTCHA fallback and step-level checkpoints.", result: "Completed task with per-step trace" },
      { n: 7, name: "Action Evidence Capture", desc: "Record every click, navigation and page state as replayable evidence.", result: "Session recording and action log" },
      { n: 8, name: "QA Arbiter Review", desc: "Score whether the agent completed the task or merely appeared to.", result: "Task completion score, claims verified" },
      { n: 9, name: "Policy Guardian", desc: "Block any run that touched a prohibited action, field or destination.", result: "Pass, or blocked with the offending step" },
      { n: 10, name: "Cost and Drift Report", desc: "Report browser minutes, model spend and where the agent hesitated.", result: "Per-run cost and friction report" },
    ],
    agents: [
      { name: "Task Binder", role: "producer", specialty: "Converts goals into bounded, testable browser tasks" },
      { name: "Session Warden", role: "monitor", specialty: "Watches live sessions for stalls, loops and runaway spend" },
      { name: "QA Arbiter", role: "qa", specialty: "Verifies the task actually completed, not that it looked finished" },
      { name: "Policy Guardian", role: "guardian", specialty: "Blocks prohibited actions, fields and destinations" },
      { name: "Independent Validator", role: "validator", specialty: "Replays the task trace on a separate model to confirm the outcome" },
    ],
    pricing: { model: "Per browser hour plus per agent run", range: "$0.05 – $0.50 per browser hour; $0.50 – $8.00 per agent run", unit: "per browser hour", notes: "Platforms in this category give a free tier then charge usage; managed agents are priced per completed task." },
    deliverables: ["Session recording and action log", "Task completion report with evidence", "Per-run cost breakdown", "Guardrail configuration document", "Replay-ready task trace"],
    initiation: ["Task inventory workshop", "Authorization and prohibited-action list agreed", "Sandbox environment provisioned", "Supervised dry run reviewed together", "Autonomy level and spend caps set"],
    monitoring: { cadence: "Live during every run", signals: ["Session health", "Step latency", "Cost per run", "Guardrail trips"], alerts: ["Run exceeding spend cap", "Agent loop detected", "Prohibited action intercepted"] },
    benchmarks: [
      { company: "Browserbase", how_they_run: "Remote Chromium per session with Contexts for persisted state, Live View, session recordings and network/console/CDP capture.", price_signal: "Free tier then usage-based", verification: "vendor_claim_unverified" },
      { company: "Browser Use", how_they_run: "Managed cloud browsers over CDP for your own agent code, or a fully hosted Cloud API that runs the agent.", price_signal: "Usage-based per session", verification: "secondary_source" },
      { company: "Cloudflare Browser Run", how_they_run: "Headless Chrome on Cloudflare's network with Quick Actions REST endpoints, live view and human-in-the-loop.", price_signal: "Per request past the free allowance", verification: "secondary_source" },
    ],
    sources: ["https://mastra.ai/articles/best-ai-agent-browser-infrastructure-platforms", "https://www.browserbase.com/"],
  },
  {
    slug: "lead-generation-prospecting",
    name: "Lead Generation & Prospecting",
    tagline: "Qualified contacts built from source, not bought as a list",
    icon: "Target",
    group: "Acquisition",
    summary:
      "Prospect lists assembled from live source data, enriched with contact points, scored against your ideal profile, and loaded only after verification and consent checks.",
    buyer: "Sales teams, agencies, brokerages, home-service operators",
    workflow: [
      { n: 1, name: "ICP Definition", desc: "Define the ideal customer in observable criteria, not adjectives.", result: "Machine-readable targeting criteria" },
      { n: 2, name: "Consent and Purpose Gate", desc: "Confirm the lawful basis for contacting each segment before collection.", result: "Documented outreach basis per segment" },
      { n: 3, name: "Source Mapping", desc: "Identify which sources actually carry the target segment at volume.", result: "Ranked source plan with expected yield" },
      { n: 4, name: "List Build", desc: "Assemble the candidate set across property, registry and directory sources.", result: "Deduplicated candidate list" },
      { n: 5, name: "Enrichment Pass", desc: "Append phone, email and mailing address with a confidence value each.", result: "Enriched contacts with source attribution" },
      { n: 6, name: "Verification Pass", desc: "Test deliverability and right-party match on every contact point.", result: "Verified contacts, dead lines removed" },
      { n: 7, name: "Scoring and Tiering", desc: "Score each prospect against intent and fit, then tier for sequencing.", result: "Scored, tiered prospect segments" },
      { n: 8, name: "QA Arbiter Review", desc: "Audit a sample for wrong-party and stale-record risk.", result: "QA accuracy score with defects listed" },
      { n: 9, name: "Compliance Guardian", desc: "Block any record lacking a permissible basis or sitting on a suppression list.", result: "Clean send-ready list, or blocked rows" },
      { n: 10, name: "Handoff and Feedback", desc: "Deliver to the CRM or campaign engine and return outcome feedback.", result: "Loaded list plus conversion feedback loop" },
    ],
    agents: [
      { name: "ICP Architect", role: "producer", specialty: "Turns positioning into observable targeting criteria" },
      { name: "Yield Scout", role: "monitor", specialty: "Tracks source yield and flags drying sources" },
      { name: "QA Arbiter", role: "qa", specialty: "Samples for wrong-party and stale-record risk" },
      { name: "Compliance Guardian", role: "guardian", specialty: "Enforces suppression lists and permissible purpose" },
      { name: "Independent Validator", role: "validator", specialty: "Independently re-verifies contact points before send" },
      { name: "Sequencer", role: "delivery", specialty: "Loads lists into the campaign engine with the right cadence" },
    ],
    pricing: { model: "Per verified contact plus campaign retainer", range: "$0.10 – $1.00 per verified lead; $1,500 – $10,000 per month managed", unit: "per verified contact", notes: "Skip-trace providers charge $0.02–$0.12 per match; subscription platforms charge $99–$599 per seat per month." },
    deliverables: ["Scored prospect list with contact points", "Source attribution per field", "Verification report", "Suppression and consent record", "Campaign load and sequence plan"],
    initiation: ["ICP and segment workshop", "Lawful basis documented per segment", "Pilot batch of 500 built and verified", "Pilot reviewed against acceptance rate", "Ongoing volume and cadence agreed"],
    monitoring: { cadence: "Per batch plus weekly cohort reporting", signals: ["Match rate", "Bounce and wrong-party rate", "Source yield", "Reply and conversion rate"], alerts: ["Match rate below the agreed floor", "Bounce rate above tolerance", "Suppression list conflict detected"] },
    benchmarks: [
      { company: "BatchData", how_they_run: "Skip trace API and bulk enrichment with enterprise SLA, delivery-method choice and pay-per-match pricing.", price_signal: "Pay-as-you-go per match, or subscription tiers", verification: "vendor_claim_unverified" },
      { company: "PropStream", how_they_run: "Property data plus skip tracing and marketing in one investor platform.", price_signal: "$99/month from, then $0.12 per contact", verification: "secondary_source" },
      { company: "DealMachine", how_they_run: "Property data, list building, mobile prospecting, contact enrichment and direct mail.", price_signal: "$99–$599 per seat per month with credit allowances", verification: "secondary_source" },
    ],
    sources: ["https://batchdata.io/skip-tracing", "https://wholster.app/skip-tracing/best-real-estate-skip-tracing-services/"],
  },
  {
    slug: "price-competitor-monitoring",
    name: "Price & Competitor Monitoring",
    tagline: "Know what competitors charge the moment they change it",
    icon: "BarChart3",
    group: "Intelligence",
    summary:
      "Continuous capture of competitor pricing, packaging, promotions and stock signals, normalised into a comparable matrix with change history and alerts.",
    buyer: "Pricing teams, ecommerce operators, category managers",
    workflow: [
      { n: 1, name: "Competitor Set Definition", desc: "Lock the competitors, markets, currencies and product matching rules.", result: "Comparison set with SKU matching rules" },
      { n: 2, name: "Authorization Review", desc: "Confirm the collection method is lawful for each competitor domain.", result: "Approved collection method per domain" },
      { n: 3, name: "Baseline Capture", desc: "Capture the full current price and package set on every target.", result: "Baseline pricing matrix with timestamps" },
      { n: 4, name: "Change Detection Build", desc: "Configure the diff engine for price, packaging, promo and stock fields.", result: "Working change detector per field" },
      { n: 5, name: "Scheduled Capture", desc: "Run on the agreed cadence with geo-appropriate sessions.", result: "Continuous capture with per-run logs" },
      { n: 6, name: "Normalisation", desc: "Align units, tiers, fees and bundles so prices are actually comparable.", result: "Apples-to-apples comparison table" },
      { n: 7, name: "Evidence Capture", desc: "Screenshot and hash every price observation at the moment it was read.", result: "Timestamped visual and hash evidence" },
      { n: 8, name: "QA Arbiter Review", desc: "Audit for stale, mis-matched or geo-confounded observations.", result: "QA score with doubtful rows flagged" },
      { n: 9, name: "Guardian Review", desc: "Block any collection method that crosses into misrepresentation or scraping bans.", result: "Method cleared or replaced" },
      { n: 10, name: "Alert and Report", desc: "Push material changes immediately and summarise the period.", result: "Real-time alerts plus periodic report" },
    ],
    agents: [
      { name: "Comparable Architect", role: "producer", specialty: "Builds SKU and packaging matching rules across competitors" },
      { name: "Change Sentinel", role: "monitor", specialty: "Watches every field and separates real changes from noise" },
      { name: "QA Arbiter", role: "qa", specialty: "Catches stale, mis-matched and geo-confounded observations" },
      { name: "Policy Guardian", role: "guardian", specialty: "Keeps collection on the lawful side of each domain's terms" },
      { name: "Independent Validator", role: "validator", specialty: "Re-reads flagged prices by hand before any alert ships" },
    ],
    pricing: { model: "Per monitored competitor plus monitoring retainer", range: "$25 – $150 per competitor per month; $500 – $5,000 per month managed", unit: "per competitor per month", notes: "Monitoring tools sit at $29–$499 per month; enterprise competitive-intelligence platforms price per user annually." },
    deliverables: ["Competitor pricing matrix", "Change history with timestamps", "Screenshot and hash evidence per change", "Alert feed", "Periodic pricing intelligence report"],
    initiation: ["Competitor and market list locked", "Product matching rules agreed", "Baseline matrix captured and reviewed", "Alert thresholds and channels set", "Cadence and report schedule agreed"],
    monitoring: { cadence: "Hourly to daily depending on category", signals: ["Capture success rate", "Fields changed", "Normalisation exceptions", "Alert precision"], alerts: ["Price change above threshold", "New package or promo detected", "Competitor page structure changed"] },
    benchmarks: [
      { company: "Visualping", how_they_run: "Page-change monitoring with visual diffs and alerting at consumer price points.", price_signal: "$10–$100+ per month by check frequency", verification: "vendor_claim_unverified" },
      { company: "Bright Data", how_they_run: "Unblocking plus geo-targeted collection sold into competitive price monitoring.", price_signal: "Per-record pricing with volume tiers", verification: "vendor_claim_unverified" },
      { company: "Oxylabs", how_they_run: "Scraping API and headless browsers used for continuous price collection.", price_signal: "$49–$2,000 per month tiered by result volume", verification: "secondary_source" },
    ],
    sources: ["https://www.browserless.io/blog/best-web-scraping-tools-for-data-extraction"],
  },
  {
    slug: "seo-serp-measurement",
    name: "SEO & SERP Measurement",
    tagline: "Rank, visibility and AI-answer presence, measured from real result pages",
    icon: "TrendingUp",
    group: "Acquisition",
    summary:
      "Search result and AI-answer visibility measured from live SERPs across geographies and devices, tied to the pages that actually earned the position.",
    buyer: "Marketing leads, agencies, multi-location operators",
    workflow: [
      { n: 1, name: "Keyword Universe Build", desc: "Assemble the keyword set that maps to revenue, not just traffic.", result: "Prioritised keyword universe" },
      { n: 2, name: "Geo and Device Plan", desc: "Define the markets, devices and languages each keyword is measured in.", result: "Measurement plan with cost estimate" },
      { n: 3, name: "Baseline Rank Capture", desc: "Capture live SERPs to establish the true starting position.", result: "Baseline ranking and visibility index" },
      { n: 4, name: "Competitor Set Lock", desc: "Fix the competitor domains tracked alongside you.", result: "Share-of-voice baseline" },
      { n: 5, name: "Scheduled SERP Capture", desc: "Run recurring captures from the correct geographies and devices.", result: "Continuous rank series with evidence" },
      { n: 6, name: "AI-Answer Measurement", desc: "Record whether and how AI answer surfaces cite your domain.", result: "AI citation presence log" },
      { n: 7, name: "Attribution Join", desc: "Join rank movement to landing pages, queries and on-site behaviour.", result: "Rank-to-page attribution table" },
      { n: 8, name: "QA Arbiter Review", desc: "Check for personalisation, cache and location artefacts in the data.", result: "Clean rank series with artefacts removed" },
      { n: 9, name: "Guardian Review", desc: "Confirm capture method and rate stay within search terms of use.", result: "Method cleared at the current cadence" },
      { n: 10, name: "Insight and Alerting", desc: "Surface losses immediately and report the trend periodically.", result: "Rank-loss alerts plus performance report" },
    ],
    agents: [
      { name: "Keyword Architect", role: "producer", specialty: "Builds keyword sets mapped to revenue, not vanity volume" },
      { name: "Position Sentinel", role: "monitor", specialty: "Tracks rank series and separates real movement from noise" },
      { name: "QA Arbiter", role: "qa", specialty: "Removes personalisation, cache and location artefacts" },
      { name: "Policy Guardian", role: "guardian", specialty: "Keeps capture cadence inside search engine terms of use" },
      { name: "Independent Validator", role: "validator", specialty: "Hand-checks flagged rank changes in a clean session" },
    ],
    pricing: { model: "Per tracked keyword plus retainer", range: "$0.05 – $0.50 per keyword per month; $1,000 – $10,000 per month managed", unit: "per keyword per month", notes: "Rank trackers run $99–$999 per month; managed SEO retainers typically start around $1,000 per month." },
    deliverables: ["Rank and visibility tracking", "Share-of-voice versus competitors", "AI citation presence report", "Rank-to-page attribution", "Monthly performance analysis"],
    initiation: ["Keyword and market workshop", "Measurement plan and budget approved", "Baseline captured within 72 hours", "Competitor set confirmed", "Reporting cadence set"],
    monitoring: { cadence: "Daily to weekly per keyword tier", signals: ["Position per keyword", "Visibility index", "AI citation rate", "Capture success rate"], alerts: ["Position loss beyond threshold", "Visibility drop week over week", "New competitor entering the set"] },
    benchmarks: [
      { company: "Semrush and Ahrefs class tools", how_they_run: "Large proprietary index plus rank tracking and competitor gap analysis sold by seat.", price_signal: "$99–$999+ per month", verification: "vendor_claim_unverified" },
      { company: "Google Search Console", how_they_run: "First-party impression, click and position data supplied free to verified property owners.", price_signal: "Free with verification", verification: "verified_primary_source" },
      { company: "Bright Data SERP APIs", how_they_run: "Live SERP and search-result collection with geo-targeting, sold per request.", price_signal: "Per-request pricing", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://developers.google.com/search/docs", "https://brightdata.com/ai/agent-browser"],
  },
  {
    slug: "property-owner-intelligence",
    name: "Property & Owner Intelligence",
    tagline: "Distressed-property owner search: who owns it, where they are, what it's worth",
    icon: "Home",
    group: "Intelligence",
    summary:
      "Owner identification and contactability for distressed and off-market property, built from county records, tax and lien data, then verified against right-party criteria.",
    buyer: "Investors, wholesalers, servicers, title and probate attorneys",
    workflow: [
      { n: 1, name: "Subject Definition", desc: "Capture the address set, distress signal and the outcome you need.", result: "Defined subject list with distress criteria" },
      { n: 2, name: "Authorization Review", desc: "Confirm permissible purpose for owner contact and any regulated data use.", result: "Purpose recorded before any record is pulled" },
      { n: 3, name: "Distress Signal Screen", desc: "Filter to properties showing the specific distress signals you target.", result: "Qualified distressed-property subset" },
      { n: 4, name: "Ownership Chain Build", desc: "Establish the owner of record and any recent transfer or lien activity.", result: "Verified ownership chain with document refs" },
      { n: 5, name: "Valuation Context", desc: "Attach assessed value, comparable sales and equity position.", result: "Value and equity estimate per property" },
      { n: 6, name: "Contact Discovery", desc: "Find phone, email and mailing address with a confidence value each.", result: "Contact points per owner with sources" },
      { n: 7, name: "Right-Party Verification", desc: "Confirm the contact actually reaches the owner of record.", result: "Verified right-party contacts" },
      { n: 8, name: "QA Arbiter Review", desc: "Audit a sample for wrong-owner, foreclosed and stale records.", result: "QA accuracy score, defects named" },
      { n: 9, name: "Compliance Guardian", desc: "Enforce DNC, suppression and permissible-purpose rules before release.", result: "Send-ready owner list, or blocked rows" },
      { n: 10, name: "Delivery and Campaign Handoff", desc: "Deliver the list and load it into outreach with the agreed cadence.", result: "Loaded campaign with outcome tracking" },
    ],
    agents: [
      { name: "Distress Analyst", role: "producer", specialty: "Screens for the specific distress signals the client targets" },
      { name: "Chain Auditor", role: "monitor", specialty: "Watches ownership transfers that invalidate a record" },
      { name: "QA Arbiter", role: "qa", specialty: "Samples for wrong-owner, foreclosed and stale records" },
      { name: "Compliance Guardian", role: "guardian", specialty: "Enforces DNC, suppression and permissible purpose" },
      { name: "Right-Party Validator", role: "validator", specialty: "Confirms the contact reaches the owner of record" },
      { name: "Campaign Steward", role: "delivery", specialty: "Loads verified owners into outreach with cadence controls" },
    ],
    pricing: { model: "Per verified record plus case fee", range: "$0.05 – $0.25 per verified record; $0.10 – $0.12 per contact on subscription platforms", unit: "per verified record", notes: "Bulk skip trace runs from $0.02–$0.03 per match at volume; platforms charge $99–$599 per seat per month with credit allowances." },
    deliverables: ["Distressed-property owner list", "Ownership chain with document references", "Valuation and equity context", "Verified right-party contacts", "DNC and suppression record"],
    initiation: ["Market and distress criteria confirmed", "Permissible purpose documented and signed", "Pilot batch of 250 properties returned", "Pilot quality reviewed against acceptance rate", "Ongoing volume and delivery channel agreed"],
    monitoring: { cadence: "Per batch, with transfer monitoring between batches", signals: ["Match rate", "Right-party rate", "Ownership change events", "List freshness"], alerts: ["Right-party rate below the agreed floor", "Ownership transfer on a delivered record", "New foreclosure or lien activity"] },
    benchmarks: [
      { company: "BatchData", how_they_run: "Skip trace API over property records, claiming a 76% right-party contact rate with enterprise SLA.", price_signal: "Pay-as-you-go per match, volume tiers", verification: "vendor_claim_unverified" },
      { company: "DataZapp", how_they_run: "Bulk skip trace with per-match billing and prepaid volume rates.", price_signal: "From $0.03 per matched phone, email or landline; $0.02 prepaid", verification: "vendor_claim_unverified" },
      { company: "PropStream", how_they_run: "Property research with skip tracing and marketing built into one platform.", price_signal: "$99/month from, then $0.12 per contact", verification: "secondary_source" },
    ],
    sources: ["https://batchdata.io/skip-tracing", "https://www.datazapp.com/skip-tracing-real-estate-marketing/"],
  },
  {
    slug: "authenticated-portal-automation",
    name: "Authenticated Portal Automation",
    tagline: "Work inside systems that only exist behind a login",
    icon: "KeyRound",
    group: "Operations",
    summary:
      "Repeatable automation inside customer, government and vendor portals where credentials and session state must be handled safely and every action remains attributable.",
    buyer: "Operations managers, back offices, servicers, permit and filing teams",
    workflow: [
      { n: 1, name: "Portal Inventory", desc: "Document every portal, its login method and the manual work inside it.", result: "Inventory with hours per task measured" },
      { n: 2, name: "Authorization and Access Agreement", desc: "Obtain written authority to act in the portal on the client's behalf.", result: "Signed authorization per portal" },
      { n: 3, name: "Credential Handling Design", desc: "Decide how secrets are stored, rotated and never written to a log.", result: "Credential handling design approved" },
      { n: 4, name: "Session Automation Build", desc: "Build login, navigation and data entry with MFA handling defined.", result: "Working automation per portal" },
      { n: 5, name: "Human-in-the-Loop Design", desc: "Define exactly which steps must stop for a human decision.", result: "Escalation map with owners named" },
      { n: 6, name: "Shadow Run", desc: "Run in parallel with the manual process before trusting it.", result: "Side-by-side parity on live work" },
      { n: 7, name: "Action Evidence Capture", desc: "Record every submission with confirmation number, screenshot and hash.", result: "Submission ledger with confirmations" },
      { n: 8, name: "QA Arbiter Review", desc: "Verify submissions actually landed, not just that the form submitted.", result: "Confirmation-verified action score" },
      { n: 9, name: "Access Guardian", desc: "Block any action outside the authorized scope or on the wrong account.", result: "Scope-compliant run, or blocked step" },
      { n: 10, name: "Monitoring and Breakage Response", desc: "Watch for portal changes and page someone the moment it breaks.", result: "Uptime record with breakage alerts" },
    ],
    agents: [
      { name: "Portal Cartographer", role: "producer", specialty: "Maps each portal's login, flows and hidden failure modes" },
      { name: "Session Warden", role: "monitor", specialty: "Detects session expiry, MFA challenge and silent breakage" },
      { name: "QA Arbiter", role: "qa", specialty: "Confirms submissions landed rather than merely submitted" },
      { name: "Access Guardian", role: "guardian", specialty: "Enforces authorized scope and correct account per action" },
      { name: "Independent Validator", role: "validator", specialty: "Re-checks confirmations against the portal of record" },
    ],
    pricing: { model: "Build fee plus per-portal retainer", range: "$5,000 – $50,000 per implementation; $2,000 – $15,000 per month per portal group", unit: "per implementation", notes: "Priced on portal complexity, MFA friction and accountability requirements, not on step count." },
    deliverables: ["Documented portal automation per system", "Credential handling design", "Human-in-the-loop escalation map", "Submission ledger with confirmations", "Breakage monitoring and response plan"],
    initiation: ["Portal inventory and hours study", "Written authorization for each portal secured", "Credential handling design signed off", "Shadow run against live work", "Autonomy level and escalation owners agreed"],
    monitoring: { cadence: "Every run, with breakage alerts in real time", signals: ["Session success rate", "Submission confirmations", "MFA challenge rate", "Page-structure change"], alerts: ["Login failure trend", "Confirmation missing after submission", "Portal layout change detected"] },
    benchmarks: [
      { company: "UiPath and Automation Anywhere class RPA", how_they_run: "Attended and unattended robots with credential vaults, orchestrators and human-in-the-loop task routing.", price_signal: "$5,000–$100,000+ per year plus implementation", verification: "vendor_claim_unverified" },
      { company: "Browserbase", how_they_run: "Persisted browser Contexts so an automation can resume an authenticated session instead of logging in again.", price_signal: "Usage-based per session", verification: "vendor_claim_unverified" },
      { company: "Cloudflare Browser Run", how_they_run: "Human-in-the-loop control that hands a live session to a person and returns it to automation.", price_signal: "Per-request with free allowance", verification: "secondary_source" },
    ],
    sources: ["https://mastra.ai/articles/best-ai-agent-browser-infrastructure-platforms"],
  },
  {
    slug: "screenshots-pdf-evidence",
    name: "Screenshots & PDF Evidence",
    tagline: "Court-defensible captures of what a page said, when it said it",
    icon: "Camera",
    group: "Assurance",
    summary:
      "Timestamped screenshots, PDFs and metadata captures that stand up to scrutiny, with hashing, chain-of-custody records and re-verification on demand.",
    buyer: "Legal teams, compliance officers, brand protection, claims handlers",
    workflow: [
      { n: 1, name: "Capture Specification", desc: "Define what must be captured, at what fidelity and with which metadata.", result: "Capture specification signed off" },
      { n: 2, name: "Authorization Review", desc: "Confirm the capture is lawful and proportionate to its purpose.", result: "Documented capture authority" },
      { n: 3, name: "Capture Environment Prep", desc: "Fix viewport, locale, timezone and user agent for reproducibility.", result: "Reproducible capture profile" },
      { n: 4, name: "Baseline Capture", desc: "Capture the current state so later changes are provable.", result: "Baseline capture set" },
      { n: 5, name: "Scheduled Capture", desc: "Run on the agreed cadence including full-page and element captures.", result: "Continuous capture series" },
      { n: 6, name: "Hash and Timestamp", desc: "Hash every artefact and record a trusted timestamp at capture time.", result: "Hash-bound capture record" },
      { n: 7, name: "Chain of Custody", desc: "Log who captured what, on which system, with which parameters.", result: "Custody record per artefact" },
      { n: 8, name: "QA Arbiter Review", desc: "Check legibility, completeness and truncation before anything is relied on.", result: "Captures cleared for use" },
      { n: 9, name: "Evidence Guardian", desc: "Block any artefact whose provenance or completeness cannot be shown.", result: "Only defensible captures released" },
      { n: 10, name: "Re-Verification Service", desc: "Re-fetch and hash-match on demand to prove a capture still holds.", result: "Re-verification certificate" },
    ],
    agents: [
      { name: "Capture Architect", role: "producer", specialty: "Fixes the profile so captures are reproducible months later" },
      { name: "Integrity Sentinel", role: "monitor", specialty: "Watches for truncated, blank or script-broken captures" },
      { name: "QA Arbiter", role: "qa", specialty: "Checks legibility and completeness before reliance" },
      { name: "Evidence Guardian", role: "guardian", specialty: "Refuses any artefact without provable provenance" },
      { name: "Re-Verification Validator", role: "validator", specialty: "Re-fetches and hash-matches captures to prove they still hold" },
    ],
    pricing: { model: "Per capture plus evidence retainer", range: "$0.01 – $0.10 per capture; $250 – $5,000 per month for evidence programmes", unit: "per capture", notes: "Screenshot and PDF APIs run $29–$999 per month; litigation-grade capture carries a premium for custody and re-verification." },
    deliverables: ["Capture set with timestamps", "Hash and custody records", "Re-verification certificates", "PDF evidence bundle", "Retention and chain-of-custody log"],
    initiation: ["What must be provable, and to whom, defined", "Capture authority confirmed", "Capture profile frozen", "Baseline set captured and reviewed", "Retention period and re-verification cadence agreed"],
    monitoring: { cadence: "Per capture, with integrity checks on every artefact", signals: ["Capture success rate", "Hash integrity", "Page load completeness", "Retention compliance"], alerts: ["Capture fails integrity check", "Page requires interaction not handled", "Retention expiry approaching"] },
    benchmarks: [
      { company: "Browserless", how_they_run: "REST endpoints for screenshot, PDF, content and download tasks, plus the full headless API behind them.", price_signal: "Free tier then usage-based", verification: "vendor_claim_unverified" },
      { company: "Cloudflare Browser Run", how_they_run: "Quick Actions REST endpoints for screenshots, PDFs, rendered HTML and markdown.", price_signal: "Per request past the free allowance", verification: "secondary_source" },
      { company: "PageVault class legal capture services", how_they_run: "Litigation-focused capture with affidavit support and expert testimony available.", price_signal: "Per-capture with program retainers", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://www.browserless.io/pdf-screenshot-screencast"],
  },
  {
    slug: "qa-visual-regression",
    name: "QA & Visual Regression Testing",
    tagline: "Catch what a deploy broke before a customer does",
    icon: "ShieldCheck",
    group: "Assurance",
    summary:
      "Automated functional and visual regression across browsers and viewports, with baseline management, noise suppression and a scored release gate.",
    buyer: "Product teams, agencies, ecommerce operators shipping frequently",
    workflow: [
      { n: 1, name: "Critical Path Mapping", desc: "Identify the flows where breaking means losing money.", result: "Prioritised critical-path list" },
      { n: 2, name: "Baseline Capture", desc: "Capture approved visual baselines across browsers and viewports.", result: "Approved baseline library" },
      { n: 3, name: "Test Suite Build", desc: "Write functional, accessibility and visual checks for each path.", result: "Versioned test suite" },
      { n: 4, name: "Noise Baseline", desc: "Measure normal render variance so real regressions are not buried.", result: "Per-element noise thresholds" },
      { n: 5, name: "Continuous Run", desc: "Run on every deploy against staging, then production smoke.", result: "Per-deploy results in minutes" },
      { n: 6, name: "Triage and Evidence", desc: "Attach screenshots, DOM diffs and console errors to every failure.", result: "Actionable failure packets" },
      { n: 7, name: "Scored Release Gate", desc: "Convert results into a pass score and block the release below it.", result: "Release gate verdict with score" },
      { n: 8, name: "QA Arbiter Review", desc: "Separate genuine regressions from baseline noise before escalating.", result: "Verified defect list, false positives removed" },
      { n: 9, name: "Guardian Review", desc: "Confirm the gate was not bypassed and coverage was not quietly reduced.", result: "Coverage integrity confirmed" },
      { n: 10, name: "Trend and Flake Report", desc: "Track flake rate and coverage drift over time.", result: "Reliability trend with flaky tests named" },
    ],
    agents: [
      { name: "Path Cartographer", role: "producer", specialty: "Maps the flows where a break costs money" },
      { name: "Flake Sentinel", role: "monitor", specialty: "Tracks flake rate and coverage drift over time" },
      { name: "QA Arbiter", role: "qa", specialty: "Separates true regressions from baseline noise" },
      { name: "Gate Guardian", role: "guardian", specialty: "Stops the release gate being bypassed or coverage reduced" },
      { name: "Independent Validator", role: "validator", specialty: "Reproduces each reported defect on a clean environment" },
    ],
    pricing: { model: "Per test run plus platform retainer", range: "$0.05 – $0.50 per visual check; $49 – $999 per month platform; $10,000+ per year enterprise", unit: "per visual check", notes: "Visual testing platforms sit at $49–$999 per month; enterprise contracts price per user with volume screenshots." },
    deliverables: ["Versioned test suite", "Baseline library with approval history", "Per-deploy regression reports", "Scored release gate", "Reliability and flake trend report"],
    initiation: ["Critical path workshop", "Baselines captured and approved", "Noise thresholds tuned on real deploys", "Gate score and blocking rules agreed", "CI integration wired"],
    monitoring: { cadence: "Every deploy, with nightly full-suite runs", signals: ["Pass rate", "Flake rate", "Coverage per critical path", "Time to triage"], alerts: ["Gate score below threshold", "Critical path coverage dropped", "Flake rate above tolerance"] },
    benchmarks: [
      { company: "Percy class visual testing", how_they_run: "Visual diffs per commit with baseline approval workflow integrated into CI.", price_signal: "$49–$999+ per month by screenshot volume", verification: "vendor_claim_unverified" },
      { company: "Applitools", how_they_run: "AI-assisted visual comparison that tolerates render noise to cut false positives.", price_signal: "Per-user and per-check annual contracts", verification: "vendor_claim_unverified" },
      { company: "Browserless", how_they_run: "Managed headless browsers for the functional tests, with Lighthouse audits available.", price_signal: "Free tier then usage-based", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://www.browserless.io/testing"],
  },
  {
    slug: "change-monitoring-alerts",
    name: "Change Monitoring & Alerts",
    tagline: "Get told the moment a page, price, policy or filing changes",
    icon: "BellRing",
    group: "Operations",
    summary:
      "Continuous watch on the pages, filings and records that matter, with change classification, evidence capture and alerts that route to the right person.",
    buyer: "Compliance teams, competitive intelligence, operations, legal",
    workflow: [
      { n: 1, name: "Watchlist Definition", desc: "Name the exact pages, filings or records to watch and why.", result: "Watchlist with reason per target" },
      { n: 2, name: "Authorization Review", desc: "Confirm watching method and frequency are permitted per target.", result: "Approved watch method per target" },
      { n: 3, name: "Change Model Build", desc: "Decide which regions of each page constitute a real change.", result: "Per-target change model" },
      { n: 4, name: "Cadence and Quiet Hours", desc: "Set check frequency and when alerts may fire.", result: "Monitoring schedule with quiet hours" },
      { n: 5, name: "Capture and Diff", desc: "Capture each check and diff it against the prior state.", result: "Change record with before and after" },
      { n: 6, name: "Classification", desc: "Classify each change as material, cosmetic or noise.", result: "Classified change feed" },
      { n: 7, name: "Evidence Capture", desc: "Attach timestamped screenshot and hash to every material change.", result: "Evidenced change record" },
      { n: 8, name: "QA Arbiter Review", desc: "Audit alert precision so the team does not learn to ignore alerts.", result: "Alert precision score" },
      { n: 9, name: "Escalation Guardian", desc: "Ensure high-severity changes actually reach a named human in time.", result: "Escalation confirmed received" },
      { n: 10, name: "Routing and Reporting", desc: "Route alerts by severity and report the period's change activity.", result: "Routing rules plus periodic report" },
    ],
    agents: [
      { name: "Watchlist Curator", role: "producer", specialty: "Keeps the watchlist tied to real business risk" },
      { name: "Quiet Sentinel", role: "monitor", specialty: "Runs the checks and suppresses cosmetic noise" },
      { name: "QA Arbiter", role: "qa", specialty: "Measures alert precision and kills false-positive patterns" },
      { name: "Escalation Guardian", role: "guardian", specialty: "Confirms severe changes reached a human, not just an inbox" },
      { name: "Independent Validator", role: "validator", specialty: "Re-confirms a material change by hand before escalation" },
    ],
    pricing: { model: "Per monitored target per month", range: "$5 – $50 per target per month; $29 – $499 per month for small portfolios", unit: "per target per month", notes: "Consumer monitoring sits at $10–$100 per month by frequency; enterprise watch programmes price per target with SLA." },
    deliverables: ["Watchlist with rationale", "Change feed with classification", "Timestamped evidence per material change", "Alert precision report", "Routing and escalation rules"],
    initiation: ["Watchlist workshop with risk owners", "Authorization confirmed per target", "Change models tuned on real pages", "Alert routing and quiet hours set", "Precision target agreed"],
    monitoring: { cadence: "Minutes to daily depending on target severity", signals: ["Check success rate", "Change volume", "Alert precision", "Escalation receipt"], alerts: ["Material change detected", "Check failing repeatedly", "Alert precision below target"] },
    benchmarks: [
      { company: "Visualping", how_they_run: "Visual page-change monitoring with frequency tiers and email alerting.", price_signal: "$10–$100+ per month", verification: "vendor_claim_unverified" },
      { company: "Hexowatch class monitors", how_they_run: "Watches visual, text, code and source changes with conditional triggers.", price_signal: "$19–$99+ per month", verification: "vendor_claim_unverified" },
      { company: "Browserless", how_they_run: "Managed browsers behind custom change-detection scripts at scale.", price_signal: "Free tier then usage-based", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://visualping.io/"],
  },
  {
    slug: "bulk-enrichment",
    name: "Bulk Enrichment",
    tagline: "Turn a raw list into a contactable, scored, compliance-cleared file",
    icon: "Layers",
    group: "Intelligence",
    summary:
      "Batch append of contact points, firmographics and property attributes onto an existing list, with per-field source attribution, verification and suppression control.",
    buyer: "Revenue operations, list owners, agencies taking over legacy data",
    workflow: [
      { n: 1, name: "File Intake and Audit", desc: "Profile the incoming file for duplicates, gaps and field quality.", result: "File audit with matchability estimate" },
      { n: 2, name: "Purpose and Consent Gate", desc: "Confirm the basis for holding and contacting these records.", result: "Documented purpose per record class" },
      { n: 3, name: "Match Plan", desc: "Decide the matching keys and fallback order for best hit rate.", result: "Matching strategy with expected hit rate" },
      { n: 4, name: "Pilot Enrichment", desc: "Enrich a representative slice and measure the real hit rate.", result: "Pilot results with cost per match" },
      { n: 5, name: "Full Batch Run", desc: "Process the whole file with per-record source attribution.", result: "Enriched batch with source per field" },
      { n: 6, name: "Verification Pass", desc: "Test phone and email deliverability and remove dead contact points.", result: "Deliverable contacts only" },
      { n: 7, name: "Scoring", desc: "Score each record for fit and recency so sequencing can be tiered.", result: "Scored records with tiers" },
      { n: 8, name: "QA Arbiter Review", desc: "Audit a sample for wrong-append and stale-data risk.", result: "QA accuracy score with defects named" },
      { n: 9, name: "Compliance Guardian", desc: "Apply suppression and DNC rules before the file leaves the building.", result: "Cleared file, or blocked rows isolated" },
      { n: 10, name: "Delivery and Delta", desc: "Deliver the file plus a delta report of what was added or removed.", result: "Delivered file with change report" },
    ],
    agents: [
      { name: "File Auditor", role: "producer", specialty: "Profiles incoming data before spending anything on it" },
      { name: "Hit-Rate Sentinel", role: "monitor", specialty: "Tracks match rate by key and by source over time" },
      { name: "QA Arbiter", role: "qa", specialty: "Samples for wrong-append and stale-record risk" },
      { name: "Compliance Guardian", role: "guardian", specialty: "Applies suppression and DNC before release" },
      { name: "Independent Validator", role: "validator", specialty: "Re-verifies a random sample by hand each batch" },
    ],
    pricing: { model: "Per record enriched, only on match", range: "$0.02 – $0.25 per enriched record", unit: "per enriched record", notes: "Bulk providers charge $0.02–$0.03 per match at prepaid volume; unmatched records are normally not charged." },
    deliverables: ["Enriched file with source per field", "Deliverability verification report", "Fit and recency scores", "Delta report", "Suppression record"],
    initiation: ["Send a representative sample file", "Purpose and consent confirmed", "Pilot run returned with real hit rate", "Pilot accepted, full batch scheduled", "Delivery format and delta reporting agreed"],
    monitoring: { cadence: "Per batch, with hit-rate trend reporting", signals: ["Match rate", "Deliverability rate", "Cost per match", "Suppression conflicts"], alerts: ["Hit rate below the agreed floor", "Deliverability drop", "High suppression overlap on a source"] },
    benchmarks: [
      { company: "DataZapp", how_they_run: "Bulk phone and email append billed per matched record with prepaid volume discounts.", price_signal: "$0.025–$0.055 per append; from $0.02 prepaid", verification: "vendor_claim_unverified" },
      { company: "BatchData", how_they_run: "Enrichment at scale with pay-per-match and subscription tiers plus API delivery.", price_signal: "Per match, volume-tiered", verification: "vendor_claim_unverified" },
      { company: "Zyte", how_they_run: "Managed extraction and enrichment pipelines for continuous data flow.", price_signal: "Managed services pricing", verification: "secondary_source" },
    ],
    sources: ["https://www.datazapp.com/skip-tracing-real-estate-marketing/"],
  },
  {
    slug: "compliance-evidence-capture",
    name: "Compliance Evidence Capture",
    tagline: "Proof that the rules were followed, captured as they were followed",
    icon: "Gavel",
    group: "Assurance",
    summary:
      "Continuous capture of the evidence a regulator, auditor or court will ask for, mapped to the control it satisfies and re-verifiable after the fact.",
    buyer: "Compliance officers, regulated operators, counsel, quality functions",
    workflow: [
      { n: 1, name: "Control Mapping", desc: "Map each obligation to the evidence that proves it was met.", result: "Control-to-evidence matrix" },
      { n: 2, name: "Evidence Standard Setting", desc: "Define what counts as sufficient evidence for each control.", result: "Agreed evidence standard" },
      { n: 3, name: "Capture Design", desc: "Design where, when and how each piece of evidence is captured.", result: "Capture design per control" },
      { n: 4, name: "Instrumentation", desc: "Wire capture into the systems that actually perform the work.", result: "Live capture on the real workflow" },
      { n: 5, name: "Continuous Capture", desc: "Capture as work happens rather than reconstructing it later.", result: "Evidence stream, not a retrospective file" },
      { n: 6, name: "Hash and Custody", desc: "Hash each artefact and record who captured it and how.", result: "Tamper-evident custody record" },
      { n: 7, name: "Control Testing", desc: "Test each control against its evidence and score the result.", result: "Control test score per obligation" },
      { n: 8, name: "QA Arbiter Review", desc: "Check evidence sufficiency, not just evidence presence.", result: "Sufficiency verdict per control" },
      { n: 9, name: "Evidence Guardian", desc: "Block any claim of compliance that the captured evidence cannot support.", result: "Only supportable claims released" },
      { n: 10, name: "Audit Pack Production", desc: "Assemble the audit or court pack on demand, with re-verification.", result: "Audit-ready pack with certificates" },
    ],
    agents: [
      { name: "Control Mapper", role: "producer", specialty: "Maps each obligation to the evidence that proves it" },
      { name: "Coverage Sentinel", role: "monitor", specialty: "Tracks which controls have gone quiet without evidence" },
      { name: "QA Arbiter", role: "qa", specialty: "Judges whether evidence is sufficient, not merely present" },
      { name: "Evidence Guardian", role: "guardian", specialty: "Refuses compliance claims the evidence cannot support" },
      { name: "Re-Verification Validator", role: "validator", specialty: "Re-fetches and hash-matches evidence on demand" },
    ],
    pricing: { model: "Programme fee plus per-control monitoring", range: "$2,000 – $25,000 per evidence programme; $500 – $5,000 per month ongoing", unit: "per programme", notes: "Priced on the number of controls and the regulatory exposure behind them, not on capture volume." },
    deliverables: ["Control-to-evidence matrix", "Continuous evidence stream", "Control test scores", "Tamper-evident custody records", "Audit-ready packs with re-verification certificates"],
    initiation: ["Obligation inventory with counsel or compliance", "Evidence standard agreed", "Instrumentation wired into the live workflow", "First control tests run and reviewed", "Reporting and audit-pack cadence agreed"],
    monitoring: { cadence: "Continuous capture with periodic control testing", signals: ["Evidence coverage per control", "Test pass rate", "Custody integrity", "Time to produce an audit pack"], alerts: ["Control producing no evidence", "Evidence failing integrity check", "New obligation not yet mapped"] },
    benchmarks: [
      { company: "Big Four evidence and controls programmes", how_they_run: "Control frameworks, walkthroughs, sampling and evidence requests serviced by engagement teams.", price_signal: "$50,000+ per engagement", verification: "vendor_claim_unverified" },
      { company: "PageVault class legal capture", how_they_run: "Litigation-grade capture with custody documentation and expert support.", price_signal: "Per capture plus programme fees", verification: "vendor_claim_unverified" },
      { company: "Vanta and Drata class platforms", how_they_run: "Continuous control monitoring with automated evidence collection against SOC 2 and ISO frameworks.", price_signal: "$7,000–$50,000+ per year", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://www.xbyte.io/top-web-scraping-service-providers-2026-usa/"],
  },
  {
    slug: "market-portfolio-research",
    name: "Market & Portfolio Research",
    tagline: "Decisions backed by collected evidence instead of borrowed opinion",
    icon: "PieChart",
    group: "Intelligence",
    summary:
      "Primary collection and analysis for market entry, portfolio review and diligence, with every claim traceable to the source it came from and the date it was read.",
    buyer: "Investors, funds, corporate strategy, diligence teams",
    workflow: [
      { n: 1, name: "Question Framing", desc: "Turn the decision into answerable questions with evidence standards.", result: "Research brief with decision criteria" },
      { n: 2, name: "Source Plan", desc: "Choose the sources that can actually answer each question.", result: "Source plan with confidence per source" },
      { n: 3, name: "Collection Build", desc: "Configure collection across filings, listings, registries and marketplaces.", result: "Working collection per source" },
      { n: 4, name: "Primary Collection", desc: "Collect market, competitor, pricing and occupancy evidence at volume.", result: "Primary evidence set" },
      { n: 5, name: "Normalisation", desc: "Align definitions, periods and units so sources can be compared.", result: "Comparable evidence table" },
      { n: 6, name: "Analysis and Modelling", desc: "Build the model or score that answers the framed questions.", result: "Model with stated assumptions" },
      { n: 7, name: "QA Arbiter Review", desc: "Test whether each claim is supported by the evidence cited for it.", result: "Claim-level support verdict" },
      { n: 8, name: "Research Guardian", desc: "Block unsupported claims and label every vendor assertion as unverified.", result: "Clean findings, unverified claims labelled" },
      { n: 9, name: "Independent Validation", desc: "Re-check key figures against their original sources on a separate model.", result: "Re-verified key figures" },
      { n: 10, name: "Deliverable and Monitoring", desc: "Deliver the report and keep watching the signals that would change it.", result: "Report plus change monitoring" },
    ],
    agents: [
      { name: "Research Architect", role: "producer", specialty: "Turns decisions into answerable questions with evidence standards" },
      { name: "Signal Sentinel", role: "monitor", specialty: "Watches for signals that would invalidate a delivered finding" },
      { name: "QA Arbiter", role: "qa", specialty: "Tests whether each claim is actually supported by its cited source" },
      { name: "Research Guardian", role: "guardian", specialty: "Blocks unsupported claims and labels vendor assertions unverified" },
      { name: "Independent Validator", role: "validator", specialty: "Re-checks key figures against original sources on another model" },
    ],
    pricing: { model: "Per engagement plus monitoring retainer", range: "$2,500 – $25,000 per engagement; $1,500 – $10,000 per month monitoring", unit: "per engagement", notes: "Primary-collection engagements price on breadth and depth of sources; retainers cover the monitoring that keeps findings current." },
    deliverables: ["Research brief and evidence standards", "Evidence set with source per claim", "Model with stated assumptions", "Findings report with support verdicts", "Monitoring on the signals that would change the findings"],
    initiation: ["Decision framing session", "Evidence standards agreed", "Source plan approved", "First collection sprint delivered", "Report and monitoring cadence set"],
    monitoring: { cadence: "Quarterly review with continuous signal watch", signals: ["Source availability", "Findings still supported", "New entrants", "Pricing movement"], alerts: ["Finding invalidated by new evidence", "Key source disappears", "Structural market change detected"] },
    benchmarks: [
      { company: "Big Three and boutique strategy firms", how_they_run: "Interview-led primary research with analyst teams and proprietary survey panels.", price_signal: "$100,000+ per engagement", verification: "vendor_claim_unverified" },
      { company: "Bright Data datasets", how_they_run: "Pre-collected market datasets licensed by subscription or per record.", price_signal: "Per-record or subscription licensing", verification: "vendor_claim_unverified" },
      { company: "Firecrawl and Crawl4AI", how_they_run: "AI-ready crawl output feeding analysis pipelines at low cost per page.", price_signal: "Usage-based per page", verification: "secondary_source" },
    ],
    sources: ["https://www.firecrawl.dev/blog/best-enterprise-scraping-services"],
  },
  {
    slug: "dataset-licensing",
    name: "Dataset Licensing",
    tagline: "Recurring revenue from data you already control",
    icon: "Database",
    group: "Acquisition",
    summary:
      "Packaging collected data into a licensable asset with documented lineage, refresh cadence, entitlement enforcement and usage terms that hold up commercially.",
    buyer: "Data owners, platform operators with proprietary collection",
    workflow: [
      { n: 1, name: "Asset Inventory", desc: "Inventory what data is actually collected, at what quality and cadence.", result: "Data asset inventory with quality ratings" },
      { n: 2, name: "Rights Clearance", desc: "Establish what may lawfully be licensed and what may not leave the building.", result: "Cleared scope, with exclusions recorded" },
      { n: 3, name: "Product Definition", desc: "Define the SKU: coverage, refresh cadence, delivery method and fields.", result: "Dataset product definition" },
      { n: 4, name: "Lineage Documentation", desc: "Document source, method, date and confidence for every field.", result: "Field-level lineage document" },
      { n: 5, name: "Quality Benchmarking", desc: "Measure completeness, accuracy and freshness against a stated standard.", result: "Published quality benchmark" },
      { n: 6, name: "Packaging and Pricing", desc: "Set tiers, volume terms and the licensing model.", result: "Pricing and packaging sheet" },
      { n: 7, name: "Delivery and Entitlement", desc: "Build delivery plus entitlement checks that enforce the licence.", result: "Enforced delivery and entitlement path" },
      { n: 8, name: "QA Arbiter Review", desc: "Verify the shipped sample matches the advertised quality claim.", result: "Sample-versus-claim verdict" },
      { n: 9, name: "Rights Guardian", desc: "Block any delivery that would exceed the cleared rights scope.", result: "In-scope delivery confirmed, or stopped" },
      { n: 10, name: "Refresh and Reporting", desc: "Run the refresh cadence and report licence usage to both sides.", result: "Refresh log plus usage reporting" },
    ],
    agents: [
      { name: "Asset Curator", role: "producer", specialty: "Turns raw collection into a defined, documented product" },
      { name: "Freshness Sentinel", role: "monitor", specialty: "Watches refresh cadence and fields going stale" },
      { name: "QA Arbiter", role: "qa", specialty: "Checks the sample matches the advertised quality claim" },
      { name: "Rights Guardian", role: "guardian", specialty: "Stops deliveries that exceed the cleared rights scope" },
      { name: "Entitlement Validator", role: "validator", specialty: "Confirms each licensee is entitled to what was delivered" },
    ],
    pricing: { model: "Subscription, per record, or annual licence", range: "$0.001 – $0.05 per record; $5,000 – $250,000 per year per licence", unit: "per record or per year", notes: "Enterprise data licences are priced on coverage, exclusivity and refresh cadence rather than on record count alone." },
    deliverables: ["Dataset product definition", "Field-level lineage document", "Published quality benchmark", "Enforced delivery and entitlement path", "Refresh log and usage reporting"],
    initiation: ["Asset inventory and rights review", "Product definition agreed", "Quality benchmark published", "Delivery and entitlement built", "First licence terms signed"],
    monitoring: { cadence: "Per refresh cycle, with entitlement checks on every delivery", signals: ["Refresh success", "Quality versus claim", "Licence usage against caps", "Rights scope adherence"], alerts: ["Refresh missed", "Quality below the published benchmark", "Usage exceeding entitlement"] },
    benchmarks: [
      { company: "Bright Data datasets", how_they_run: "Pre-collected datasets licensed by subscription with delivery via API or file.", price_signal: "Subscription or per-record", verification: "vendor_claim_unverified" },
      { company: "Oxylabs datasets", how_they_run: "Web data and e-commerce datasets sold alongside proxies and scraping APIs.", price_signal: "Per-record or contract", verification: "vendor_claim_unverified" },
      { company: "Zyte managed data", how_they_run: "Continuous extraction pipelines delivered as a managed data service.", price_signal: "Managed service contracts", verification: "secondary_source" },
    ],
    sources: ["https://www.firecrawl.dev/blog/best-enterprise-scraping-services"],
  },
  {
    slug: "skip-trace-heir-research",
    name: "Skip Trace & Heir Research",
    tagline: "Locate people and prove kinship to a court-ready standard",
    icon: "Users",
    group: "Intelligence",
    summary:
      "Locating individuals and establishing kinship for estate, trust, probate and due-diligence matters, with claim-level evidence and independent certification before delivery.",
    buyer: "Probate attorneys, fiduciaries, title companies, class action counsel",
    workflow: [
      { n: 1, name: "Matter Intake", desc: "Record the matter, permissible purpose, legal matter and case reference.", result: "Intake record with authority asserted up front" },
      { n: 2, name: "Authority Gate", desc: "Validate the permissible purpose before any source is contacted.", result: "Blocking verdict, or written clearance" },
      { n: 3, name: "Identity Confirmation", desc: "Confirm the subject's identity from vital and death records.", result: "Confirmed identity record" },
      { n: 4, name: "Family Graph Construction", desc: "Build the kinship graph from records, obituaries and filings.", result: "Kinship graph with a source per relationship" },
      { n: 5, name: "Relationship Proof", desc: "Attach documentary evidence to every claimed relationship.", result: "Claim-level proof, gaps left visible" },
      { n: 6, name: "Contact Discovery", desc: "Locate living heirs with contact points and confidence each.", result: "Contactable heir list" },
      { n: 7, name: "Evidence Re-Verification", desc: "Re-fetch and hash-match every cited source before it is relied on.", result: "Re-verified evidence ledger" },
      { n: 8, name: "QA Arbiter Review", desc: "Score the file against the evidentiary standard, not against impression.", result: "QA score with failed rules named" },
      { n: 9, name: "Certification Guardian", desc: "Withhold the court-ready pack until certification is genuine and current.", result: "Certified pack, or a stated refusal" },
      { n: 10, name: "Independent Validation and Delivery", desc: "Have a separate model confirm the findings, then deliver.", result: "Independently validated delivery pack" },
    ],
    agents: [
      { name: "Matter Intaker", role: "producer", specialty: "Records authority and matter scope before any source is touched" },
      { name: "Evidence Sentinel", role: "monitor", specialty: "Tracks evidence going stale or sources disappearing" },
      { name: "QA Arbiter", role: "qa", specialty: "Scores the file against the evidentiary standard, not impression" },
      { name: "Certification Guardian", role: "guardian", specialty: "Withholds the court-ready pack until certification is genuine" },
      { name: "Independent Validator", role: "validator", specialty: "Confirms findings on a separate model family before delivery" },
      { name: "Delivery Steward", role: "delivery", specialty: "Assembles and ships the certified pack with its disclosures" },
    ],
    pricing: { model: "Flat fee per matter, never a percentage of the estate", range: "$1,500 – $7,500 per matter for standard research; $10,000+ for complex or international matters", unit: "per matter", notes: "Flat fees are quoted in advance and are deliberately not percentage-based, so the fee never depends on the outcome." },
    deliverables: ["Identity confirmation record", "Kinship graph with a source per relationship", "Evidence ledger with re-verification status", "Contactable heir list", "Certified delivery pack, or a stated refusal"],
    initiation: ["Matter intake with authority asserted", "Authority gate cleared in writing", "Scope and flat fee quoted in advance", "Research plan and source list agreed", "Delivery date and pack format confirmed"],
    monitoring: { cadence: "Per matter, with evidence re-verification before delivery", signals: ["Evidence freshness", "Unresolved relationship gaps", "Certification status", "Blocked sources disclosed"], alerts: ["Evidence fails re-verification", "Certification lapsed after content changed", "Blocked source affecting the finding"] },
    benchmarks: [
      { company: "HeirSearch", how_they_run: "Non-percentage flat fees, forensic genealogy across in-house, commercial and archival sources, insured and court-ready reporting.", price_signal: "Flat fee quoted per matter", verification: "vendor_claim_unverified" },
      { company: "Heir Pros", how_they_run: "Investigators plus certified genealogists and DNA specialists, claiming a 98% success rate with transparent pricing.", price_signal: "Flat fee per matter", verification: "vendor_claim_unverified" },
      { company: "Ancestry ProGenealogists", how_they_run: "Hourly research by hundreds of researchers as a disinterested third party, delivered as sworn affidavit plus charts.", price_signal: "Hourly billing", verification: "vendor_claim_unverified" },
    ],
    sources: ["https://heirsearch.com/"],
  },
];

export const SERVICE_BY_SLUG: Record<string, Service> = Object.fromEntries(
  SERVICE_CATALOG.map((s) => [s.slug, s]),
);

export function getService(slug: string | undefined | null): Service | null {
  if (!slug) return null;
  return SERVICE_BY_SLUG[slug] || null;
}

/** Every service must carry the same three assurance roles. Used by the runner and by the audit. */
export const REQUIRED_ASSURANCE_ROLES = ["qa", "guardian", "validator"] as const;

export function missingAssuranceRoles(service: Service): string[] {
  return REQUIRED_ASSURANCE_ROLES.filter(
    (role) => !service.agents.some((a) => a.role === role),
  );
}