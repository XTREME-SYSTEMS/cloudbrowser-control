# RLS Rules Proposal — PROTECTED ACTION

**Status: PREPARED — NOT YET ACTIVATED**

Activating RLS is a production protected action. These rules are prepared and ready for activation upon explicit approval.

## Activation Instructions

To activate, add the `"rls"` key to each entity's `.jsonc` file and save. Rules apply immediately to all app-user requests.

## Proposed Rules

### Owner-Only Entities (private to creator + admins)

**Session, Job, Step, Result, Screenshot, LogEntry, Artifact, BrowserContext**

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### Admin-Managed Configuration Entities

**Proxy, Webhook, Extension, SystemSettings, CostSettings, Template, Plan**

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "user_condition": { "role": "admin" } },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### API Key — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### Project — Owner + Admin (team members via members array if added)

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### Schedule — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### Profile — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### AuditLog — Admin read, system create

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### CostEntry — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### EngineHealthLog — Admin read, system create

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### RateLimitEntry — Admin only (system-managed)

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": {},
  "delete": { "user_condition": { "role": "admin" } }
}
```

### TestResult, ScoreRecord — Admin read, system create

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### WebhookDelivery — Admin read, system create

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### ChangeAlert — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": {},
  "update": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### ErrorPattern — Admin read

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": {},
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### CapabilityRegistry — Admin read/write

```jsonc
"rls": {
  "read": { "user_condition": { "role": "admin" } },
  "create": { "user_condition": { "role": "admin" } },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### Notification — Owner only

```jsonc
"rls": {
  "read": { "data.user_id": "{{user.id}}" },
  "create": {},
  "update": { "data.user_id": "{{user.id}}" },
  "delete": { "data.user_id": "{{user.id}}" }
}
```

### Subscription — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "data.user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "data.user_id": "{{user.id}}" },
  "update": { "$or": [ { "data.user_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### Team — Owner + members + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "data.owner_id": "{{user.id}}" }, { "data.member_ids": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "data.owner_id": "{{user.id}}" },
  "update": { "$or": [ { "data.owner_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "delete": { "$or": [ { "data.owner_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] }
}
```

### JobVersion — Owner + Admin

```jsonc
"rls": {
  "read": { "$or": [ { "created_by_id": "{{user.id}}" }, { "user_condition": { "role": "admin" } } ] },
  "create": { "created_by_id": "{{user.id}}" },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

## Tenant Isolation Test Plan (after activation)

1. Create two users (Tenant A, Tenant B)
2. Tenant A creates a session, job, artifact
3. Tenant B attempts to:
   - GET /sessions/:id (Tenant A's session) → 404
   - POST /sessions/:id/action → 403
   - DELETE /sessions/:id → 403
   - GET /jobs/:id → 404
   - GET /jobs/:id/results → 404
   - Download artifact → 403
4. All cross-tenant negative tests must PASS