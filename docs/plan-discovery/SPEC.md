# X1 Plan Discovery Engine | Staging specification

**Status:** Branch-only implementation, NOT deployed to production.  
**Owner:** National Concrete Polishing / XPS Auto Leads, organization `6a84cb2d3ee688589646be87`.  
**Source of truth:** XPS Auto Leads BidInvitation + existing X1 Bid Commander worker / monitored inbox intake.  
**Existing monitor:** `Automation_7ecf559ccc408191b96dc707154c24eb`. No new scheduler, worker, queue or charge.

## User outcome

For each in-scope Florida contractor bid invitation, extract the project owner/GC, due-date timezone, source revision, public/authorized drawings and specifications, floor finish schedule, addenda, and contract route. Preserve evidence, classify access restrictions and route to the **existing** X1 bid desk. Do not confuse building square footage with measured flooring quantities or infer an eligible trade from a facility type.

## Existing integration

- Cloud Browser runtime: `browser-engine/server.js`, Playwright 3.1.0. Authenticated sessions only.
- New browser-engine action: `plan_manifest` (read-only, current page, no network navigation or download).
- Existing MCP gateway: `base44/functions/mcpGateway/entry.ts`. New `extract_plan_manifest` action with `sessions:read` scope; validates session ownership via existing `getSession` before engine dispatch.
- Existing GPT tool manifest: `base44/mcp/config.json`, advertises `extract_plan_manifest`.
- Logic: `browser-engine/plan-discovery.js`; no external packages, secrets, or new infrastructure.
- Existing user account Cloud Browser Template: `6af5d75ab3b894fde9a26b54`.
- Existing Cloud Browser draft UserAgent: `6af5d75ff21739a9bb8b4f78`.
- Skybridge: reusable MCP interface can call the **existing** gateway after real authorization/scope verification and deployment. A user-selected GPT setting is not itself a transferable Skybridge tool, service identity, CAPTCHA entitlement or planroom login. A separate Skybridge deployment is **not** created by this branch.

## Proposed tool call

```json
{
  "tool": "extract_plan_manifest",
  "params": {
    "session_id": "<existing authorized browser session>",
    "project_id": "<existing XPS Auto Leads project>",
    "source_message_id": "<original Gmail source ID>",
    "gc": "Sierra Contracting"
  }
}
```

The wrapper returns `{manifest, source_url, read_only:true, downloaded_documents:0}`. The manifest includes source URL, detected file/link metadata, access state, source excerpt, trade/deadline evidence, and an explicit null for measured flooring area. Query strings are removed from *displayed* URLs to avoid leaking signed token parameters; a sanitized URL is not a download credential.

## Workflow contract

1. Match source Gmail message ID, tenant, GC and project to one existing invitation; maintain separate GC solicitations for the same property.
2. Prefer original GC instructions and authorized free documents from public procurement pages, official portals, existing connected Drive, and existing logged-in permitted browser sessions.
3. Navigate approved source pages with bounded page count and rate limits. Observe planroom links and index metadata, not hidden checkout endpoints.
4. Extract `index`, `plan`, `spec`, `finish_schedule`, `addendum`, `bid_form` candidates with page-specific source and status (`listing_link_only`, `filename_only`, `listed_no_direct_url`, `unverified_download`).
5. If login/paywall/403/CAPTCHA appears, return `HOLD_SOURCE` or `HOLD_CHALLENGE`, recording what authorized access is missing. Permit owner login or challenge resolution only through the provider's supported legitimate flow; never bypass it.
6. Only after independently verified authorized downloaded bytes may a separate document processor compute revision/hash, extract trade sheets, and perform scale-backed takeoff.
7. Independent QA/Guardian must validate tenant and file ownership, bid-source dates, complete estimates, pricing, recipient and delivery route. External proposal submission stays gated on the exact owner's package approval.

## Critical policy

- No CAPTCHA bypass, stealth evasion, automated solving of protected anti-bot gates, paid registration, account creation, credential exports, payment or external sending.
- Preserve robots, ToS and document licensing, domain allowance and SSRF protection.
- Never treat a public link, page listing, registered-user entitlement, plugin capability flag or screenshot as proof the actual drawing ZIP/PDF was downloaded.
- Reuse one canonical X1 queue, do not create a second scheduler or sender.
- Stop after two bounded retries for the same failure fingerprint. Do not spin jobs indefinitely.
- The reusable extractor has no side effects beyond reading the existing Playwright page.

## Observed live pilot (2026-11-12, America/New_York)

- `https://www.ldiline.com/projects/15527/plans/bobs-discount-furniture-melbourne-fl`: public listing shows **Drawing Index - FREE DOWNLOAD**, **Full Set** and tabs to Plans/Specs; no direct file bytes obtained. Live extractor stage `PUBLIC_INDEX_OR_METADATA`.
- `https://www.ldiline.com/projects/15527/specs/bobs-discount-furniture-melbourne-fl`: **Bob's Discount Furniture Melbourne, FL Specs.zip**, **161.3 KB**, displayed registration requirement, paid option. Live extractor stage `HOLD_SOURCE` and `login_required`, `paid_order_offered=true`.
- Source invitation Sierra Contracting, Gmail `1a1cb292692cec76`, references concrete finishes. GC due time Nov 17 at 11:59 PM ET; public LDI planroom has shown an earlier noon time. Resolve with GC before submission.
- Browser test receipt `rcpt_1794499132956_aspvoa`: **12/12** pure JavaScript checks passed in the live Chromium context. This does **not** validate a built/deployed MCP route or authenticated end-to-end ZIP download.
- The first queued pilot job `6af5d7ba1b755b9e09b16685` stalled without a result, then was cancelled with receipt `rcpt_1794498959163_qi4foj`. No persistent job was left intentionally running.

## Release acceptance checks

| Gate | Evidence required | Current status |
|---|---|---|
| Extractor URL/candidate/cost/access tests | Node test suite + browser live fixture | Chromium smoke PASS (12/12); Node runner not yet proven |
| Live authorized browser navigation | Source/response receipt | PASS on public LDI Plans/Specs |
| Authenticated original-plan download | File bytes, hash, revision and scope | BLOCKED, planroom login/payment |
| MCP action end-to-end after deploy | Fresh authorized `extract_plan_manifest` receipt | NOT TESTED |
| X1/XPS writeback and dedupe | Tenant-specific readback | NOT IMPLEMENTED in this read-only module |
| Guardian independent release gate | Exact SHA, reproducible checks, hard-gate verdict | PENDING |
| Production deploy | Explicit owner-approved target and rollback | NOT AUTHORIZED |

## Rollback

Do not merge the feature branch. Revert the addition of `plan-discovery.js`, its tests, the `plan_manifest` action in `server.js`, and `extract_plan_manifest` in MCP gateway and manifest. No database migrations and no production credentials are required.
