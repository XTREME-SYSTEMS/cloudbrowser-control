import React from "react";
import { Users, GitMerge, AlertTriangle, HelpCircle, Ban } from "lucide-react";

/**
 * The decisions the graph cannot make for itself: identities that were merged,
 * relationship terms the engine refuses to infer, competing evidence, and the
 * people still carried only as leads.
 *
 * None of this is resolved automatically. Each row is a question placed in front
 * of a person, which is the only place it can honestly be answered.
 */
export default function RelationshipReviewPanel({ kinship }) {
  if (!kinship) return <Empty text="No relationship data is available for this case." />;

  const unknowns = kinship.unknown_relatives || [];
  const conflicts = kinship.conflicts || [];
  const merged = kinship.merged_identities || [];
  const candidates = kinship.candidates || [];
  const branches = kinship.deceased_branches || [];

  const nothing =
    unknowns.length === 0 && conflicts.length === 0 && merged.length === 0 && candidates.length === 0;

  return (
    <div className="space-y-3">
      <Section
        icon={AlertTriangle}
        tone="text-amber-600 dark:text-amber-400"
        title={`Competing evidence (${conflicts.length})`}
        hint="Records that disagree. A reviewer decides which holds, or records that neither does."
        items={conflicts}
        render={(c) => `${c.relative_name || c.person_id || "A claim"} — ${c.note || c.detail || "conflicting records recorded"}`}
      />
      <Section
        icon={GitMerge}
        tone="text-primary"
        title={`Merged identities (${merged.length})`}
        hint="Names the engine treated as one person. A wrong merge invents a relationship."
        items={merged}
        render={(m) => `${(m.names || []).join(" / ") || m.person_id} — merged on ${m.basis || "recorded identity evidence"}`}
      />
      <Section
        icon={HelpCircle}
        tone="text-amber-600 dark:text-amber-400"
        title={`Unresolved relationships (${unknowns.length})`}
        hint="Terms such as step-son or half-brother are different relationships in succession, so they stay unresolved rather than being collapsed."
        items={unknowns}
        render={(u) => `${u.relative_name || "Unnamed"} — recorded as "${u.raw_relation || u.relation || "unknown"}"`}
      />
      <Section
        icon={Users}
        tone="text-emerald-600 dark:text-emerald-400"
        title={`Research leads (${candidates.length})`}
        hint="Living candidates on established branches. A lead is not a legal heir and this system never declares one."
        items={candidates}
        render={(c) => `${c.name || c.person_id} — ${String(c.relation || c.relationship || "relationship").replace(/_/g, " ")}`}
      />
      <Section
        icon={Ban}
        tone="text-muted-foreground"
        title={`Predeceased branches (${branches.length})`}
        hint="Relatives who died before the decedent. Their descendants may stand in their place; the branch is recorded so that question can be asked."
        items={branches}
        render={(b) => `${b.name || b.person_id} — ${b.basis || "recorded as not living"}`}
      />

      {nothing && (
        <Empty text="No identity conflicts, merges or unresolved relationships are recorded for this case." />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, hint, items, render, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${tone || "text-muted-foreground"}`} />
        <h3 className="text-sm font-display font-semibold">{title}</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2">{hint}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">None recorded.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-foreground/90 border-l-2 border-border pl-2.5 py-0.5">
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}