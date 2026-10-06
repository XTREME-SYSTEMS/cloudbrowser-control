import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function ParametersDialog({ open, onClose, params, onChange }) {
  const [local, setLocal] = useState(params || { temperature: 0.7, maxTokens: 2000, parallel: true });
  if (!open) return null;

  const update = (k, v) => setLocal({ ...local, [k]: v });

  const save = () => { onChange(local); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4" />
          <span className="font-semibold">Parameters</span>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Temperature: {local.temperature}</Label>
            <input type="range" min="0" max="1" step="0.1" value={local.temperature} onChange={e => update('temperature', Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div>
            <Label className="text-xs">Max Tokens: {local.maxTokens}</Label>
            <input type="range" min="500" max="8000" step="500" value={local.maxTokens} onChange={e => update('maxTokens', Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Parallel Execution</Label>
            <button onClick={() => update('parallel', !local.parallel)} className={`w-10 h-6 rounded-full transition-colors ${local.parallel ? 'bg-primary' : 'bg-secondary'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${local.parallel ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}