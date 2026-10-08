import React, { useState } from 'react';
import { Users, Sliders, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AgentLibrary from './AgentLibrary';

export default function WorkspaceHeader({ agentIds, onToggleAgent, onOpenParams }) {
  const [libOpen, setLibOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{agentIds.length} agents</span>
        <Button size="sm" variant="ghost" onClick={() => setLibOpen(true)} className="gap-1.5 ml-1">
          <Library className="h-3.5 w-3.5" /> Library
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenParams} className="gap-1.5 ml-auto">
          <Sliders className="h-3.5 w-3.5" /> Parameters
        </Button>
      </div>
      {libOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-80 h-full bg-card border-r border-border shadow-xl">
            <AgentLibrary selected={agentIds} onToggle={onToggleAgent} onClose={() => setLibOpen(false)} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setLibOpen(false)} />
        </div>
      )}
    </>
  );
}