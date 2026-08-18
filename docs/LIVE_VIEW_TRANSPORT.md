# True Live View Transport Design

## Status: ARCHITECTURE — Screenshot polling is current ceiling

## Current State

`LiveView.jsx` polls `GET /sessions/:id/screenshot` every 3 seconds. This is not interactive.

## Target Architecture

### Option A: CDP Relay via WebSocket (preferred)
```
Client (browser) ←→ WebSocket Gateway ←→ Railway Worker ←→ Chromium CDP
```

The gateway proxies CDP commands over WebSocket. The client renders a canvas from CDP frame data.

### Option B: VNC-over-WebSocket
Railway worker runs a VNC server attached to the Chromium display. A noVNC client in the browser connects via WebSocket relay.

### Option C: Screencast Frame Stream
Use Playwright's `page.screencast()` (CDP `Page.screencastFrame`) to stream frames over WebSocket at ~10-30fps.

## Required Operator Capabilities

- Watch live browser (low-latency streaming)
- Mouse input (click, move, drag)
- Keyboard input (type, press)
- Scroll
- Tab management
- Current URL display
- Browser dimensions
- Reconnect on disconnect
- View-only mode
- Interactive mode
- Operator takeover (pause agent, human controls)
- Agent-to-human handoff
- Human-to-agent return
- Expiring share links (TTL)
- Revocation
- Optional password protection
- Project authorization
- Audit log of all interactions

## Security Requirements

- **Never expose worker localhost CDP endpoint externally**
- WebSocket must authenticate with share token or API key
- View-only mode prevents input injection
- Interactive mode requires explicit authorization
- All input events logged for audit
- Share links expire (default 1 hour, max 24 hours)
- Revocation kills active connections immediately

## Implementation Plan

1. Add WebSocket server to `browser-engine/server.js`
2. Implement CDP session attach/detach
3. Stream `Page.screencastFrame` events over WebSocket
4. Proxy mouse/keyboard events from client to CDP
5. Add share token validation + TTL
6. Build `InteractiveLiveView.jsx` client component
7. Add operator takeover protocol (pause agent → human control → resume)

## Protected Gate

WebSocket transport requires:
- Railway WebSocket support (verify plan supports persistent connections)
- WSS/TLS termination configuration
- Connection limit tuning
- Public endpoint exposure approval