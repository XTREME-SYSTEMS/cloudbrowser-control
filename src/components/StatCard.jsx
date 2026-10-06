import { Card } from "@/components/ui/card";

/**
 * @param {{ label: string; value: any; icon: any; accent?: string }} props
 */
export default function StatCard({ label, value, icon: Icon, accent = "text-primary" }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-heading font-bold tabular-nums mt-1">{value}</p>
        </div>
        {Icon && <div className="rounded-md border border-border bg-background/60 p-2.5"><Icon className={`w-5 h-5 ${accent}`} /></div>}
      </div>
    </Card>
  );
}