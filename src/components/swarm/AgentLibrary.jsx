import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AGENT_CATALOG, AGENT_GROUPS } from './catalog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AgentLibrary({ selected, onToggle, onClose }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');

  const filtered = AGENT_CATALOG.filter(a => {
    if (group !== 'all' && a.group !== group) return false;
    if (query && !a.name.toLowerCase().includes(query.toLowerCase()) && !a.description.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm">Agent Library</span>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agents..." className="pl-9 h-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setGroup('all')} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${group === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>All</button>
          {AGENT_GROUPS.map(g => (
            <button key={g.id} onClick={() => setGroup(g.id)} className={`text-xs px-2.5 py-1 rounded-full transition-colors ${group === g.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>{g.label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {filtered.map(agent => {
          const isOn = selected.includes(agent.id);
          return (
            <button key={agent.id} onClick={() => onToggle(agent.id)} className={`w-full text-left rounded-lg border p-3 transition-colors ${isOn ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{agent.name}</span>
                {isOn && <span className="ml-auto text-xs text-primary font-medium">ON</span>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{agent.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}