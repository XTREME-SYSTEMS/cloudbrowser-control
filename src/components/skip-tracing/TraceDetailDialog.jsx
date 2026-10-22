import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import TraceDetail from "@/components/skip-tracing/TraceDetail";
import { traceHeadline, when } from "@/components/skip-tracing/traceDetailParts";

/**
 * The full record for one stored skip trace, opened from the history list.
 * One dialog instance serves every row: the page holds the selected trace and
 * passes it in, so the list itself stays a plain list.
 */
export default function TraceDetailDialog({ trace, onClose }) {
  return (
    <Dialog open={!!trace} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
        {trace && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-base">{traceHeadline(trace)}</DialogTitle>
              <DialogDescription>
                {when(trace.created_date) || "Start time not recorded"}
                {trace.search_duration_ms ? ` — ${(trace.search_duration_ms / 1000).toFixed(1)}s` : ""}
                {trace.batch_id ? ` — batch ${trace.batch_id}` : ""}
              </DialogDescription>
            </DialogHeader>
            <TraceDetail trace={trace} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}