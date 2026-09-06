# Brain ↔ Eyes Bi-Directional Integration Spec

## Architecture
- **V-1 (Brain)** = Vision Cortex Base44 app (`thevisioncortex.com` / `vision-cortex` GitHub repo) — intelligence processing, decision-making, council debates, agent management
- **V-2 (Eyes)** = Cloud Browser Base44 app (`cloud-browser.base44.app`) — browser automation, web scraping, data extraction

## Data Flow
1. **Eyes → Brain**: Eyes pushes scraped intelligence (artifacts, seeds, money trails) to Brain's `syncFromEyes` endpoint
2. **Brain → Eyes**: Brain sends commands (scrape URL, create job, run cycle, add seed) to Eyes' `receiveBrainCommand` webhook

## What's Built on the Eyes (V-2) Side

### Secrets (set in Eyes app)
- `VISION_CORTEX_BRAIN_URL` — Brain's published URL (e.g. `https://thevisioncortex.com`)
- `VISION_CORTEX_BRAIN_API_KEY` — key Eyes uses to authenticate outbound pushes
- `VISION_CORTEX_INBOUND_API_KEY` — key Brain uses to authenticate inbound commands

### Entities
- `BrainSyncLog` — tracks every sync event (direction, source, status, response)
- `BrainCommand` — command queue from Brain (command_type, payload, status, result)

### Backend Functions
- `syncToBrain` — pushes unsynced intelligence to Brain's `/functions/syncFromEyes`
- `receiveBrainCommand` — webhook at `/functions/receiveBrainCommand` that Brain calls to queue commands
- `processBrainCommands` — executes pending commands (creates jobs, seeds, runs cycles)
- `testBrainConnection` — pings Brain's `/functions/brainHealth` to verify connectivity

### Workflow
- `Brain Eyes Sync` — every 5 minutes: push to Brain + process pending commands

### UI
- "Brain Link" tab in Vision Cortex Intelligence page

---

## What the Brain (V-1) Needs to Implement

Add these 2 backend functions to the `vision-cortex` repo:

### 1. `syncFromEyes` — receives intelligence pushes from Eyes

```typescript
// base44/functions/syncFromEyes/entry.ts
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  
  // Authenticate — must match VISION_CORTEX_BRAIN_API_KEY set in Eyes
  const eyesKey = req.headers.get("x-eyes-api-key");
  const expectedKey = secrets.get("EYES_INBOUND_API_KEY"); // set this secret in Brain app
  if (eyesKey !== expectedKey) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { batch } = body;

  // Store each item in IntelFeed (or your preferred entity)
  let stored = 0;
  for (const item of batch) {
    await base44.asServiceRole.entities.IntelFeed.create({
      source: "cloud-browser-eyes",
      source_type: item.source_type,
      source_id: item.source_id,
      title: item.data.title || item.data.entity_name,
      content: JSON.stringify(item.data),
      intelligence_category: item.data.intelligence_category || "scraped_records",
      status: "pending",
      received_at: new Date().toISOString(),
    }).catch(() => {});
    stored++;
  }

  return Response.json({ ok: true, stored, received: batch.length });
}
```

### 2. `brainHealth` — connection test endpoint

```typescript
// base44/functions/brainHealth/entry.ts
import { secrets } from "base44:runtime";

export default async function (req) {
  const eyesKey = req.headers.get("x-eyes-api-key");
  const expectedKey = secrets.get("EYES_INBOUND_API_KEY");
  if (eyesKey !== expectedKey) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    app: "vision-cortex-brain",
    version: "v1",
    timestamp: new Date().toISOString(),
  });
}
```

### 3. Brain → Eyes: sending commands

From any Brain backend function or agent, send commands to the Eyes:

```typescript
// Example: Brain agent tells Eyes to scrape a URL
const eyesUrl = "https://cloud-browser.base44.app/functions/receiveBrainCommand";
const eyesKey = secrets.get("VISION_CORTEX_INBOUND_API_KEY"); // must match Eyes' VISION_CORTEX_INBOUND_API_KEY

await fetch(eyesUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-brain-api-key": eyesKey,
  },
  body: JSON.stringify({
    command_type: "scrape_url",
    payload: { url: "https://example.com", shadow_mode: true },
    brain_command_id: "cmd-123",
    priority: 3,
    brain_agent: "Primus",
  }),
});
```

### Supported Command Types
| command_type | payload fields | Eyes action |
|---|---|---|
| `create_job` | `{name, url, priority, session_config, shadow_mode}` | Creates a Job in Eyes |
| `scrape_url` | `{url, shadow_mode}` | Queues a scrape job |
| `add_seed` | `{title, url, source_type, category, description, priority}` | Adds an IntelligenceSeed |
| `run_cycle` | `{}` | Triggers full intelligence cycle |
| `run_monetization` | `{}` | Triggers monetization cycle |
| `follow_money` | `{}` | Triggers Follow the Money research |
| `update_strategy` | `{title, observation, insight, strategy_text, confidence}` | Stores as a VisionCortexReflection |
| `custom` | `{...}` | Queued for manual review |

---

## Setup Checklist
1. ✅ Eyes secrets set: `VISION_CORTEX_BRAIN_URL`, `VISION_CORTEX_BRAIN_API_KEY`, `VISION_CORTEX_INBOUND_API_KEY`
2. ⬜ Brain secrets to set: `EYES_INBOUND_API_KEY` (same value as Eyes' `VISION_CORTEX_BRAIN_API_KEY`), `VISION_CORTEX_INBOUND_API_KEY` (same value as Eyes' `VISION_CORTEX_INBOUND_API_KEY`)
3. ⬜ Add `syncFromEyes` function to Brain repo
4. ⬜ Add `brainHealth` function to Brain repo
5. ⬜ Publish Brain app
6. ⬜ Set `VISION_CORTEX_BRAIN_URL` to Brain's published URL
7. ⬜ Test connection from Eyes "Brain Link" tab