import React from 'react';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getAgentById } from './catalog';
import AgentMessages from './AgentMessages';

const STATUS_ICON = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
};

const STATUS_COLOR = {
  pending: 'text-muted-foreground',
  running: 'text-blue-400',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
};

export default function AgentCard({ task }) {
  const agent = getAgentById(task.agent_name);
  const Icon = STATUS_ICON[task.status] || Clock;
  const color = STATUS_COLOR[task.status] || 'text-muted-foreground';

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary/30">
        <Icon className={`h-4 w-4 shrink-0 ${color} ${task.status === 'running' ? 'animate-spin' : ''}`} />
        <span className="font-semibold text-sm truncate">{agent?.name || task.agent_name}</span>
        <span className="text-xs text-muted-foreground ml-auto uppercase tracking-wide">{task.status}</span>
      </div>
      <AgentMessages task={task} />
    </div>
  );
}