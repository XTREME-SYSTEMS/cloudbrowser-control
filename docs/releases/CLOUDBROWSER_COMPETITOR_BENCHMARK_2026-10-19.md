# CloudBrowser Competitor Benchmark — Preliminary Evidence Review
**Reviewed:** 2026-10-19  
**Status:** DOCUMENTATION-BASED, NOT A PERFORMANCE CERTIFICATION

## Method
This is a preliminary capability-evidence matrix based on publicly available vendor documentation and a current third-party comparison. Each category receives 0–2 points:
- **2:** explicit documentation found for the capability.
- **1:** partial, beta, indirect, or unclear evidence.
- **0:** no supporting evidence found in the sources reviewed.

This measures *documented capability coverage only*, not quality, reliability, security efficacy, or speed. It is not a substitute for controlled same-workload tests. Vendor claims and vendor-run benchmarks are labeled as such.

## Matrix (documentation evidence score, 0–2)

| Dimension | Browserbase | Browserless | Browser Use | CloudBrowser |
|---|---:|---:|---:|---:|
| Managed browser sessions / lifecycle | 2 | 2 | 2 | 2 |
| Automation APIs / SDK integration | 2 | 2 | 2 | 2 |
| Reusable multi-step workflows / durable execution | 2 | 1 | 2* | 2** |
| Live view / debugging / logs | 2 | 2 | 2 | 1 |
| Deployment flexibility (hosted/self-hosted) | 0*** | 2 | 1 | 2 |
| Auth / tenant / access-control documentation | 2 | 2 | 2 | 1**** |
| Publicly inspectable comparative performance evidence | 1 | 1 | 1***** | 0 |
| Pricing / cost model documented | 2 | 2 | 2 | 1 |
| **Total evidence coverage / 16** | **13** | **14** | **14** | **11** |

* Browser Use's reusable workflow documentation is explicitly marked beta; API/features may change.  
** CloudBrowser source contains durable operational entities and workflow infrastructure, but end-to-end durability/recovery was not certified in this pass.  
*** No on-premises/self-hosting evidence was found in the Browserbase documentation reviewed; this is not proof that no private deployment option exists.  
**** CloudBrowser has documented project scoping, quotas and tenant/RLS work, but historical audit documents identify unresolved areas requiring a current, independent security test.  
***** Browser Use publishes comparisons and benchmark data on its own site; those are vendor-associated results, not independent validation.

## Findings by competitor

### Browserbase
- Official documentation demonstrates Stagehand integration, API/SDK session management, and per-session live debugging URLs.
- A Browserbase example explicitly checks project concurrency and runs sessions sequentially when concurrency is one; this is a useful reliability pattern for CloudBrowser.
- Sources: https://docs.browserbase.com/integrations/vercel/quickstart

### Browserless
- Official docs expose distinct REST endpoints for screenshots, PDFs, rendered content, scraping, performance audits and crawling.
- REST calls are described as stateless single actions; the docs recommend session APIs when state must persist and document self-hosting/private fleet options.
- Official docs also describe concurrency patterns and session persistence.
- Sources: https://docs.browserless.io/rest-apis/intro ; https://docs.browserless.io/ ; https://docs.browserless.io/examples/concurrent-sessions ; https://docs.browserless.io/examples/persist-session

### Browser Use
- Official docs describe reusable YAML workflows for repeatable tasks, execution status, cancellation, logs, webhooks, and workflow inputs; the feature is beta.
- Cloud sessions and output artifacts are exposed through documented APIs.
- Browser Use's own comparison page reports performance/stealth results, but these are vendor-associated measurements. Do not use them as independent proof of superiority.
- Sources: https://docs.cloud.browser-use.com/usage/workflows-beta ; https://github.com/browser-use/browser-use/blob/main/CLOUD.md ; https://browser-use.com/alternatives/browserbase

## Independent evidence and limitations
- A current third-party comparison cautions that vendor-published features/pricing do not establish which system is faster, more reliable, or cheaper for a specific workload.
- The publicly surfaced Browser Use vs Browserbase latency comparison is authored by Browser Use; it is not treated as an independent benchmark.
- Sources: https://www.itechguides.com/browserless-vs-browserbase-which-browser-automation-platform-is-better/ ; https://browser-use.com/posts/browser-use-vs-browserbase

## Highest-value CloudBrowser improvements
1. Add executable gateway negative tests for malformed JSON, invalid shapes, authorization failures, rate limits, and sanitized unexpected errors.
2. Capture request ID + gateway identity + redacted provider status for every 500, then reproduce the actual reported failure in verified staging.
3. Bound concurrency from measured provider/engine capacity and test overload responses, Retry-After, cancellation and retry amplification.
4. Normalize error contracts so provider/internal exception details are not returned to callers; preserve useful recovery hints and controlled diagnostic logs.
5. Make session cleanup and artifact persistence measurable with a create → navigate → interact → extract → screenshot → readback → terminate E2E test.
6. Validate tenant isolation and RLS with negative cross-tenant tests; do not infer safety from policies existing alone.
7. Measure p50/p95, success rate, retries, orphan rate, and cost per successful task against the same synthetic workload before assigning performance scores.

## Competitive score decision
No weighted system-quality score is assigned yet. The requested weights (reliability 25%, security 25%, functionality 20%, UX/accessibility 10%, performance/cost 10%, operations/observability 10%) require live and independent test evidence. Assigning numerical scores before those tests would be speculative. The 0–2 matrix above is a documented-capability evidence index only.
