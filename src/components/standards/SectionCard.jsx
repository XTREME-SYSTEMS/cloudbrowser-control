import React from "react";

export default function SectionCard({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 md:p-7">
      <div className="mb-5">
        {eyebrow && (
          <p className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-primary/80 mb-1.5">
            {eyebrow}
          </p>
        )}
        <h2 className="font-heading font-bold text-xl md:text-2xl">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl leading-relaxed">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}