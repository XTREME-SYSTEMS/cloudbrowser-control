import { secrets } from "base44:runtime";
import { getEngineUrls, setEngineClient } from "./engineClient.ts";
import { probeEngine, deriveLabel } from "./engineProbe.ts";
import { getProjectStatus } from "./railwayClient.ts";
import { deviceStatus, runDeviceCommand } from "./desktopCommanderBridge.ts";
import { gatewayProbeCommand, parseGatewayProbe, machineProblems } from "./openClawMachine.ts";

// Observation and diagnosis for one OpenClaw cycle: read both sides, then turn
// readings into problems and the repairs that answer them. Nothing here decides
// whether a repair may run — that is the guardian's job, and it happens next.

/** The engine fleet and the Railway project, read the way the healers read them. */
export async function observeFleet(base44) {
  setEngineClient(base44);

  const engineKey = secrets.get("ENGINE_API_KEY");
  const urls = engineKey ? await getEngineUrls() : [];
  const probes = urls.length ? await Promise.all(urls.map((url, index) => probeEngine(url, engineKey))) : [];
  probes.forEach((probe, index) => {
    probe.engine_label = deriveLabel(probe.engine_url, index);
  });

  const engines = probes.map((probe) => ({
    url: probe.engine_url,
    label: probe.engine_label,
    serving: Boolean(probe.ok),
    status: probe.status,
    ready: probe.readiness?.ready ?? null,
    error: probe.error_message || null,
  }));

  const railway = { ok: false, services: 0, failed: [], error: null };
  try {
    const status = await getProjectStatus();
    const services = status.services || [];
    railway.ok = true;
    railway.services = services.length;
    railway.failed = services
      .filter((service) => (service.instances || []).some((instance) => instance.latestDeployment?.status === "FAILED"))
      .map((service) => service.name);
  } catch (error) {
    railway.error = error.message;
  }

  return { engines, railway, engine_key_configured: Boolean(engineKey) };
}

/** The paired machine: one read-only probe round trip. */
export async function observeMachine(base44) {
  const status = await deviceStatus(base44);
  if (!status.ready) {
    return { connected: false, paired: status.paired, status: status.status, suggested_device: null, problems: null, raw: null };
  }

  const { text, device_name, partial } = await runDeviceCommand(base44, gatewayProbeCommand(), { timeoutMs: 30000 });
  const state = parseGatewayProbe(text);
  return {
    connected: true,
    paired: true,
    status: status.status,
    device: device_name || status.device_name || null,
    partial_reading: partial,
    ...state,
  };
}

function uniqueBy(list, key) {
  const seen = new Set();
  return list.filter((item) => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
}

/**
 * Turn readings into problems and the repairs that answer them. A repair is
 * proposed once per target kind, never once per broken instance — a fleet-wide
 * repair that is proposed three times would be approved and run three times.
 */
export function diagnose({ fleet, machine }) {
  const problems = [];
  const proposals = [];

  const engines = fleet?.engines || [];
  const notServing = engines.filter((engine) => !engine.serving);

  if (notServing.length) {
    problems.push({
      id: "engines_not_serving",
      issue: "engines_not_serving",
      severity: notServing.length === engines.length ? "high" : "medium",
      evidence: notServing.map((engine) => `${engine.label}: ${engine.status}${engine.error ? ` (${engine.error})` : ""}`).join("; "),
      suggest: "platform.autoheal",
    });
    proposals.push({
      action: "platform.autoheal",
      target: "engine fleet",
      proposed_because: `${notServing.length} of ${engines.length} engines are not serving browser work.`,
    });
  }

  if (fleet?.railway?.failed?.length) {
    problems.push({
      id: "railway_failed_deployments",
      issue: "railway_failed_deployments",
      severity: "medium",
      evidence: `Failed deployments: ${fleet.railway.failed.join(", ")}`,
      suggest: "platform.autoheal",
    });
    proposals.push({
      action: "platform.autoheal",
      target: "railway services",
      proposed_because: `${fleet.railway.failed.length} Railway service(s) have a failed deployment.`,
    });
  }

  if (fleet?.railway?.error) {
    problems.push({
      id: "railway_unreadable",
      issue: "railway_unreadable",
      severity: "medium",
      evidence: `The Railway project could not be read: ${fleet.railway.error}`,
      suggest: null,
    });
  }

  const machineFindings = machine?.problems !== null && machine?.problems !== undefined
    ? machine.problems
    : machineProblems(machine);
  for (const finding of machineFindings) {
    problems.push(finding);
    if (finding.suggest) {
      proposals.push({
        action: finding.suggest,
        target: machine?.device || "paired machine",
        proposed_because: finding.evidence,
      });
    }
  }

  return { problems, proposals: uniqueBy(proposals, "action") };
}

/** What the fleet looks like after a repair, for the validator to compare. */
export async function reReadEngines(base44) {
  return observeFleet(base44);
}