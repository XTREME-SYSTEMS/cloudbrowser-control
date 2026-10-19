import React from 'react';

export default function AgentMessages({ task }) {
  const content = task.output || task.result_summary || task.error || task.error_message;
  if (!content) {
    return (
      <div className="px-3 py-4 text-xs text-muted-foreground">
        {task.status === 'running' ? 'Agent is working...' : 'No output yet.'}
      </div>
    );
  }
  return (
    <div className="px-3 py-3 text-sm text-foreground/90 whitespace-pre-wrap break-words max-h-64 overflow-auto">
      {content}
    </div>
  );
}