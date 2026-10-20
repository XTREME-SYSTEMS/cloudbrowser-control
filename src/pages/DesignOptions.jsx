import React from "react";
import OptionShell from "@/components/design-options/OptionShell";
import DocketRailMock from "@/components/design-options/DocketRailMock";
import WaterfallGridMock from "@/components/design-options/WaterfallGridMock";
import TriageBoardMock from "@/components/design-options/TriageBoardMock";
import ComplianceStepsMock from "@/components/design-options/ComplianceStepsMock";
import QueryDeskMock from "@/components/design-options/QueryDeskMock";

/**
 * DESIGN OPTIONS
 * ==========================================================================
 * Five complete arrangements of the same review screen, rendered live so the
 * choice is made by looking rather than by reading a description.
 *
 * Each option shows the same case (Lucile C Wright) and the same ten review
 * sections, grouped differently. The underlying engine, evidence rules and
 * certification gate are identical in all five; only the arrangement changes.
 *
 * Reply with a number and the real screen is rebuilt in that direction.
 */
const OPTIONS = [
  {
    name: "Docket Rail",
    subtitle: "One continuous paper dossier instead of ten tabs",
    tone: "Warm archival paper",
    swatches: ["#faf8f3", "#0a1f3c", "#c9a961", "#6b7280"],
    bestFor: "reading a case end to end, and matching the light home page most closely",
    Mock: DocketRailMock,
  },
  {
    name: "Waterfall Grid",
    subtitle: "A row per case, a column per data source",
    tone: "Bright instrument panel",
    swatches: ["#ffffff", "#e6e9ef", "#111827", "#2563eb"],
    bestFor: "bulk work, where you watch many sources resolve across hundreds of rows",
    Mock: WaterfallGridMock,
  },
  {
    name: "Triage Board",
    subtitle: "Ranked by actionability, distress signals up front",
    tone: "Operational control room",
    swatches: ["#f7f9fb", "#334155", "#f59e0b", "#0f172a"],
    bestFor: "distressed-property volume: deciding which owner is worth a human hour",
    Mock: TriageBoardMock,
  },
  {
    name: "Compliance Steps",
    subtitle: "Authority on screen, then a strict review ladder",
    tone: "Calm regulated institution",
    swatches: ["#ffffff", "#0b1220", "#d7dbe0", "#1e40af"],
    bestFor: "files a third party must trust: attorneys, insurers, opposing counsel",
    Mock: ComplianceStepsMock,
  },
  {
    name: "Query Desk",
    subtitle: "Search-first: find the owner, then enrich the result",
    tone: "Clean research desk",
    swatches: ["#ffffff", "#0a1f3c", "#10b981", "#f59e0b"],
    bestFor: "your core service — finding the owner of a property, then enriching it into insight",
    Mock: QueryDeskMock,
  },
];

export default function DesignOptions() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <header>
        <h1 className="font-heading text-2xl font-bold">Five ways to arrange the workspace</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          The same case, the same ten sections, the same certification rules — five different
          arrangements. Scroll through and reply with the number you want.
        </p>
      </header>

      {OPTIONS.map((option, i) => (
        <OptionShell
          key={option.name}
          index={i + 1}
          name={option.name}
          subtitle={option.subtitle}
          tone={option.tone}
          swatches={option.swatches}
          bestFor={option.bestFor}
        >
          <option.Mock />
        </OptionShell>
      ))}

      <p className="rounded-xl border border-border bg-muted/40 px-5 py-4 text-[11px] text-muted-foreground">
        These are working mockups, not screenshots — every colour and block is real markup, so what
        you see here is what the rebuilt screen will look like. Nothing about the underlying engine,
        evidence rules, certification gate or exports changes in any of the five.
      </p>
    </div>
  );
}