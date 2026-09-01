import { CheckCircle2, XCircle, ExternalLink, Loader2, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";

export default function ProofCard({ title, state, children }) {
  const status = state?.status || "pending";
  const data = state?.data;
  const ok = data?.ok || data?.success || (Array.isArray(data?.results) && data.results.some((r) => r.success));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{title}</span>
          {status === "pending" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {status === "done" && (
            <Badge variant={ok ? "default" : "destructive"}>
              {ok ? <><CheckCircle2 className="w-3 h-3 mr-1" /> VERIFIED</> : <><XCircle className="w-3 h-3 mr-1" /> FAILED</>}
            </Badge>
          )}
          {status === "error" && <Badge variant="destructive">ERROR</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "pending" && <p className="text-sm text-muted-foreground">Running test…</p>}
        {status === "error" && <p className="text-sm text-destructive">{state.error}</p>}
        {status === "done" && children}
      </CardContent>
    </Card>
  );
}

export function ScreenshotBlock({ url, label }) {
  if (!url) return <p className="text-xs text-muted-foreground">No screenshot captured</p>;
  return (
    <div className="space-y-1">
      {label && <p className="text-xs text-muted-foreground flex items-center gap-1"><ExternalLink className="w-3 h-3" />{label}</p>}
      <div className="rounded-lg border overflow-hidden bg-muted/30">
        <Image src={url} fittingType="fit" className="w-full h-auto" alt={`Screenshot of ${label || "site"}`} />
      </div>
    </div>
  );
}

export function DataRow({ label, value, mono }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}