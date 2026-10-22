import React, { useState } from "react";
import { Search, Loader2, ChevronRight, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/investigator/StatusPill";

/**
 * The review queue. Every row's three labels come from the shared delivery gate
 * decision, so a case cannot look more finished here than it is in a spreadsheet
 * or in the report the gate would refuse to certify.
 */
export default function CaseQueue({ cases = [], counts, selectedId, onSelect, onSearch, search = "", loading, filter = "all", onFilter }) {
  const [term, setTerm] = useState(search);

  const submit = (e) => {
    e.preventDefault();
    onSearch(term.trim());
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, case ref or location"
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </form>

      {counts && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat
            label="Cases"
            value={counts.total}
            active={filter === "all"}
            onClick={() => onFilter("all")}
          />
          <Stat
            label="Deliverable"
            value={counts.deliverable}
            tone="text-emerald-600 dark:text-emerald-400"
            active={filter === "deliverable"}
            onClick={() => onFilter("deliverable")}
          />
          <Stat
            label="Unassigned"
            value={counts.unassigned}
            tone="text-amber-600 dark:text-amber-400"
            active={filter === "unassigned"}
            onClick={() => onFilter("unassigned")}
          />
        </div>
      )}

      <div className="space-y-1.5 max-h-[52vh] overflow-y-auto xa-scroll pr-1">
        {cases.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground px-1 py-6 text-center">
            No cases matched. Every case you have run appears here.
          </p>
        )}
        {cases.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
              selectedId === c.id
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-display font-semibold truncate">{c.deceased_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {c.case_reference || "no case reference"}
                  {c.death_location ? ` · ${c.death_location}` : ""}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <StatusPill label={c.certification_status} />
              <StatusPill label={c.evidence_status} />
              <StatusPill label={c.investigator_approval} />
              {c.no_recorded_basis && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                  <Fingerprint className="w-3 h-3" /> no recorded basis
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {c.assigned_to_email ? `Assigned: ${c.assigned_to_email}` : "Unassigned"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Each tile narrows the queue to exactly the cases its own number counted. */
function Stat({ label, value, tone = "", active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2 py-1.5 text-center transition-all hover:border-primary/40 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className={`text-lg font-display font-bold ${tone || ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </button>
  );
}