import React from "react";
import { CASES, SOURCE_COLUMNS } from "./mockData";

/**
 * OPTION 2 — Waterfall Grid.
 * The queue and the case become one dense table: a row per case, a column per
 * data source, and each cell showing whether that source has answered yet.
 */
const ROWS = [
  { case: CASES[0], cells: ["done", "done", "done", "running", "gap", "gap", "gap"] },
  { case: CASES[1], cells: ["done", "done", "running", "gap", "gap", "gap", "gap"] },
];

function cellClass(state) {
  if (state === "done") return "bg-[#2563eb]/10 text-[#2563eb] border-[#2563eb]/40";
  if (state === "running") return "bg-[#2563eb]/5 text-[#2563eb]/70 border-[#2563eb]/20";
  return "bg-white text-[#9aa3af] border-[#e6e9ef]";
}

export default function WaterfallGridMock() {
  return (
    <div className="bg-white px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-md border border-[#e6e9ef] px-2.5 py-1">
          <span className="text-[11px] text-[#9aa3af]">Filter cases, counties, owners…</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#9aa3af]">
          2 cases · 7 sources
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[#e6e9ef]">
        <div className="grid grid-cols-[1.6fr_repeat(7,0.55fr)] border-b border-[#e6e9ef] bg-[#fafbfc]">
          <span className="px-2 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[#6b7280]">Case</span>
          {SOURCE_COLUMNS.map((c) => (
            <span
              key={c}
              className="border-l border-[#e6e9ef] px-1.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-[#6b7280]"
            >
              {c}
            </span>
          ))}
        </div>

        {ROWS.map((row) => (
          <div
            key={row.case.id}
            className="grid grid-cols-[1.6fr_repeat(7,0.55fr)] border-b border-[#e6e9ef] last:border-0"
          >
            <div className="px-2 py-2">
              <p className="text-[11px] font-semibold text-[#111827]">{row.case.name}</p>
              <p className="text-[10px] text-[#6b7280]">{row.case.location}</p>
            </div>
            {row.cells.map((state, i) => (
              <div key={`${row.case.id}-${i}`} className="border-l border-[#e6e9ef] p-1">
                <span
                  className={`flex h-full items-center justify-center rounded-sm border text-[9px] uppercase tracking-[0.08em] ${cellClass(
                    state,
                  )}`}
                >
                  {state === "done" ? "filled" : state === "running" ? "running" : "gap"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-[#9aa3af]">
        Selecting a row slides the case drawer over the right third: relationships, evidence ledger,
        certification, approval controls.
      </p>
    </div>
  );
}