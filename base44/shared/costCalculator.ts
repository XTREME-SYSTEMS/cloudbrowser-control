export const DEFAULT_RATES = {
  compute_rate_per_min: 0.005,
  proxy_rate_per_gb: 2.0,
  llm_rate_per_call: 0.02,
  storage_rate_per_gb_month: 0.02,
  currency: "USD",
  monthly_budget: 0,
  alert_threshold_pct: 80,
};

export async function getRates(base44) {
  try {
    const settings = await base44.entities.CostSettings.list("-created_date", 1);
    if (settings && settings.length > 0) {
      return { ...DEFAULT_RATES, ...settings[0] };
    }
  } catch (e) {}
  return DEFAULT_RATES;
}

export async function calculateJobCost(base44, jobId) {
  const job = await base44.entities.Job.get(jobId);
  if (!job) throw new Error("Job not found");

  const rates = await getRates(base44);
  const entries = [];

  // Session duration
  let sessionDurationMin = 0;
  let sessionEntityId = job.session_id;
  if (sessionEntityId) {
    try {
      const session = await base44.entities.Session.get(sessionEntityId);
      if (session?.started_at) {
        const endTime = session.ended_at ? new Date(session.ended_at) : new Date();
        sessionDurationMin = Math.max(0, (endTime - new Date(session.started_at)) / 60000);
      }
    } catch (e) {}
  }

  // Compute cost
  if (sessionDurationMin > 0) {
    entries.push({
      job_id: jobId,
      session_id: sessionEntityId,
      category: "compute",
      description: `Browser session: ${sessionDurationMin.toFixed(1)} min`,
      amount: parseFloat(sessionDurationMin.toFixed(4)),
      unit: "minutes",
      rate: rates.compute_rate_per_min,
      cost: parseFloat((sessionDurationMin * rates.compute_rate_per_min).toFixed(6)),
      timestamp: new Date().toISOString(),
    });
  }

  // Get steps
  const steps = await base44.entities.Step.filter({ job_id: jobId });

  // LLM cost
  const llmCount = steps.filter((s) => s.action_type === "ai_extract").length;
  if (llmCount > 0) {
    entries.push({
      job_id: jobId,
      category: "llm",
      description: `${llmCount} AI extraction call(s)`,
      amount: llmCount,
      unit: "calls",
      rate: rates.llm_rate_per_call,
      cost: parseFloat((llmCount * rates.llm_rate_per_call).toFixed(6)),
      timestamp: new Date().toISOString(),
    });
  }

  // Storage cost (screenshots + PDFs)
  const screenshots = await base44.entities.Screenshot.filter({ job_id: jobId });
  const pdfResults = await base44.entities.Result.filter({ job_id: jobId, data_type: "pdf_url" });
  const storageItems = screenshots.length + pdfResults.length;
  if (storageItems > 0) {
    const estimatedStorageMB = storageItems * 0.5;
    const storageGB = estimatedStorageMB / 1024;
    entries.push({
      job_id: jobId,
      category: "storage",
      description: `${storageItems} files (~${estimatedStorageMB.toFixed(1)} MB)`,
      amount: parseFloat(storageGB.toFixed(4)),
      unit: "GB",
      rate: rates.storage_rate_per_gb_month,
      cost: parseFloat((storageGB * rates.storage_rate_per_gb_month).toFixed(6)),
      timestamp: new Date().toISOString(),
    });
  }

  // Proxy cost (estimate bandwidth based on duration)
  const hasProxy = job.session_config?.proxyId || job.session_config?.proxy;
  if (hasProxy && sessionDurationMin > 0) {
    const estimatedBandwidthMB = sessionDurationMin * 2;
    const bandwidthGB = estimatedBandwidthMB / 1024;
    entries.push({
      job_id: jobId,
      session_id: sessionEntityId,
      category: "proxy",
      description: `Proxy bandwidth: ~${estimatedBandwidthMB.toFixed(1)} MB`,
      amount: parseFloat(bandwidthGB.toFixed(4)),
      unit: "GB",
      rate: rates.proxy_rate_per_gb,
      cost: parseFloat((bandwidthGB * rates.proxy_rate_per_gb).toFixed(6)),
      timestamp: new Date().toISOString(),
    });
  }

  // Delete old cost entries for this job (recalculation)
  await base44.entities.CostEntry.deleteMany({ job_id: jobId });

  // Create new entries
  if (entries.length > 0) {
    await base44.entities.CostEntry.bulkCreate(entries);
  }

  const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
  return { totalCost: parseFloat(totalCost.toFixed(6)), entries, rates };
}

export function estimateJobCost(steps, sessionConfig, rates) {
  const r = { ...DEFAULT_RATES, ...rates };
  const estimates = [];

  const stepCount = steps.length;
  const estimatedDurationSec = 10 + stepCount * 5;
  const estimatedDurationMin = estimatedDurationSec / 60;
  const computeCost = estimatedDurationMin * r.compute_rate_per_min;
  estimates.push({
    category: "compute",
    description: `Estimated ${estimatedDurationMin.toFixed(1)} min (${stepCount} steps)`,
    cost: parseFloat(computeCost.toFixed(6)),
    amount: parseFloat(estimatedDurationMin.toFixed(4)),
    unit: "minutes",
    rate: r.compute_rate_per_min,
  });

  const llmCount = steps.filter((s) => s.action_type === "ai_extract").length;
  if (llmCount > 0) {
    estimates.push({
      category: "llm",
      description: `${llmCount} AI extraction call(s)`,
      cost: parseFloat((llmCount * r.llm_rate_per_call).toFixed(6)),
      amount: llmCount,
      unit: "calls",
      rate: r.llm_rate_per_call,
    });
  }

  const screenshotCount = steps.filter((s) => s.action_type === "screenshot").length;
  const pdfCount = steps.filter((s) => s.action_type === "pdf").length;
  const storageItems = screenshotCount + pdfCount;
  if (storageItems > 0) {
    const storageMB = storageItems * 0.5;
    const storageGB = storageMB / 1024;
    estimates.push({
      category: "storage",
      description: `${storageItems} files (~${storageMB.toFixed(1)} MB)`,
      cost: parseFloat((storageGB * r.storage_rate_per_gb_month).toFixed(6)),
      amount: parseFloat(storageGB.toFixed(4)),
      unit: "GB",
      rate: r.storage_rate_per_gb_month,
    });
  }

  if (sessionConfig?.proxyId || sessionConfig?.proxy) {
    const bandwidthMB = estimatedDurationMin * 2;
    const bandwidthGB = bandwidthMB / 1024;
    estimates.push({
      category: "proxy",
      description: `~${bandwidthMB.toFixed(1)} MB bandwidth`,
      cost: parseFloat((bandwidthGB * r.proxy_rate_per_gb).toFixed(6)),
      amount: parseFloat(bandwidthGB.toFixed(4)),
      unit: "GB",
      rate: r.proxy_rate_per_gb,
    });
  }

  const totalCost = estimates.reduce((sum, e) => sum + e.cost, 0);
  return {
    totalCost: parseFloat(totalCost.toFixed(6)),
    estimates,
    estimatedDurationSec,
  };
}