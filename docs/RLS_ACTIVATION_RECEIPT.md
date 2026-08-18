# RLS Activation Receipt — PROTECTED ACTION #1

**Date**: 2026-08-18
**Approved by**: User (explicit approval)
**Deployment Version**: v5.0.0

## Pre-Change State

**RLS Status**: NOT ACTIVATED on any entity. All 34 production entities have NO `rls` key.

**Entities audited** (34 total):
- Owner-Only (8): Session, Job, Step, Result, Screenshot, LogEntry, Artifact, BrowserContext
- Admin-Managed (8): Proxy, Webhook, Extension, SystemSettings, CostSettings, Template, Plan, Setting
- Owner+Admin (5): ApiKey, Project, Schedule, Profile, JobVersion
- System-Managed (12): AuditLog, CostEntry, EngineHealthLog, RateLimitEntry, TestResult, ScoreRecord, WebhookDelivery, ChangeAlert, ErrorPattern, CapabilityRegistry, Notification, Subscription
- Team (1): Team (owner+members+admin)

## Rollback Instructions

To roll back RLS activation:
1. Remove the `"rls"` key from each entity's `.jsonc` file
2. Save the file — rules are removed immediately
3. All app-user requests revert to open access (pre-change state)

Rollback is safe and immediate. No data migration required. No secrets affected.

## Field Path Verification

Custom fields referenced in RLS rules (verified against live schemas):
- `Notification.user_id` → `data.user_id` ✅ (required field)
- `Subscription.user_id` → `data.user_id` ✅ (required field)
- `Team.owner_id` → `data.owner_id` ✅ (required field)
- `Team.member_ids` → `data.member_ids` ✅ (array of user IDs)
- All other entities use `created_by_id` (built-in, always present) ✅

## Activation Scope

This activation is LIMITED to adding `rls` keys to entity schemas. It does NOT:
- Change any backend function logic
- Modify secrets or encryption keys
- Modify billing or subscription logic
- Modify DNS or network configuration
- Deploy new infrastructure
- Delete any production data
- Weaken any existing tests