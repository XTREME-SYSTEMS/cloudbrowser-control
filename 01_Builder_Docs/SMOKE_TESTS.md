# Smoke Tests

1. browser_health returns healthy engine identity.
2. browser_start returns entity + runtime session IDs.
3. navigate + observe succeed on the same session.
4. session_save returns opaque persist_* token and no cookies/storage.
5. End original session/runtime.
6. session_restore creates a new runtime session using durable state.
7. observe verifies restored route/state where applicable.
8. context_restore returns metadata only.
9. context_attach creates a session without credential disclosure.
10. build, lint, typecheck, engine syntax/tests, and security gate PASS.
