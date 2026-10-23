import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Monitor, Loader2, RotateCw } from "lucide-react";

const TONE = {
  connected: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
  pending: "border-border bg-secondary/60 text-muted-foreground hover:bg-secondary",
  needs_reauth: "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10",
  idle: "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5",
};

/**
 * The pairing control for the operator's own computer. While a pairing is
 * waiting to be approved the card re-checks itself, so finishing the approval
 * in the other tab settles this one without the operator reloading anything.
 */
export default function DesktopCommanderConnect() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await base44.functions.invoke("desktopCommander", { action: "status" });
      setState(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
  }, []);

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  // A pairing in flight completes out of band, so poll until it lands.
  useEffect(() => {
    clearTimeout(timer.current);
    if (state?.status === "pending") {
      timer.current = setTimeout(load, 4000);
    }
    return () => clearTimeout(timer.current);
  }, [state, load]);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("desktopCommander", { action: "connect" });
      const url = res.data?.authorize_url;
      if (!url) throw new Error(res.data?.error || "No pairing link was returned.");
      window.open(url, "_blank", "noopener");
      setState({ ...state, status: "pending" });
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const connected = state?.connected;
  const pending = state?.status === "pending";
  const needsReauth = state?.status === "needs_reauth";
  const tone = connected ? TONE.connected : needsReauth ? TONE.needs_reauth : pending ? TONE.pending : TONE.idle;

  const label = connected
    ? state.tool_count
      ? `PC connected · ${state.tool_count} tools`
      : "PC connected"
    : pending
    ? "Waiting for approval"
    : needsReauth
    ? "Reconnect your PC"
    : "Connect your PC";

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={connected ? load : connect}
        disabled={busy || pending}
        title={error || state?.last_error || "Reach your own computer from this agent"}
        className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-display font-semibold transition-colors disabled:opacity-60 ${tone}`}
      >
        {busy || pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : connected ? (
          <RotateCw className="h-3.5 w-3.5" />
        ) : (
          <Monitor className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
      {(error || state?.last_error) && (
        <p className="mt-1 max-w-[16rem] text-right text-[10px] leading-tight text-destructive">
          {error || state.last_error}
        </p>
      )}
    </div>
  );
}