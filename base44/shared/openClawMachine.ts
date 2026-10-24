import { assertUnitName } from "./openClawPolicy.ts";

// What the OpenClaw agent knows about the operator's machine, and the only two
// commands it may ever run there.
//
// Every probe is read-only and takes one round trip. The commands it may run are
// fixed constants in this file — no caller-supplied string is ever assembled into
// a device command, and the restart command carries the unit name through an
// assertion before it is embedded.

export const GATEWAY = { host: "127.0.0.1", port: 18789, health_path: "/health" };

const CLAW_HOME = "/home/next-gen-ai";
const GATEWAY_PACKAGE = `${CLAW_HOME}/.npm-global/lib/node_modules/openclaw/package.json`;

// Single quotes only: this whole script is passed as one double-quoted argument
// through PowerShell into bash, so a double quote anywhere in it would end the
// argument early. Section markers make the output parseable and keep the probe to
// a single call.
// Ordered fastest first, and nothing slow: `systemctl list-units` alone can outlast
// the device's bounded wait, and a probe that times out reads as a dead machine. The
// running gateway is already visible in the process list, so the start mechanism is
// looked for in unit files and shell profiles instead of in the running units.
const PROBE_SECTIONS = [
  "echo '## WHOAMI'; whoami",
  "echo '## HOST'; uname -sr; uptime -p 2>/dev/null || uptime",
  `echo '## GATEWAY HEALTH'; curl -s -m 6 http://${GATEWAY.host}:${GATEWAY.port}${GATEWAY.health_path}; echo`,
  `echo '## BIND'; ss -ltn 2>/dev/null | grep ${GATEWAY.port}`,
  "echo '## GATEWAY PROCESS'; ps -eo pid=,etime=,rss=,user=,comm= | grep -i openclaw | head -12",
  `echo '## GATEWAY VERSION'; grep -m1 version ${GATEWAY_PACKAGE}`,
  "echo '## CLAW ACCOUNTS'; getent passwd 2>/dev/null | grep -i claw | cut -d: -f1,3,6",
  "echo '## START MECHANISM'; ls /etc/systemd/system 2>/dev/null | grep -i claw | head -5; crontab -l 2>/dev/null | grep -i claw | head -3; grep -h -i openclaw "
    + `${CLAW_HOME}/.bashrc ${CLAW_HOME}/.profile 2>/dev/null | head -5`,
  "echo '## MEM'; free -m 2>/dev/null | head -2",
  "echo '## DISK'; df -h / /mnt/c 2>/dev/null | tail -3",
  "echo '## DONE'",
];

export function gatewayProbeCommand() {
  return `wsl -d Ubuntu -- bash -lc "${PROBE_SECTIONS.join("; ")}"`;
}

function sectionsOf(text) {
  const out = {};
  let current = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    const marker = line.match(/^\s*##\s+([A-Z ]+?)\s*$/);
    if (marker) {
      current = marker[1].trim();
      out[current] = [];
      continue;
    }
    if (current) out[current].push(line);
  }
  return out;
}

function body(sections, name) {
  return (sections[name] || []).map((line) => line.trim()).filter(Boolean);
}

function parseDf(line) {
  const parts = line.split(/\s+/);
  if (parts.length < 6) return null;
  const use = Number(String(parts[4]).replace("%", ""));
  if (!Number.isFinite(use)) return null;
  return { filesystem: parts[0], size: parts[1], used: parts[2], available: parts[3], use_pct: use, mount: parts[5] };
}

function parseMemory(sections) {
  const line = body(sections, "MEM").find((row) => row.toLowerCase().startsWith("mem"));
  if (!line) return null;
  const parts = line.split(/\s+/).map(Number);
  const total = parts[1];
  const used = parts[2];
  if (!total) return null;
  return { total_mb: total, used_mb: used, used_pct: Math.round((used / total) * 100) };
}

