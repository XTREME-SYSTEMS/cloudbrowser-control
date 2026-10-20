import React from "react";
import { SIGNALS } from "./mockData";

/**
 * OPTION 5 — Query Desk.
 * Search-first rather than case-first: one universal bar over owners, addresses
 * and entities, and the results are ranked person-and-property cards. Built for
 * "find the owner of this distressed property", not for reviewing one file.
 */
const RESULTS = [
  {
    name: "Lucile C Wright",
    line: "Owner · 6 Pueblo Dr, Pensacola, FL 32507",
    match: "High confidence",
    contacts: ["2 phones", "1 email", "1 mailing address"],
  },
  {
    name: "Estate of Lucile C Wright",
    line: "Probate filing · Escambia County, FL",
    match: "Medium confidence",
    contacts: ["Executor named", "Attorney on record"],
  },
  {
    name: "Thomas Everett Wright",
    line: "Possible relative · 1629 Athens Ave, Pensacola, FL",
    match: "Lead only",
    contacts: ["1 phone", "1 email"],
  },
];

export default function QueryDeskMock() {
  return (
    <div className="bg-white px-5 py-4">
      <div className="rounded-lg border border-slate-300 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Search owner, address, LLC or parcel…</span>
          <span className="ml-auto rounded bg-[#0a1f3c] px-2.5 py-1 text-[10px] font-semibold text-white">
            Search
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SIGNALS.map((s) => (
            <span
              key={s.label}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-slate-500"
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_170px] gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              3 possible owners
            </span>
            <span className="text-[10px] text-slate-400">sources: county · probate · people</span>
          </div>

          <ul className="space-y-2">
            {RESULTS.map((r, i) => (
              <li key={r.name} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-semibold text-[#0a1f3c]">{r.name}</p>
                    <p className="text-[10px] text-slate-500">{r.line}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] ${
                      i === 0
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : i === 1
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-slate-300 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {r.match}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {r.contacts.map((c) => (
                    <span key={c} className="text-[10px] text-slate-600">
                      {c}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Enrich this result
          </p>
          <ul className="space-y-1">
            {["Skip trace contacts", "Unwind the LLC", "Build family tree", "Pull liens", "Check probate"].map(
              (a) => (
                <li
                  key={a}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-[10px] text-slate-600"
                >
                  {a}
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}