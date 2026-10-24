// The guardian's hard spec — the whole authority an automatic repair has.
//
// This catalogue is an ALLOWLIST. Everything the agent may do unattended is named
// here; everything else is refused. That direction is the point: an action nobody
// wrote down — one added later, a typo, a caller-supplied string — is refused
// rather than attempted.
//
// The model review in openClawAgent may only NARROW this list. It can turn an
// allowed action into a refusal; it can never admit one the catalogue excludes.
// So a confused or prompt-injected reviewer cannot widen authority, and a failed
// review fails closed.
//
// Two risk levels matter at runtime:
//   safe     — applied during a cycle, because it is reversible and carries its own guards
//   approval — queued with the exact command, and run only when a human says so
// A third class is refused outright and is never queued, only reported.

export const POLICY_VERSION = "openclaw-guardian/2026.10.24";

export const RISK_SAFE = "safe";
export const RISK_APPROVAL = "approval";
export const RISK_BLOCKED = "blocked";

// Two different model families, so no single model reviews its own work.
export const GUARDIAN_MODEL = "claude_opus_5_5";
export const VALIDATOR_MODEL = "gpt_6_sol";

export const ACTION_CATALOG = [
  {
    id: "platform.autoheal",
    label: "Run the platform auto-heal cycle",
    target_type: "platform",
    risk: RISK_SAFE,
    executor: "function",
    function_name: "railwayAutoHeal",
    reversible: true,
    why: "Acts only on services demonstrably not serving browser work, rebuilds a degraded engine's pool in place, and carries its own 5-minute cooldown and 5-per-target-per-day cap.",
  },
  {
    id: "platform.pool_reconcile",
    label: "Reconcile the browser pools",
    target_type: "platform",
    risk: RISK_SAFE,
    executor: "function",
    function_name: "managePool",
    reversible: true,
    why: "Warms and trims the browser pool to the configured target. Adds or retires sessions inside the container and restarts nothing.",
  },
  {
    id: "machine.reclaim_temp",
    label: "Reclaim stale temp files",
    target_type: "machine",
    risk: RISK_APPROVAL,
    executor: "device",
    reversible: false,
    why: "Deletes temp files older than three days under the WSL /tmp only. Nothing else on the machine is touched, and the exact command is shown before it runs.",
  },
  {
    id: "machine.gateway_restart",
    label: "Restart the OpenClaw gateway",
    target_type: "machine",
    risk: RISK_APPROVAL,
    executor: "device",
    reversible: true,
    requires_mechanism: true,
    why: "Stops and starts the operator's own assistant. Refused unless the start mechanism was discovered first, so a restart can never leave it down.",
  },
];

// Refused outright. Listed so a refusal is explainable rather than a silent gap,
// and so the boundary is visible to the operator instead of living in code.
export const BLOCKED_CLASSES = [
  { id: "code.edit", label: "Edit application or engine code", why: "Source changes are never made unattended: they need review, a build and a deploy." },
  { id: "data.delete", label: "Delete records or files", why: "Destructive data work is never automatic, whatever the diagnosis says." },
  { id: "credentials.rotate", label: "Rotate, read or move credentials", why: "Keys are only handled by the operator, in the secrets store." },
  { id: "spend.money", label: "Spend money or change a plan", why: "Any action with a cost or a commitment is the operator's call alone." },
  { id: "outbound.client_message", label: "Send anything to a client", why: "A sent message cannot be recalled, so a human sends it." },
  { id: "os.destructive", label: "Destructive operating system work", why: "Partitioning, formatting, user, service, registry and firewall changes are outside anything automatic repair may touch." },
  { id: "infra.destructive", label: "Destroy infrastructure", why: "Deleting a service, volume, domain or environment is never automatic." },
];

export function catalogEntry(id) {
  return ACTION_CATALOG.find((entry) => entry.id === id) || null;
}

/**
 * The deterministic verdict on one action. Unknown actions are refused, and when
 * the operator has switched automatic platform repair off, the safe platform
 * actions drop to approval instead of disappearing — they stay available, they
 * simply stop acting on their own.
 */
export function classify(id, { platformAutofix = true } = {}) {
  const entry = catalogEntry(id);
  if (!entry) {
    return {
      id,
      label: String(id || "unnamed action"),
      risk: RISK_BLOCKED,
      allowed: false,
      requires_approval: false,
      blocked: true,
      executor: "none",
      reason: `"${id}" is not in the guardian catalogue, so it is refused. An action that was never written down is never executed.`,
      why: null,
    };
  }

  const downgraded = entry.risk === RISK_SAFE && entry.target_type === "platform" && !platformAutofix;

  if (entry.risk === RISK_SAFE && !downgraded) {
    return {
      ...entry,
      allowed: true,
      requires_approval: false,
      blocked: false,
      reason: `Automatic: ${entry.why}`,
    };
  }

  const reason = downgraded
    ? `Automatic platform repair is switched off, so this is queued for your approval instead. ${entry.why}`
    : `Needs your approval: ${entry.why}`;

  return { ...entry, allowed: false, requires_approval: true, blocked: false, reason };
}

/** What the console shows so the boundary is readable, not implied. */
export function policyDigest() {
  return {
    policy_version: POLICY_VERSION,
    guardian_model: GUARDIAN_MODEL,
    validator_model: VALIDATOR_MODEL,
    catalogue: ACTION_CATALOG.map(({ id, label, risk, target_type, why }) => ({ id, label, risk, target_type, why })),
    blocked: BLOCKED_CLASSES,
  };
}

// No caller-supplied string is ever placed into a device command unvalidated.
const SHELL_META = /[;&|`$(){}<>'"\\\n\r\t*?~]/;

export function assertSafeToken(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  if (SHELL_META.test(value)) {
    throw new Error(`${label} contains characters that are not allowed in a device command.`);
  }
  return value;
}

/** A systemd unit name may only ever be a plain name that mentions the assistant. */
export function assertUnitName(unit) {
  assertSafeToken(unit, "The unit name");
  if (!/^[A-Za-z0-9_.@-]+$/.test(unit) || !/claw/i.test(unit)) {
    throw new Error("The unit name is not a plain OpenClaw service name.");
  }
  return unit;
}