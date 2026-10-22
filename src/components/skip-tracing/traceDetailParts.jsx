import React from "react";
import { cn } from "@/lib/utils";

/**
 * Small presentational pieces shared by the trace detail view.
 *
 * The detail view's whole job is completeness: every field a stored trace
 * carries has to reach the screen, including the ones nothing else reads
 * (authorization, validation, property_data, the raw search record). These
 * helpers keep that rendering in one place so a section cannot quietly drop a
 * value by formatting it differently from its neighbours.
 */

/** The one-line name of a search, taken from whichever target it holds. */
export function traceHeadline(trace) {
  if (!trace) return "";
  return (
    trace.target_property_address ||
    trace.target_owner_name ||
    trace.target_phone ||
    trace.target_email ||
    trace.target_company ||
    "Search with no target recorded"
  );
}

export function when(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

/** A titled block. Renders nothing at all when it has no children. */
export function Section({ icon: Icon, title, count, children, className }) {
  if (children === null || children === undefined) return null;
  return (
    <section className={cn("space-y-2", className)}>
      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {title}
        {typeof count === "number" && <span className="text-muted-foreground/70">({count})</span>}
      </h4>
      {children}
    </section>
  );
}

/** One label/value pair. An absent value reads as an em dash, never as blank. */
export function Field({ label, value, mono = false, href = null, className }) {
  const empty = value === null || value === undefined || value === "";
  const display = empty ? "—" : String(value);
  const external = href && /^https?:/i.test(href);
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {!empty && href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="break-words text-sm text-primary underline-offset-2 hover:underline"
        >
          {display}
        </a>
      ) : (
        <p className={cn("break-words text-sm", mono && "font-mono", empty && "text-muted-foreground")}>{display}</p>
      )}
    </div>
  );
}

/**
 * A wrapped row of short labels, used for source and method lists.
 *
 * A single trace can record several hundred sources, so the list opens capped
 * and expands on request. Nothing is dropped: the count is always stated and
 * the remainder is one click away.
 */
export function Chips({ items, empty = "None recorded", limit = 40 }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!items || items.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;

  const capped = !expanded && items.length > limit;
  const shown = capped ? items.slice(0, limit) : items;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((item, i) => {
        const text = typeof item === "string" ? item : JSON.stringify(item);
        return (
          <span
            key={`${text}-${i}`}
            title={text}
            className="max-w-[320px] truncate rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px]"
          >
            {text}
          </span>
        );
      })}
      {capped && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded border border-primary/40 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          show all {items.length}
        </button>
      )}
    </div>
  );
}

export function RecordCard({ children }) {
  return <div className="rounded-md border border-border bg-muted/30 p-2.5">{children}</div>;
}

const isPrimitive = (v) => v === null || typeof v !== "object";

/**
 * Renders an arbitrary stored object without hiding anything: primitives show
 * inline, nested objects and arrays stay collapsed until asked for, and long
 * text gets its own scroll box rather than being cut off.
 */
export function AuditObject({ value }) {
  if (value === null || value === undefined) {
    return <p className="text-xs text-muted-foreground">Not recorded</p>;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground">Empty</p>;

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => {
        const label = key.replace(/_/g, " ");
        if (isPrimitive(val)) {
          const text = val === null || val === "" ? "—" : String(val);
          return (
            <div key={key} className="grid grid-cols-1 gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              {text.length > 240 ? (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 text-[11px]">
                  {text}
                </pre>
              ) : (
                <p className="break-words text-sm">{text}</p>
              )}
            </div>
          );
        }
        const size = Array.isArray(val)
          ? `${val.length} ${val.length === 1 ? "entry" : "entries"}`
          : `${Object.keys(val).length} fields`;
        return (
          <details key={key} className="rounded border border-border bg-muted/20">
            <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-medium">
              {label} <span className="text-muted-foreground">— {size}</span>
            </summary>
            <pre className="max-h-56 overflow-auto border-t border-border p-2 text-[11px]">
              {JSON.stringify(val, null, 2)}
            </pre>
          </details>
        );
      })}
    </div>
  );
}