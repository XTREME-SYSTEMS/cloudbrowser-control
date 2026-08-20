import { runHeartbeat } from '../src/heartbeat.js';

export async function cloudBrowserEngineeringWorkflow(input) {
  'use workflow';
  return heartbeatStep(input);
}

async function heartbeatStep(input) {
  'use step';
  return runHeartbeat(input);
}
