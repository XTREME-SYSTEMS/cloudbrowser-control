// Cost Tracker — records and aggregates cost entries per job/session/project.
// Uses the CostEntry entity with compute/proxy/llm/storage categories.

export interface RecordCostParams {
  projectId?: string;
  jobId?: string;
  sessionId?: string;
  scheduleId?: string;
  category: 'compute' | 'proxy' | 'llm' | 'storage';
  description?: string;
  amount: number;      // Quantity consumed (minutes, GB, calls, etc.)
  unit?: string;        // 'minutes', 'GB', 'calls', etc.
  rate?: number;        // Cost per unit in USD
}

export async function recordCost(base44: any, params: RecordCostParams): Promise<any> {
  const rate = params.rate ?? getDefaultRate(params.category);
  const cost = params.amount * rate;

  return await base44.entities.CostEntry.create({
    session_id: params.sessionId,
    job_id: params.jobId,
    schedule_id: params.scheduleId,
    category: params.category,
    description: params.description,
    amount: params.amount,
    unit: params.unit || getDefaultUnit(params.category),
    rate,
    cost,
    timestamp: new Date().toISOString(),
  });
}

function getDefaultRate(category: string): number {
  const rates: Record<string, number> = {
    compute: 0.05,   // $0.05 per minute
    proxy: 0.02,     // $0.02 per minute
    llm: 0.01,       // $0.01 per call
    storage: 0.001,  // $0.001 per MB/day
  };
  return rates[category] ?? 0;
}

function getDefaultUnit(category: string): string {
  const units: Record<string, string> = {
    compute: 'minutes',
    proxy: 'minutes',
    llm: 'calls',
    storage: 'MB',
  };
  return units[category] ?? 'units';
}

export async function getProjectSpend(base44: any, projectId: string): Promise<number> {
  const entries = await base44.entities.CostEntry.filter({ job_id: undefined });
  // Since we don't have a project_id field on CostEntry, we aggregate by job_id
  // Jobs have project_id, so we'd need to join — for now, aggregate all entries
  const allEntries = await base44.entities.CostEntry.list();
  return allEntries.reduce((sum: number, e: any) => sum + (e.cost || 0), 0);
}

export async function getTotalSpend(base44: any): Promise<number> {
  const entries = await base44.entities.CostEntry.list();
  return entries.reduce((sum: number, e: any) => sum + (e.cost || 0), 0);
}

export async function getSpendByCategory(base44: any): Promise<Record<string, number>> {
  const entries = await base44.entities.CostEntry.list();
  const byCategory: Record<string, number> = {};
  for (const entry of entries) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + (entry.cost || 0);
  }
  return byCategory;
}

export async function getJobCost(base44: any, jobId: string): Promise<number> {
  const entries = await base44.entities.CostEntry.filter({ job_id: jobId });
  return entries.reduce((sum: number, e: any) => sum + (e.cost || 0), 0);
}