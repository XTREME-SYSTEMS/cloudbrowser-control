import { Image } from '@/components/ui/image';

export default function BrandLockup({ subtitle, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0 rounded-md" />
      <div className="min-w-0">
        <span className={`${compact ? 'text-lg' : 'text-xl'} block truncate font-heading font-bold uppercase tracking-wide text-foreground`}>Xtreme Cloud Browser</span>
        {subtitle && <span className="block font-mono text-[9px] uppercase tracking-widest text-primary">{subtitle}</span>}
      </div>
    </div>
  );
}