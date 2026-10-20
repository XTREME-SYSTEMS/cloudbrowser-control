/**
 * THE FROZEN NINE-STAGE SPINE
 * ==========================================================================
 * Every service, without exception, runs these nine stages in this order with
 * these exact names. Determinism is the product here: a buyer, an auditor or a
 * court can be told what happens next and be right every time.
 *
 *   1 Plan · 2 Discovery · 3 Strategy · 4 Implementation ·
 *   5 Validation · 6 QA · 7 Auto-Recommendation · 8 Iteration · 9 Final Results
 *
 * Stages 5→6→7 repeat inside stage 8 until QA clears or the cap is reached;
 * stage 8 records what was re-run and why it stopped, so the linear display
 * never hides the loop.
 *
 * The service's own numbered steps (intake, feasibility sample, extraction
 * build …) are the WORK INSIDE stages 1-4. They are assigned to a stage by a
 * fixed keyword rule and a stated fallback, so the same step always lands in
 * the same stage — never by judgement, never differently between runs.
 *
 * Pure logic, no SDK.
 */

import type { Service, WorkflowStep } from "./serviceCatalog.ts";

export type StageKey =
  | "plan"
  | "discovery"
  | "strategy"
  | "implementation"
  | "validation"
  | "qa"
  | "auto_recommendation"
  | "iteration"
  | "final_results";

export type StageDef = {
  n: number;
  key: StageKey;
  name: string;
  purpose: string;
};

/** The nine stages. Changing this list changes every run, so it is frozen. */
export const SPINE: StageDef[] = [
  { n: 1, key: "plan", name: "Plan", purpose: "Fix the deliverable, the authority and the acceptance criteria before any source is touched." },
  { n: 2, key: "discovery", name: "Discovery", purpose: "Find and confirm the real targets, sources and constraints." },
  { n: 3, key: "strategy", name: "Strategy", purpose: "Choose the method and route, and state why that method rather than another." },
  { n: 4, key: "implementation", name: "Implementation", purpose: "Execute the work and capture what was actually retrieved." },
  { n: 5, key: "validation", name: "Validation", purpose: "Independently check every claimed result against its evidence, on a separate model family." },
  { n: 6, key: "qa", name: "QA", purpose: "Score the deliverable against the quality standard, and let the guardian refuse it." },
  { n: 7, key: "auto_recommendation", name: "Auto-Recommendation", purpose: "State what to change next time, derived from this run rather than from opinion." },
  { n: 8, key: "iteration", name: "Iteration", purpose: "Repeat Validation through Auto-Recommendation until QA clears, or state why it stopped." },
  { n: 9, key: "final_results", name: "Final Results", purpose: "Deliver, or refuse, with the verdict and the reason." },
];

export const SPINE_NAMES: string[] = SPINE.map((s) => s.name);

/** The loop cap. Reaching it is recorded as a stop reason, never silently ignored. */
export const MAX_ITERATIONS = 3;

export const WORK_STAGES: StageKey[] = ["plan", "discovery", "strategy", "implementation"];

export function stageByKey(key: string): StageDef | null {
  return SPINE.find((s) => s.key === key) || null;
}

// ── Deterministic assignment of a service's own steps into stages 1-4 ──────
// Checked in this order, first match wins. A step that names no planning,
// discovery or strategy act is Implementation by rule — that is where the work
// itself lives, and the rule is stated so nobody has to guess.

const PLAN_KW = ["intake", "scop", "authoriz", "permission", "purpose", "brief", "question fram", "watchlist", "definition", "define", "control map", "asset inventor", "inventor", "standard set", "rights clearance", "critical path", "file intake", "consent", "specification", "portal inventor"];
const DISCOVERY_KW = ["discover", "find", "feasib", "sample", "locate", "map", "source plan", "fingerprint", "probe", "resolv", "baseline", "screen", "profile", "audit", "inventory", "chain build", "identity"];
const STRATEGY_KW = ["strateg", "method", "model build", "change model", "route", "approach", "matching", "match plan", "select", "design", "priorit", "plan", "schedule", "tier", "caden", "threshold", "configur", "environment", "binding", "credential handling", "escalation", "instrumentat"];

export function stageKeyForStep(step: WorkflowStep, index: number, total: number): StageKey {
  const haystack = `${step?.name || ""} ${step?.desc || ""}`.toLowerCase();
  if (PLAN_KW.some((k) => haystack.includes(k))) return "plan";
  if (DISCOVERY_KW.some((k) => haystack.includes(k))) return "discovery";
  if (STRATEGY_KW.some((k) => haystack.includes(k))) return "strategy";
  void index;
  void total;
  return "implementation";
}

export type StageSubStep = {
  n: number;
  name: string;
  desc: string;
  expected_result: string;
  result: string;
  status: string;
};

export type StageState = {
  n: number;
  key: StageKey;
  name: string;
  purpose: string;
  status: "pending" | "running" | "done" | "skipped" | "failed" | "blocked";
  result: string;
  skipped_reason: string;
  started_at: string;
  finished_at: string;
  sub_steps: StageSubStep[];
};

/**
 * The run skeleton: all nine stages present from the moment the run opens, so
 * a run in progress already shows its full shape.
 */
export function buildStageSkeleton(service: Service): StageState[] {
  const assigned = new Map<string, StageSubStep[]>();
  service.workflow.forEach((s, i) => {
    const key = stageKeyForStep(s, i, service.workflow.length);
    const list = assigned.get(key) || [];
    list.push({ n: s.n, name: s.name, desc: s.desc, expected_result: s.result, result: "", status: "pending" });
    assigned.set(key, list);
  });

  return SPINE.map((def) => ({
    n: def.n,
    key: def.key,
    name: def.name,
    purpose: def.purpose,
    status: "pending" as StageState["status"],
    result: "",
    skipped_reason: "",
    started_at: "",
    finished_at: "",
    sub_steps: assigned.get(def.key) || [],
  }));
}

/** Stage counts for monitoring: how many of the nine have a result. */
export function stageProgress(stages: StageState[]) {
  const total = stages.length || SPINE.length;
  const finished = stages.filter((s) => s.status === "done" || s.status === "failed" || s.status === "skipped" || s.status === "blocked").length;
  return { finished, total, complete: finished === total };
}