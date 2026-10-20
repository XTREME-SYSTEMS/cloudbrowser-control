import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CapabilityMap from "@/components/dashboard/CapabilityMap";
import { Button } from "@/components/ui/button";
import {
  Server, Bot, Monitor, Clock, Copy, Plug, Box,
  CheckCircle2, Circle, ArrowRight, Sparkles, Activity, Zap,
} from "lucide-react";

const LOGO_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/9e104d119_836982562_28635455156118005_3935075842464884998_n.jpg";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sandboxes: 0, agents: 0, sessions: 0, jobs: 0, browserHours: 0 });
  const [subscription, setSubscription] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    if (!loading && !onboarded) {
      navigate("/welcome");
    }
  }, [loading, onboarded, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const [sandboxes, agents, sessions, jobs, subs, onboarding] = await Promise.all([
          base44.entities.Sandbox.list("-created_date", 50).catch(() => []),
          base44.entities.UserAgent.list("-created_date", 50).catch(() => []),
          base44.entities.Session.list("-created_date", 10).catch(() => []),
          base44.entities.Job.list("-created_date", 10).catch(() => []),
          base44.entities.Subscription.list("-created_date", 1).catch(() => []),
          base44.entities.OnboardingProfile.filter({ completed: true }).catch(() => []),
        ]);

        setStats({
          sandboxes: sandboxes.length,
          agents: agents.length,
          sessions: sessions.filter(s => s.status === "active").length,
          jobs: jobs.length,
          browserHours: subs[0]?.usage_browser_hours || 0,
        });
        setSubscription(subs[0] || null);
        setOnboarded(onboarding.length > 0);

        const activity = [
          ...sessions.slice(0, 5).map(s => ({
            type: "session",
            title: "Session " + (s.status || "created"),
            subtitle: s.start_url || s.target_url || "—",
            time: s.created_date,
            icon: Monitor,
          })),
          ...jobs.slice(0, 5).map(j => ({
            type: "job",
            title: "Job: " + (j.name || "Untitled"),
            subtitle: j.status || "pending",
            time: j.created_date,
            icon: Activity,
          })),
        ].sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime()).slice(0, 8);
        setRecentActivity(activity);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const planName = subscription?.plan_tier || "free";
  const maxHours = subscription?.max_browser_hours || 0.25;
  const usagePct = maxHours > 0 ? Math.min(100, (stats.browserHours / maxHours) * 100) : 0;

  const checklist = [
    { label: "Complete onboarding", done: onboarded, link: "/welcome" },
    { label: "Create your first sandbox", done: stats.sandboxes > 0, link: "/sandboxes" },
    { label: "Build an AI agent", done: stats.agents > 0, link: "/agent-builder" },
    { label: "Run a job", done: stats.jobs > 0, link: "/jobs" },
    { label: "Set up MCP connection", done: false, link: "/mcp-creator" },
  ];
  const checklistDone = checklist.filter(c => c.done).length;

  const quickActions = [
    { label: "New Sandbox", desc: "Provision an isolated environment", icon: Server, link: "/sandboxes" },
    { label: "Build Agent", desc: "Create an AI automation agent", icon: Bot, link: "/agent-builder" },
    { label: "Sandbox Clone", desc: "Recursive clone to 100% parity", icon: Box, link: "/sandboxed-clone" },
    { label: "Clone Site", desc: "Clone any website", icon: Copy, link: "/clone-studio" },
    { label: "MCP Config", desc: "Connect your AI tools", icon: Plug, link: "/mcp-creator" },
  ];

  const statCards = [
    { label: "Sandboxes", value: stats.sandboxes, icon: Server },
    { label: "AI Agents", value: stats.agents, icon: Bot },
    { label: "Active Sessions", value: stats.sessions, icon: Monitor },
    { label: "Jobs Run", value: stats.jobs, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Branded Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card backdrop-blur-xl p-6"
        style={{ boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)" }}>
        <div className="absolute top-0 left-0 right-0 h-px neon-divider" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border border-primary/40" style={{ boxShadow: "0 0 16px rgba(201,169,97,0.3)" }} />
              <div className="absolute inset-1.5 rounded-full border border-primary/20" />
              <img src={LOGO_URL} alt="Strategic Cloud Browser" className="w-10 h-10 rounded-full object-cover relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold chrome-text tracking-wide">STRATEGIC CLOUD BROWSER</h1>
              <p className="text-xs text-primary/60 tracking-[0.2em] uppercase mt-0.5 font-display">Intelligence in Motion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary font-display font-semibold tracking-wide uppercase">
              {planName} plan
            </span>
            <Link to="/billing"><Button variant="outline" size="sm">Upgrade</Button></Link>
          </div>
        </div>
      </div>

      {/* Quick Actions — the first thing on the dashboard */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="font-heading text-base font-semibold tracking-wide">Quick Actions</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.link}>
                <div className="h-full flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-sm tracking-wide">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Onboarding Banner */}
      {!onboarded && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm tracking-wide">Welcome to Strategic Cloud Browser</h3>
                <p className="text-xs text-muted-foreground">Answer a few questions and our AI will configure everything for you.</p>
              </div>
            </div>
            <Link to="/welcome">
              <Button size="sm">
                Get Started <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <CapabilityMap />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-2xl font-heading font-bold text-foreground">{loading ? "—" : s.value}</div>
                <div className="text-xs text-muted-foreground mt-1 font-display tracking-wide">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Card */}
      {subscription && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-semibold text-sm tracking-wide">Browser Hours Usage</h3>
              </div>
              <span className="text-sm font-display font-semibold text-primary">
                {stats.browserHours.toFixed(2)} / {maxHours} hrs
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gold-gradient transition-all" style={{ width: usagePct + "%" }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {usagePct >= 100
                ? "You've reached your monthly limit. Upgrade to continue."
                : (100 - usagePct).toFixed(0) + "% remaining this billing period."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-heading tracking-wide">
            <Activity className="w-5 h-5 text-primary" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No activity yet. Start by creating a sandbox or agent.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{a.subtitle}</div>
                      </div>
                      {a.time && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(a.time).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-heading tracking-wide">
            <Sparkles className="w-5 h-5 text-primary" /> Getting Started
            <span className="text-xs text-muted-foreground ml-2 font-body">({checklistDone}/{checklist.length} complete)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <Link key={i} to={item.link}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={cn("text-sm flex-1", item.done && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                  {!item.done && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </Link>
            ))}
          </div>
          {checklistDone === checklist.length && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-sm text-primary">All set! Your workspace is fully configured.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}