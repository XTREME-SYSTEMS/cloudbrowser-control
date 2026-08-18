# AI-Native Browser Layer Design

## Status: ARCHITECTURE — Partially implemented (aiBuildSteps exists)

## Four Primitives

### ACT — Natural language → validated browser action
```
Input: { natural_language: "click the login button", session_id }
Output: { action_type: "click", selector: "#login-btn", confidence: 0.95 }
```
LLM proposes a deterministic action. The deterministic runtime executes it. LLM never touches the browser directly.

### OBSERVE — Discover actionable elements
```
Input: { session_id, intent: "find the checkout button" }
Output: { elements: [{ selector, tag, text, role, bounds, confidence }] }
```
Returns structured actionable elements from the live page.

### EXTRACT — Natural language + schema → structured result
```
Input: { session_id, prompt: "extract all product prices", schema: {...} }
Output: { data: {...}, confidence: 0.92, evidence: "screenshot_id" }
```
Already partially implemented as `ai_extract` action.

### AGENT — Goal → bounded multi-step execution
```
Input: {
  goal: "log in and download the invoice",
  session_id,
  max_steps: 20,
  max_runtime_ms: 120000,
  token_budget: 10000,
  cost_budget: 0.50,
  allowed_domains: ["example.com"],
  blocked_domains: [],
  approval_required_actions: ["delete", "submit_payment"]
}
Output: {
  steps_executed: [...],
  result: {...},
  termination_reason: "goal_achieved" | "max_steps" | "timeout" | "budget_exceeded" | "approval_required" | "error",
  cost: 0.23,
  confidence: 0.88,
  trace: [...],
  screenshots: [...]
}
```

## Safety Model

1. LLM decides WHAT to do (proposes actions)
2. Deterministic runtime executes HOW (Playwright operations)
3. Approval-required actions pause for human operator
4. Domain allowlist/blocklist enforced at runtime level
5. Every step produces before/after screenshots
6. Token/cost/time budgets enforced — agent terminates when exceeded
7. All actions logged with evidence

## Model Routing

```
model_selection:
  - automatic: default
  - gemini_3_flash: fast, cheap, web search
  - claude_sonnet_4_6: complex reasoning
  - gpt_5_6: high-stakes decisions
  fallback: if primary fails, try secondary
```

## Implementation Plan

1. **ACT**: New `aiAct` function — LLM proposes action → validate → execute via engineAction
2. **OBSERVE**: New `aiObserve` function — extract page structure → LLM ranks elements
3. **EXTRACT**: Already exists as `ai_extract` — enhance with schema validation
4. **AGENT**: New `aiAgent` function — loop of OBSERVE → ACT → EXTRACT with bounds

## Current State

- `aiBuildSteps` exists: generates step list from prompt (pre-execution)
- `ai_extract` action exists: extracts page text → LLM → structured data
- Missing: ACT, OBSERVE, AGENT primitives, bounded execution, approval gates