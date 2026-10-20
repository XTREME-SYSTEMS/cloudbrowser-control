/**
 * FORENSIC AUDIT — xtreme-comms1.zip
 * ==========================================================================
 * Findings from a read of the extracted package (456 files, 2.9 MB, 85
 * entities, ~100 backend functions, 76 pages, 2 agents). Every finding below
 * is traceable to something in that tree; nothing here is inferred from the
 * package's own marketing.
 *
 * The package's own capability document is the source of the most important
 * finding, which is why it is quoted rather than paraphrased.
 */

export const COMMS_AUDIT = {
  package: {
    name: "xtreme-communications-os",
    version: "1.0.0",
    files: 456,
    size: "2.9 MB",
    entities: 85,
    backend_functions: "~100",
    pages: 76,
    shared_modules: 11,
    agents: ["eden_skye", "app_builder"],
    workflows: ["DailyFollowUpSequence", "FleetHeartbeat"],
    connectors: 8,
    mcp: true,
    prompt_packages: ["FULL_CAPABILITY_INSTALL.md", "MASTER_100_PERCENT.md", "ULTRA_HUMANISTIC_SYSTEM.md"],
    what_it_is:
      "A multi-tenant Communications-as-a-Service platform (a Twilio/Telnyx-class subsystem): voice, SMS, MMS and WhatsApp; number management and resale; contact-centre routing; carrier route quality; AI voice sessions with cognitive telemetry; campaigns and outreach; CRM; digital-team provisioning; an agent factory; a prompt library; benchmark, margin and entitlement engines.",
  },

  layers: [
    { name: "Channels", what_it_is: "Voice, SMS, MMS, WhatsApp, email, video — each with its own gateway function and webhook handler.", status: "Built, provider-credential dependent" },
    { name: "Numbers & routing", what_it_is: "Number inventory, provisioning, porting, resale, SIP trunks, routing queues and carrier route metrics.", status: "Built" },
    { name: "AI voice & cognition", what_it_is: "AiVoiceSession telemetry, speech transcripts, sentiment, barge-in counts, latent latency metrics.", status: "Built, measurement-heavy" },
    { name: "Agents", what_it_is: "Agent factory, agent templates, personas, skill profiles, reward ledger, digital-team provisioning, council deliberation.", status: "Built" },
    { name: "Workflow engine", what_it_is: "Workflow / WorkflowStep / WorkflowExecutionLog with trigger, condition, delay, API-call and escalation step types.", status: "Built" },
    { name: "Assurance", what_it_is: "TestSession / TestRun / TestResult, benchmarkEngine with p0/p1/p2 severities, independentValidator, shadowVisionCortex.", status: "Built, self-certified — see AUD-01" },
    { name: "Commercial", what_it_is: "Plans, entitlements, usage metering, margin ledger, billing accounts, invoices, coupons, reconciliation exceptions.", status: "Built" },
    { name: "Resilience", what_it_is: "FailurePattern, RepairPacket, IncidentRecord, FleetHeartbeat, repairFactory, preflightHeal, runAutonomousAudit.", status: "Built" },
  ],

  findings: [
    {
      id: "AUD-01",
      severity: "P0",
      area: "Capability claims",
      finding:
        "The package certifies itself at 100% with no evidence gate. Its own install document states: \"the matrix is self-certified at 100% with no evidence gate. The numbers below 100 do not appear because the system never re-baselanced from real test evidence. The true gaps are unimplemented systems hiding behind LIVE stamps.\"",
      evidence: "base44/prompts/FULL_CAPABILITY_INSTALL.md — audit snapshot, 72 of 72 capabilities LIVE, 300 pass / 0 fail.",
      impact:
        "Every downstream claim — parity with Twilio, 'fully autonomous', '100% results' — inherits an unverified status. A buyer reading the capability matrix is reading an intention, not a measurement.",
      action:
        "Adopted here: a service is never described as working because it is stamped working. It is described as working only when a ServiceRun exists with per-step results and three independent reviews attached (see the Services pages).",
    },
    {
      id: "AUD-02",
      severity: "P0",
      area: "Communications delivery",
      finding:
        "Carrier-dependent paths run without carrier credentials. The operations agent's own instructions say 'Never pause for credentials — record missing carrier creds as credentials_required and continue.'",
      evidence: "base44/agents/eden_skye.jsonc — instructions, and its tool list spanning telnyxWebhook, gatewayBilling, orchestrateVoiceLoop.",
      impact:
        "A run can complete and report success while no call, message or payment actually left the building. That is the single most expensive failure mode in a communications platform.",
      action:
        "Adopted here in inverted form: the guardian refuses delivery on any comms outcome that has no provider confirmation, and a missing credential is a refusal ground rather than a note.",
    },
    {
      id: "AUD-03",
      severity: "P1",
      area: "Inbound event handling",
      finding:
        "Overlapping inbound handlers exist for the same providers — gatewayTwilio, twilioWebhook and twilioVoiceWebhook, plus gptBridge and gptBridgeTest, alongside telnyxWebhook.",
      evidence: "base44/functions/ directory listing.",
      impact:
        "Two handlers for one inbound event risk double-processing: a duplicate message, a duplicate task assignment, or a duplicate charge.",
      action:
        "One inbound handler per provider with an idempotency key recorded before side effects. Do not port the duplicate handlers into this app.",
    },
    {
      id: "AUD-04",
      severity: "P1",
      area: "Portability",
      finding:
        "The package pins react-router-dom ^7 and @supabase/supabase-js, and ships its own vite config and component library, while this app runs react-router-dom 6.",
      evidence: "package.json — \"react-router-dom\": \"^7.18.3\", \"@supabase/supabase-js\": \"^2.45.0\".",
      impact:
        "Porting pages wholesale would break routing and pull a second data layer into the app.",
      action:
        "Port logic, catalogues and doctrine only. No dependency, router or data-layer transplant.",
    },
    {
      id: "AUD-05",
      severity: "P1",
      area: "Personal data",
      finding:
        "The comms entities carry personal data at volume — Conversation, Participant, SpeechTranscript, MediaAttachment, GoogleContact, XtremeCrmContact — with no visible retention or classification rule on them.",
      evidence: "base44/entities/ listing and the entity schemas for Conversation and SpeechTranscript.",
      impact:
        "Voice transcripts and contact records accumulate indefinitely and are the most sensitive material in the platform.",
      action:
        "Adopted here: nothing from that layer is ingested into open entities. The assistant records task-level outcomes, not transcripts or personal records.",
    },
    {
      id: "AUD-06",
      severity: "P2",
      area: "Test integrity",
      finding:
        "The recorded test suite shows 300 pass, 0 fail, with 0 open findings across 72 capabilities.",
      evidence: "base44/prompts/FULL_CAPABILITY_INSTALL.md — test snapshot.",
      impact:
        "A suite with no failing cases is not testing; it is confirming. It cannot detect the failure modes the platform most needs to detect.",
      action:
        "Adopted here: the assurance agents are prompted to refuse, name failed rules and leave unknowns visible. A run with no failures reported is treated as a weak signal, not a strong one.",
    },
    {
      id: "AUD-07",
      severity: "P2",
      area: "Documentation as proof",
      finding:
        "The three largest documents are prompt packages — mandates to an AI build agent — rather than architecture or test records.",
      evidence: "base44/prompts/MASTER_100_PERCENT.md (173 lines), ULTRA_HUMANISTIC_SYSTEM.md (199 lines), FULL_CAPABILITY_INSTALL.md (82 lines).",
      impact:
        "Doctrine that reads as verification can be mistaken for verification. The mandates themselves are valuable; their evidentiary weight is zero.",
      action:
        "Absorbed as standing orders for the assistant's voice and standards — never cited as evidence that anything works.",
    },
  ],

  assets_absorbed: [
    { asset: "Eden Skye (operations conductor agent)", what_it_does: "Watches a line, thread state, SLA breaches, voice telemetry, carrier anomalies and balance thresholds, and escalates with severity classification.", where_it_maps: "The operating persona of the AI executive assistant on the Executive Assistant page." },
    { asset: "PromptLibrary entity (15 domains × 6 channels)", what_it_does: "Versioned, scored prompt bodies per domain — conversation flow, objection handling, follow-up, compliance, closing.", where_it_maps: "The prompt enhancement engine's standard set (STD-01…STD-10) and its domain-aware scaffolding." },
    { asset: "benchmarkEngine (universal + system-type benchmarks, p0/p1/p2)", what_it_does: "Runs a named benchmark suite against a system and records pass/fail with severity.", where_it_maps: "The IndustryBenchmark records seeded from the service catalogue, and the assurance gate score on every run." },
    { asset: "playbooks.ts (industry playbooks)", what_it_does: "Per-industry agent kits: target criteria, a system prompt and a 15-day pre-written message sequence.", where_it_maps: "The executive assistant's outreach and follow-up task generation." },
    { asset: "Workflow / WorkflowStep / WorkflowExecutionLog", what_it_does: "Typed step model — trigger, condition, delay, API call, escalation — with execution logging.", where_it_maps: "The numbered-step model rendered on every service page and recorded on every ServiceRun." },
    { asset: "TestSession / TestRun / TestResult / independentValidator", what_it_does: "Test sessions, results with points, and a nominally independent validator.", where_it_maps: "The QA, guardian and validator roles, now on three distinct model families with separation recorded." },
    { asset: "AuditFinding / ProofReceipt / Verification / DeliveryReceipt", what_it_does: "Governance chain from finding to receipt.", where_it_maps: "The delivery gate: delivery_allowed plus the guardian's blocking grounds on each run." },
    { asset: "FailurePattern / RepairPacket / IncidentRecord / FleetHeartbeat", what_it_does: "Pattern capture, repair packets, incident records and a fleet heartbeat.", where_it_maps: "Run-level monitoring signals and alerts; the alert list is the first step of the same loop." },
    { asset: "MarginLedger / UsageMeter / EntitlementCheck / BillingAccount", what_it_does: "Margin tracking, usage metering and entitlement enforcement.", where_it_maps: "Pricing of record per service, and the cost signals in monitoring." },
    { asset: "CouncilSession / councilDeliberation / shadowVisionCortex", what_it_does: "Multi-agent deliberation and a shadow critic reviewing the primary system.", where_it_maps: "The three-agent assurance triad on every service run." },
    { asset: "DigitalTeam / SkillProfile / AgentTemplate / provisionDigitalTeam", what_it_does: "Provisioning of named specialised agents with skills.", where_it_maps: "The named, specialised agent squad listed on every service page." },
  ],

  verdict:
    "The package is a genuine, large communications platform with real engineering in its channels, routing, telemetry, metering and resilience layers. Its weakness is evidentiary, not architectural: it certifies itself, it proceeds without carrier credentials, and its test suite has never recorded a failure. What is worth absorbing is the doctrine, the catalogues and the agent structure — not its dependencies, its duplicate webhook handlers or its 100% claim.",
};

