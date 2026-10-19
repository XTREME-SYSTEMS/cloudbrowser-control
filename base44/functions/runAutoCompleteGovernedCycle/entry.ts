import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

// Canonical scheduler entrypoint.
// Schedulers call this wrapper, not runAutoCompleteContinuousCycle directly.
// It guarantees that every scheduled control-plane cycle is followed by the
// independent-repair integrity postcondition before the workflow completes.
export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const started = Date.now();

  try {
    let cycle: any;
    try {
      const cycleResponse = await base44.asServiceRole.functions.invoke("runAutoCompleteContinuousCycle", body);
      cycle = cycleResponse?.data ?? cycleResponse;
    } catch (error: any) {
      cycle = { ok: false, error: error?.message || String(error) };
    }

    let repairIntegrity: any;
    try {
      const integrityResponse = await base44.asServiceRole.functions.invoke("enforceAutoCompleteRepairIntegrity", {
        trigger: body?.trigger || "governed_wrapper",
        source_cycle_id: cycle?.cycle_id || null,
      });
      repairIntegrity = integrityResponse?.data ?? integrityResponse;
    } catch (error: any) {
      repairIntegrity = { ok: false, error: error?.message || String(error) };
    }

    const ok = cycle?.ok === true && repairIntegrity?.ok === true;
    return Response.json({
      ok,
      trigger: body?.trigger || "governed_wrapper",
      cycle,
      repair_integrity: repairIntegrity,
      duration_ms: Date.now() - started,
      protected_actions_remain_gated: true,
    }, { status: ok ? 200 : 500 });
  } catch (error: any) {
    return Response.json({
      ok: false,
      error: error?.message || String(error),
      duration_ms: Date.now() - started,
    }, { status: 500 });
  }
}
