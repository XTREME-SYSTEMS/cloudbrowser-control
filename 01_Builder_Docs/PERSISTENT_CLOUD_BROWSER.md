# Persistent Cloud Browser Contract

Goal: recover browser state across engine/runtime loss without exposing authentication state to an external caller.

Implementation on this branch:
- Authenticated engine save returns a state snapshot only to the server-side gateway.
- Gateway encrypts cookies and Playwright storage state in BrowserContext.
- External caller receives only an opaque persist_* token.
- session_restore can create a fresh engine session from encrypted durable state.
- context_restore returns metadata only.
- context_attach creates a new session without disclosing cookies/storage.

Acceptance: build, lint, typecheck, engine syntax/tests, security audit, and black-box save/end/restore/navigate/observe must PASS on an isolated preview/staging runtime. Rollback must be verified before production approval.
