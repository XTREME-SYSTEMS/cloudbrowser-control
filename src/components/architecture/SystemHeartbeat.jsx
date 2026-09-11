import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartPulse, Play, Pause, ExternalLink, Clock, Activity, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SWARM_INTERVAL_MS = 60_000;     // 60 seconds
const HEALING_INTERVAL_MS = 300_000;  // 5 minutes

export default function SystemHeartbeat() {
  const [active, setActive] = useState(true);
  const [lastSwarm, setLastSwarm] = useState(null);
  const [lastHealing, setLastHealing] = useState(null);
  const [nextBeatIn, setNextBeatIn] = useState(SWARM_INTERVAL_MS / 1000);
  const [error, setError] = useState(null);
  const [beatCount, setBeatCount] = useState(0);

  const activeRef = useRef(active);
  const lastHealingRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => { activeRef.current = active; }, [active]);

  const runBeat = useCallback(async () => {
    if (!activeRef.current) return;

    try {
      // Swarm beat — process pending tasks
      const swarmRaw = await base44.functions.invoke("runAutonomousSwarm", {});
      setLastSwarm(swarmRaw?.data || swarmRaw);
      setError(null);
      setBeatCount((c) => c + 1);

      // Healing beat — every 5th swarm beat (5 minutes)
      const now = Date.now();
      if (now - lastHealingRef.current >= HEALING_INTERVAL_MS) {
        lastHealingRef.current = now;
        try {
          const healingRaw = await base44.functions.invoke("runSelfHealingLoop", {});
          setLastHealing(healingRaw?.data || healingRaw);
        } catch (healErr) {
          // Healing failure is non-fatal — swarm still runs
        }
      }
    } catch (err) {
      setError(err.message || "Heartbeat failed");
    }
  }, []);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Run immediately on activate
    runBeat();

    // Set up countdown + interval
    let countdown = SWARM_INTERVAL_MS / 1000;
    intervalRef.current = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        countdown = SWARM_INTERVAL_MS / 1000;
        runBeat();
      }
      setNextBeatIn(countdown);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, runBeat]);

  const swarmStatus = lastSwarm?.status || "waiting";
  const swarmProcessed = lastSwarm?.tasks_processed || 0;
  const healingHealth = lastHealing?.architecture_health;
  const healingTriggered = lastHealing?.triggered;

  return (
    <Card className={active ? "border-emerald-500/30" : "border-muted"}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className={"w-10 h-10 rounded-lg flex items-center justify-center " + (active ? "bg-emerald-500/10" : "bg-muted")}>
              <HeartPulse className={"w-5 h-5 " + (active ? "text-emerald-500 animate-pulse" : "text-muted-foreground")} />
            </div>
            <div>
              <CardTitle>System Heartbeat</CardTitle>
              <CardDescription>
                {active
                  ? `Active — next beat in ${nextBeatIn}s · ${beatCount} beats since page load`
                  : "Paused — click Start to resume autonomous operation"}
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant={active ? "destructive" : "default"}
            onClick={() => setActive(!active)}
          >
            {active ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
            {active ? "Pause" : "Start"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border text-center">
            <Activity className="w-4 h-4 mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold">{swarmStatus}</p>
            <p className="text-xs text-muted-foreground">Swarm Status</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{swarmProcessed}</p>
            <p className="text-xs text-muted-foreground">Tasks Processed</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <ShieldCheck className="w-4 h-4 mx-auto text-purple-500 mb-1" />
            <p className="text-lg font-bold">{healingHealth !== undefined ? `${healingHealth}/100` : "—"}</p>
            <p className="text-xs text-muted-foreground">Arch Health</p>
          </div>
          <div className="p-3 rounded-lg border text-center">
            <HeartPulse className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold">{beatCount}</p>
            <p className="text-xs text-muted-foreground">Total Beats</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-500">
            <strong>Last error:</strong> {error}
          </div>
        )}

        {/* External cron instructions */}
        <div className="p-3 rounded-lg bg-muted/50 border border-dashed space-y-2">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">For true 24/7 operation (when this page is closed)</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Set up a free external cron service to hit this URL every 5 minutes.
            The system will run autonomously without Base44 scheduled workflows or integration credits:
          </p>
          <div className="p-2 rounded-md bg-background border text-xs font-mono break-all">
            https://cloud-browser.base44.app/functions/externalTrigger?key=YOUR_ENGINE_API_KEY&target=all
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">cron-job.org (free)</Badge>
            <Badge variant="outline" className="text-xs">UptimeRobot (free)</Badge>
            <Badge variant="outline" className="text-xs">GitHub Actions (free)</Badge>
            <Badge variant="outline" className="text-xs">Vercel Cron (free)</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> The external trigger bypasses the Base44 scheduler entirely.
            It validates an API key, then directly invokes the swarm and healing loop functions.
            No integration credits needed — entity operations and function invocation are always available.
          </p>
        </div>

        {/* Last results */}
        {lastSwarm && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Last swarm result (click to expand)
            </summary>
            <pre className="mt-2 p-2 rounded-md bg-muted overflow-x-auto text-xs">
              {JSON.stringify(lastSwarm, null, 2).slice(0, 500)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}