/** Read the one probe's output into the machine state the cycle reasons about. */
export function parseGatewayProbe(text) {
  const sections = sectionsOf(text);
  // A shell banner can be printed above the process list (WSL likes to complain
  // about the terminal size). Taken blindly, the first row reported that warning as
  // the gateway's pid, uptime and user. Keep only real pids running the gateway.
  const processes = body(sections, "GATEWAY PROCESS")
    .map((row) => {
      const parts = row.split(/\s+/);
      return { pid: parts[0], uptime: parts[1], rss_kb: Number(parts[2]) || 0, user: parts[3], command: parts[4] };
    })
    .filter((row) => /^\d+$/.test(row.pid) && /claw/i.test(row.command || ''));
  const gatewayProcess = processes[0] || null;

  const bind = body(sections, "BIND").filter((row) => new RegExp(`:${GATEWAY.port}(\\s|$)`).test(row));
  // Reachability beyond this machine is decided by the LOCAL address column, never
  // by the whole row: every `ss` line ends in a peer column of 0.0.0.0:*, so a
  // whole-row test reported a loopback-only gateway as exposed to the network.
  const localAddresses = bind.map((row) => row.split(/\s+/)[3] || '').filter(Boolean);
  const loopbackOnly = localAddresses.length > 0
    && localAddresses.every((address) => /^(127\.0\.0\.1|\[::1\]|localhost)/.test(address));
  const healthRaw = body(sections, "GATEWAY HEALTH").join(" ");
  const versionMatch = body(sections, "GATEWAY VERSION").join(" ").match(/"version"\s*:\s*"([^"]+)"/);

  return {
    whoami: body(sections, "WHOAMI")[0] || null,
    host: body(sections, "HOST").join(" · ") || null,
    gateway: {
      processes,
      running: processes.length > 0,
      pid: gatewayProcess?.pid || null,
      uptime: gatewayProcess?.uptime || null,
      user: gatewayProcess?.user || null,
      version: versionMatch ? versionMatch[1] : null,
      health_raw: healthRaw.slice(0, 200) || null,
      health_ok: /"ok"\s*:\s*true/i.test(healthRaw) && /"status"\s*:\s*"live"/i.test(healthRaw),
      bind,
      local_addresses: localAddresses,
      loopback_only: loopbackOnly,
    },
    disk: body(sections, "DISK").map(parseDf).filter(Boolean),
    memory: parseMemory(sections),
    start_mechanism: body(sections, "START MECHANISM"),
    accounts: body(sections, "CLAW ACCOUNTS"),
  };
}

/** What looks wrong on the machine, in the same shape as a platform problem. */
export function machineProblems(state) {
  const problems = [];

  if (!state?.connected) {
    return [
      {
        id: "machine_bridge_unavailable",
        issue: "machine_bridge_unavailable",
        severity: "medium",
        evidence: state?.paired
          ? `The paired machine could not be read (device status: ${state.status}).`
          : "No machine is paired, so nothing on the operator's computer can be observed or repaired.",
        suggest: null,
      },
    ];
  }

  const gateway = state.gateway || {};
  if (!gateway.running) {
    problems.push({
      id: "gateway_down",
      issue: "gateway_down",
      severity: "high",
      evidence: "No openclaw-gateway process is running on the machine.",
      suggest: "machine.gateway_restart",
    });
  } else if (!gateway.health_ok) {
    problems.push({
      id: "gateway_unhealthy",
      issue: "gateway_unhealthy",
      severity: "high",
      evidence: `The gateway process is up but the health endpoint did not answer live (${gateway.health_raw || "no response"}).`,
      suggest: "machine.gateway_restart",
    });
  }

  if (gateway.running && gateway.bind?.length && !gateway.loopback_only) {
    problems.push({
      id: "gateway_exposed",
      issue: "gateway_exposed",
      severity: "high",
      evidence: `The gateway is listening beyond loopback: ${gateway.bind.join(" | ")}`,
      suggest: null,
    });
  }

  const worstDisk = Math.max(0, ...(state.disk || []).map((entry) => entry.use_pct));
  if (worstDisk >= 85) {
    problems.push({
      id: "disk_pressure",
      issue: "disk_pressure",
      severity: worstDisk >= 95 ? "high" : "medium",
      evidence: `WSL disk use is ${worstDisk}%.`,
      suggest: "machine.reclaim_temp",
    });
  }

  if (state.memory && state.memory.used_pct >= 92) {
    problems.push({
      id: "memory_pressure",
      issue: "memory_pressure",
      severity: "medium",
      evidence: `Memory use is ${state.memory.used_pct}% (${state.memory.used_mb} of ${state.memory.total_mb} MB).`,
      suggest: null,
    });
  }

  const runner = gateway.user;
  const dedicatedClawAccount = (state.accounts || []).find((row) => /^openclaw[:\s]/i.test(row));
  if (runner && dedicatedClawAccount && !/claw/i.test(runner)) {
    problems.push({
      id: "account_mismatch",
      issue: "account_mismatch",
      severity: "low",
      evidence: `The gateway runs as "${runner}" while a separate claw account exists (${dedicatedClawAccount}). The assistant is not isolated to its own account.`,
      suggest: null,
    });
  }

  return problems;
}

/** The restart is only assemblable when the start mechanism was actually found. */
export function restartCommand(state) {
  const unit = (state?.start_mechanism || [])
    .map((row) => (row.match(/([A-Za-z0-9_.@-]*claw[A-Za-z0-9_.@-]*\.service)/i) || [])[1])
    .find(Boolean);
  if (!unit) return null;
  assertUnitName(unit);
  return `wsl -d Ubuntu -- bash -lc "systemctl --user restart ${unit} || true; sleep 2; curl -s -m 6 http://${GATEWAY.host}:${GATEWAY.port}${GATEWAY.health_path}; echo; echo '## DONE'"`;
}

export function reclaimTempCommand() {
  return "wsl -d Ubuntu -- bash -lc \"find /tmp -maxdepth 1 -type f -mtime +3 -print -delete | tail -20; df -h / | tail -1; echo '## DONE'\"";
}