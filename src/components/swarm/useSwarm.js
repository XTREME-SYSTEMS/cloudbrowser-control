import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { startSwarmRun, pollSwarmRun, synthesizeRun } from './swarmActions';
import { DEFAULT_AGENTS } from './catalog';

export function useSwarm() {
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [synthesis, setSynthesis] = useState('');
  const pollRef = useRef(null);

  const loadRuns = useCallback(async () => {
    try {
      const page = await base44.entities.SwarmRun.filter({}, { sort: '-created_date', limit: 50 });
      setRuns(page.items || []);
    } catch { setRuns([]); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const selectRun = useCallback(async (runId) => {
    if (!runId) { setActiveRun(null); setTasks([]); setSynthesis(''); return; }
    setBusy(false);
    const { run, tasks } = await pollSwarmRun(runId);
    setActiveRun(run);
    setTasks(tasks);
    setSynthesis(run.synthesis || '');
    if (run.status === 'running') {
      pollRef.current = setInterval(async () => {
        const { run: r, tasks: t } = await pollSwarmRun(runId);
        setActiveRun(r);
        setTasks(t);
        if (r.status !== 'running') {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 3000);
    }
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const launch = useCallback(async (prompt, agentIds) => {
    setBusy(true);
    try {
      const { run } = await startSwarmRun({ prompt, agentIds });
      await loadRuns();
      await selectRun(run.id);
    } finally { setBusy(false); }
  }, [loadRuns, selectRun]);

  const synthesize = useCallback(async () => {
    if (!activeRun) return;
    setBusy(true);
    try {
      const result = await synthesizeRun(activeRun.id);
      setSynthesis(typeof result === 'string' ? result : JSON.stringify(result));
      await loadRuns();
      const { run } = await pollSwarmRun(activeRun.id);
      setActiveRun(run);
    } finally { setBusy(false); }
  }, [activeRun, loadRuns]);

  return { runs, activeRun, tasks, loading, busy, synthesis, launch, synthesize, selectRun, loadRuns };
}