import { Network } from 'lucide-react';
export default function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
        <Network size={19} />
      </div>
      <span className="font-semibold text-lg tracking-tight">swarm<span className="text-primary">.</span></span>
      <span className="ml-1 rounded border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">BETA</span>
    </div>
  );
}