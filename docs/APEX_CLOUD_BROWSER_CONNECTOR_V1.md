# Apex Cloud Browser Connector v1

## Purpose

Create a direct, deterministic connector between Apex and Xtreme Cloud Browser without Xtreme AI Builder in the execution path.

## Control flow

ChatGPT / Apex
-> Apex connector
-> Xtreme Cloud Browser capability registry
-> Super-Agent gateway
-> specialist agent / Swarm / browser worker
-> durable job + artifacts + receipts
-> independent validation

Xtreme AI Builder is not required by this connector.

## Design rules

1. Current app user authentication is required.
2. No plaintext connector secret is stored in repository code.
3. Agent names are allowlisted.
4. Browser work invokes the existing governed browser runtime.
5. Capability discovery reads the live CapabilityRegistry.
6. Every request receives a request_id.
7. Agent dispatch writes an AuditLog receipt.
8. Production, secrets, DNS, payments, destructive actions and public/customer communication remain approval-gated by downstream policy.
9. Queueing is never reported as execution.
10. The connector does not claim VERIFIED_100. Independent validation owns certification.

## Initial operations

- health
- discover_capabilities
- list_agents
- agent_task
- browser_task
- get_job
- get_receipt

## Why this is lower friction

The connector talks directly to the Cloud Browser runtime and its own Super-Agent gateway. It does not require an Xtreme AI Builder job, builder session, project translation layer, or builder-specific state.

## Next stages

- Add OAuth/app-connector authentication for external clients without weakening authorization.
- Add typed work packets and idempotency keys.
- Add queue/lease/resume operations.
- Add explicit approval inspection.
- Add validator dispatch and repair receipts.
- Add Shadow status and drift events.
- Add MCP/OpenAPI discovery document.
- Independently test the connector in branch/preview before production activation.
