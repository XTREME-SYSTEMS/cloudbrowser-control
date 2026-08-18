# Tenancy & RBAC Design Specification

## Status: DESIGN — Awaiting operator approval for production RLS migration

## Target Hierarchy

```
Organization
  └── Team
       └── Project
            └── Environment
                 └── API Key
                 └── Context
                 └── Session
                 └── Job
                      └── Step
                      └── Artifact
```

## Roles

| Role | Permissions |
|------|-------------|
| owner | Full org control, billing, delete org |
| admin | Manage teams, projects, members, settings |
| developer | Create/edit jobs, sessions, contexts; read settings |
| operator | Execute jobs, manage sessions, view dashboards |
| viewer | Read-only access to all resources |
| billing | View billing, invoices, usage |

## RLS Policy Pattern

Every data entity gets an `organization_id` and `project_id` field. RLS rules:

### Read (list/filter/get)
```
user.organization_id == record.organization_id
AND (
  user.role in ["owner", "admin"]
  OR (user.role == "developer" AND user.project_ids includes record.project_id)
  OR (user.role == "operator" AND user.project_ids includes record.project_id)
  OR (user.role == "viewer")
)
```

### Write (create)
```
user.organization_id == new_record.organization_id
AND user.role in ["owner", "admin", "developer", "operator"]
```

### Update/Delete
```
user.organization_id == record.organization_id
AND (
  user.role in ["owner", "admin"]
  OR (user.role in ["developer", "operator"] AND user.project_ids includes record.project_id)
)
```

## Entities Requiring RLS

Session, Job, Step, Result, Screenshot, LogEntry, ApiKey, Project, Webhook, Schedule, Proxy, Profile, Extension, Artifact, Setting

## Negative Tests Required

- Cross-tenant read must fail (403/404)
- Cross-tenant update must fail
- Cross-tenant delete must fail
- Cross-tenant artifact access must fail
- Cross-tenant session control must fail
- Cross-tenant context reuse must fail
- Cross-tenant job execution must fail

## Implementation Status

- **Entity schemas**: Need `organization_id` and `project_id` fields added
- **RLS rules**: Need to be written per entity in `base44/entities/*.jsonc` under `rls` key
- **User entity**: Need `organization_id`, `role`, `project_ids` fields
- **Tests**: Need cross-tenant negative tests in runTestSuite

## Protected Gate

Applying RLS migrations to production entities is **approval-gated** because:
- Misconfigured RLS can lock users out of their own data
- Existing records need organization_id backfilled
- Requires coordinated schema + RLS deployment

**STOP — Request operator approval before applying RLS to production entities.**