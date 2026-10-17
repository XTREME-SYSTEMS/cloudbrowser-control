import crypto from 'node:crypto';
import { start } from 'workflow/api';
import { cloudBrowserEngineeringWorkflow } from '../../workflows/cloudbrowser-engineering.js';

const EXPECTED_SCHEDULE = '*/5 * * * *';

export default async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'POST') return response.status(405).json({ ok: false, error: 'method_not_allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.authorization !== `Bearer ${secret}`) return response.status(401).json({ ok: false, error: 'unauthorized' });
  const schedule = request.headers['x-vercel-cron-schedule'];
  if (schedule && schedule !== EXPECTED_SCHEDULE) return response.status(400).json({ ok: false, error: 'unexpected_schedule', schedule });
  const run = await start(cloudBrowserEngineeringWorkflow, [{ triggeredAt: new Date().toISOString(), owner: `vercel-cron:${crypto.randomUUID()}` }]);
  return response.status(202).json({ ok: true, workflow_run_id: run?.runId || run?.id || null, schedule: EXPECTED_SCHEDULE });
}
