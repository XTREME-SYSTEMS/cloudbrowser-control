import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SynthesisButton({ onSynthesize, disabled, busy, ready }) {
  return (
    <Button onClick={onSynthesize} disabled={disabled || busy || !ready} className="gap-2 w-full">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {busy ? 'Synthesizing...' : 'Synthesize Results'}
    </Button>
  );
}