import React from 'react';
import { Activity, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function RuntimePanel({ run, tasks }) {
  if (!run) return null;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const running = tasks.filter(t => t.status === 'running').length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Runtime</span>
        <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wide">{run.status}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-lg font-bold">{completed}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><CheckCircle className="h-2.5 w-2.5" /> Done</p>
        </div>
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-lg font-bold">{running}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-2.5 w-2.5" /> Running</p>
        </div>
        <div className="rounded-md bg-secondary/40 p-2 text-center">
          <p className="text-lg font-bold">{failed}</p>
          <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><XCircle className="h-2.5 w-2.5" /> Failed</p>
        </div>
      </div>
    </div>
  );
}