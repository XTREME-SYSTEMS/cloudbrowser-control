import React from 'react';
import { Sparkles } from 'lucide-react';
import Brand from './Brand';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

export default function Sidebar({ runs, activeRunId, onSelectRun, onNewRun }) {
  const navigate = useNavigate();
  const handleLogout = async () => { await base44.auth.logout(); window.location.href = '/login'; };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4 border-b border-sidebar-border">
        <Brand />
      </div>
      <div className="p-3">
        <button onClick={onNewRun} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">
          <Sparkles className="h-4 w-4" /> New Swarm
        </button>
      </div>
      <div className="px-3 pb-1">
        <span className="text-xs uppercase tracking-wider text-muted-foreground/70 px-1">Recent Runs</span>
      </div>
      <div className="flex-1 overflow-auto px-2 space-y-0.5">
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center p-4">No runs yet</p>
        ) : runs.map(run => (
          <button key={run.id} onClick={() => onSelectRun(run.id)} className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${activeRunId === run.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
            <p className="text-sm truncate">{run.prompt}</p>
            <p className="text-xs text-muted-foreground capitalize">{run.status} · {run.completed_count}/{run.task_count} agents</p>
          </button>
        ))}
      </div>
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button onClick={() => navigate('/idea-engine')} className="w-full text-left rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">Idea Engine</button>
        <button onClick={handleLogout} className="w-full text-left rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">Sign out</button>
      </div>
    </div>
  );
}