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
          <p className="text-2xl font-heading font-semibold mt-1">{value}</p>
        </div>
        {Icon && <Icon className={`w-8 h-8 ${accent} opacity-80`} />}
      </div>
    </Card>
  );
}