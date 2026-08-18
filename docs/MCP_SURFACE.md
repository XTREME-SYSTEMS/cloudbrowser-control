# MCP Browser-Runtime Surface Design

## Status: ARCHITECTURE — Not yet implemented

## Overview

Expose CloudBrowser's browser runtime as an MCP (Model Context Protocol) service using the SAME canonical runtime and authorization as REST. No duplicate browser implementation.

## Transport

Preferred: **Streamable HTTP** (MCP spec compliant, supports SSE for streaming).

```
POST /mcp/v1/tools/call
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "navigate",
    "arguments": { "session_id": "...", "url": "https://example.com" }
  }
}
```

## Tools

| Tool | Description | Maps to |
|------|-------------|---------|
| `browser_start` | Create a new browser session | POST /sessions |
| `browser_end` | Terminate a session | DELETE /sessions/:id |
| `navigate` | Navigate to URL | action: goto |
| `act` | Execute a browser action | action: * |
| `observe` | List actionable elements | action: evaluate (DOM scan) |
| `extract` | Extract structured data | action: ai_extract |
| `screenshot` | Capture screenshot | action: screenshot |
| `list_tabs` | List open tabs | session.tabs |
| `switch_tab` | Switch active tab | action: switch_tab |
| `context_create` | Create a browser context | POST /contexts (future) |
| `context_use` | Attach context to session | session.context_id |
| `context_delete` | Delete a context | DELETE /contexts/:id |
| `artifact_get` | Download an artifact | GET /artifacts/:id |

## Authorization

- Same API key + scope system as REST
- MCP tools require `sessions:write` or `sessions:read` scopes
- Project/team binding enforced
- Rate limited via same gateway

## Implementation Plan

1. Create `base44/functions/mcpGateway/entry.ts` — MCP protocol handler
2. Map MCP tool names to existing engineAction/runJob functions
3. Expose via Base44 function HTTP endpoint
4. No separate browser engine — reuses Railway worker

## Protected Gate

MCP deployment requires:
- Public endpoint exposure (approval-gated)
- MCP client registration (ChatGPT, Claude, etc.)
- Rate limit tuning for LLM client patterns