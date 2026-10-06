import { Image } from '@/components/ui/image';

export default function BrandLockup({ subtitle, compact = false }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/b9a9faf73_logo.png" alt="" fittingType="fit" className="h-9 w-9 shrink-0" />
      <div className="min-w-0">
        <span className={`${compact ? 'text-lg' : 'text-xl'} block truncate font-heading font-bold uppercase tracking-wide text-foreground`}>Xtreme Cloud Browser</span>
        {subtitle && <span className="block font-mono text-[9px] uppercase tracking-widest text-primary">{subtitle}</span>}
      </div>
    </div>
  );
}