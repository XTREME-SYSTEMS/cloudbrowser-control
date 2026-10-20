import React from "react";

/**
 * The frame around one interface option. Each option is shown in full rather
 * than described, so the choice can be made by looking at it.
 */
export default function OptionShell({ index, name, subtitle, tone, bestFor, swatches, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {index}
          </span>
          <div>
            <h2 className="font-heading text-lg font-bold">{name}</h2>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {swatches.map((hex) => (
              <span
                key={hex}
                className="h-4 w-4 rounded-sm border border-black/10"
                style={{ background: hex }}
              />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{tone}</span>
        </div>
      </header>

      {children}

      <footer className="border-t border-border bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Best for:</span> {bestFor}
      </footer>
    </section>
  );
}