# Rollback

This refactor is branch-only. Primary rollback is to discard the feature branch and leave main unchanged.

Before future preview or production release, record prior deployment ID/SHA, Base44 checkpoint, Railway deployment identity, schema state, and secret-reference names. No secret values belong in rollback documentation.
