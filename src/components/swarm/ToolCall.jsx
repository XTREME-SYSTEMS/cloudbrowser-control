import React from 'react';
import { Terminal } from 'lucide-react';

export default function ToolCall({ call }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 my-1.5">
      <div className="flex items-center gap-1.5 text-xs">
        <Terminal className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-muted-foreground">{call.name}</span>
        <span className={`ml-auto ${call.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}`}>{call.status}</span>
      </div>
    </div>
  );
}