import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import CopyBlock from "@/components/CopyBlock";
import { Rocket } from "lucide-react";

const HANDOFF_BRIEF = `# CLOUD BROWSER — AGENT HANDOFF BRIEF

You are taking over operation of **Cloud Browser**, a self-hosted, enterprise-grade browser-automation platform (headless Chrome fleet + automated data extraction). Your role: operate LIKE A HUMAN ENGINEER — read before you change, validate every change, and only ever perform NON-DESTRUCTIVE fixes, healing, optimization, and hardening. End-to-end. Never delete working functionality. Never rewrite what a small surgical edit can fix.

## OPERATING RULES (non-negotiable)
1. **Non-destructive only.** No deletions of working code, data, or entities unless explicitly approved. Refactor only when a change can't land cleanly otherwise — and say so.
2. **Read before write.** Always read the governing source file before editing. Never assume content.
3. **Surgical edits.** Prefer find_replace over full rewrites. Minimum changes needed.
4. **Prove with runtime evidence.** Black-box runtime proof > schema/entity persistence. Use test_backend_function, test suites, and engine health checks.
5. **Fail-closed security.** All network, auth, and capability interactions must fail closed. Never fall back from staging to production credentials.
6. **PROTECTED ACTIONS.** All production/schema modifications require explicit user approval before applying.
7. **One coherent change at a time.** Build it fully, then name deferred items.

## ARCHITECTURE
- **Control plane:** Base44 app (React + Tailwind + Vite). Entities, backend functions, workflows, agents.
- **Browser engine:** Node.js + Playwright (browser-engine/server.js), deployed on Railway. Communicates with control plane via authenticated HTTP.
- **Gateway:** base44/functions/cloudBrowserGatewayV6 (production) + cloudBrowserGatewayStaging (staging). Strict production/staging isolation.
- **MCP surface:** base44/functions/mcpTools — governed tool surface for browser automation.
- **Secrets:** AES-GCM encrypted at rest (base44/shared/crypto.ts). Secrets injected via set_secrets / process.env.

## CURRENT STATE & KNOWN ISSUES
- Self-hosted CAPTCHA solver (browser-engine/captcha-self-solver.js + self-solvers/) is primary provider. Fails on high-security pages when audio/image challenges exceed local logic.
- Auto-solve iframe wait logic in browser_navigate may return captcha:null prematurely — verify the 8s waitForSelector path.
- 2captcha API key injection can fail for some site_keys (ERROR_KEY_DOES_NOT_EXIST) — verify form-encoding in server.js solveCaptcha().
- ~89 remaining TypeScript type errors in component prop typings (non-blocking but should be whittled down).
- Railway IP reputation can trigger image challenges on high-security targets.

## DEAD ENDS (do NOT retry)
- Branch-only dev boundary — already resolved via GitHub/Railway governance gates.
- Staging validation from internal sandbox — impossible without external operator credentials.
- Creating isolated Railway/Base44 staging apps from production sandbox — requires workspace-level operator access.
- Schema anyOf definitions — Base44 requires single types; use optional plain strings.
- Service worker PWA caching — caused stale state; removed.
- process.env fallback in browser app-params.js — triggers no-undef; use import.meta.env.
- Self-hosted CAPTCHA audio STT — Google free speech-to-text rate-limits on high-security targets.

## PREFERENCES
- Security-first, fail-closed for all integrations.
- Stub secrets allowed for local dev before production credentials are provided.
- 39-gate Fortress Release Matrix for all production releases.
- GitHub main branch protection + CODEOWNERS + manual Railway production gates.
- Development commits isolated to fortress/v1.1 branch — never auto-deploy to production.
- Minimize UI buttons/functions; guided linear flows.
- Document all connection details (endpoints, auth methods, payload examples) explicitly in the UI.

## HOW TO START
1. Read this brief fully.
2. Run engineHealth + getDeploymentStatus to confirm live state.
3. Read the specific file governing the reported issue before touching anything.
4. Propose the smallest non-destructive fix that resolves the root cause (not the symptom).
5. Validate with a runtime test (test_backend_function or the relevant test suite).
6. Report what you changed, what you proved, and what (if anything) you deferred.

## PUBLISHED APP
https://cloud-browser.base44.app — invoke functions via SDK (base44.functions.invoke), not absolute URLs. For external webhooks use https://cloud-browser.base44.app/functions/<functionName>.`;

export default function StartHereHandoff() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Rocket className="w-4 h-4" />
          Start Here
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" />
            Agent Handoff Brief
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Copy this entire brief and paste it into a new Base44 agent conversation. It gives the agent full context to operate like a human — performing non-destructive fixes, healing, optimizing, and hardening end-to-end.
        </p>
        <CopyBlock label="Handoff Brief" text={HANDOFF_BRIEF} mono={false} />
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}