import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Shield, Cpu, Heart } from "lucide-react";

function GaugeCircle({ value, label, icon: Icon, color }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const strokeColor = value >= 100 ? "#10b981" : value >= 75 ? "#f59e0b" : value >= 50 ? "#3b82f6" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none" stroke={strokeColor} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-5 h-5 mb-1" style={{ color: strokeColor }} />
          <span className="text-2xl font-bold" style={{ color: strokeColor }}>{value}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <p className="text-sm font-medium mt-2">{label}</p>
    </div>
  );
}

export default function HealthGauge({ architectureHealth, capabilityScore }) {
  const overallHealth = Math.round((architectureHealth + capabilityScore) / 2);
  const isHealthy = overallHealth >= 100;

  return (
    <Card className={isHealthy ? "border-emerald-500/30" : "border-amber-500/30"}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={"w-10 h-10 rounded-lg flex items-center justify-center " + (isHealthy ? "bg-emerald-500/10" : "bg-amber-500/10")}>
            <Heart className={"w-5 h-5 " + (isHealthy ? "text-emerald-500" : "text-amber-500")} />
          </div>
          <div>
            <h3 className="font-heading font-bold">System Health</h3>
            <p className="text-xs text-muted-foreground">
              {isHealthy
                ? "All systems at 100% — autonomous healing satisfied"
                : "Health below 100% — self-healing loop will trigger"}
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-around gap-4">
          <GaugeCircle value={overallHealth} label="Overall Health" icon={Activity} />
          <GaugeCircle value={architectureHealth} label="Architecture" icon={Shield} />
          <GaugeCircle value={capabilityScore} label="Capabilities" icon={Cpu} />
        </div>

        {!isHealthy && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              <strong>Autonomous trigger active:</strong> The Architecture Health Monitor workflow
              will detect health &lt; 100 and set the self-healing swarm into motion — retry, flag,
              audit, repair, validate — until all scores reach 100.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}