/** What the executive assistant can operate, carried over from the comms platform. */
export const COMMS_CAPABILITIES = [
  { name: "Outreach campaigns", capability: "Multi-channel campaign sequencing across voice, SMS, MMS, WhatsApp and email.", status: "Queueable now" },
  { name: "Follow-up sequences", capability: "Pre-written multi-day follow-up cadences per industry vertical.", status: "Queueable now" },
  { name: "Messaging", capability: "Outbound message drafting and scheduling with channel selection.", status: "Queueable now" },
  { name: "Scheduling", capability: "Appointment windows, calendar holds and reminder sequences.", status: "Queueable now" },
  { name: "Monitoring & escalation", capability: "Continuous watch on runs, tasks and delivery gates, with severity-classified escalation.", status: "Live" },
  { name: "Reporting", capability: "Operating briefs from the workspace's real state, never from intention.", status: "Live" },
  { name: "Voice calls", capability: "Automated and assisted calling with session telemetry.", status: "Needs carrier credentials" },
  { name: "SMS / MMS delivery", capability: "Carrier messaging with media support and opt-in enforcement.", status: "Needs carrier credentials" },
  { name: "WhatsApp business", capability: "Template messaging and inbound thread handling.", status: "Needs provider credentials" },
  { name: "Number management", capability: "Provisioning, porting and number inventory.", status: "Needs carrier credentials" },
  { name: "Contact-centre routing", capability: "Queue assignment, SLA tracking and supervisor escalation.", status: "Needs agent seats" },
  { name: "CRM sync", capability: "Bi-directional contact and opportunity sync.", status: "Needs connector" },
];