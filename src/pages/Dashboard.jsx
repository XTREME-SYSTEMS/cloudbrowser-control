import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import {
  Server, Bot, Monitor, Clock, Copy, Plug, Box,
  CheckCircle2, Circle, ArrowRight, Sparkles, Activity, Zap,
} from "lucide-react";

const LOGO_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png";

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
        ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 8);
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
    { label: "New Sandbox", desc: "Provision an isolated environment", icon: Server, link: "/sandboxes", color: "text-blue-500 bg-blue-50" },
    { label: "Build Agent", desc: "Create an AI automation agent", icon: Bot, link: "/agent-builder", color: "text-purple-500 bg-purple-50" },
    { label: "Sandbox Clone", desc: "Recursive clone to 100% parity", icon: Box, link: "/sandboxed-clone", color: "text-violet-500 bg-violet-50" },
    { label: "Clone Site", desc: "Clone any website", icon: Copy, link: "/clone-studio", color: "text-amber-500 bg-amber-50" },
    { label: "MCP Config", desc: "Connect your AI tools", icon: Plug, link: "/mcp-creator", color: "text-emerald-500 bg-emerald-50" },
  ];

  const statCards = [
    { label: "Sandboxes", value: stats.sandboxes, icon: Server, color: "text-blue-500" },
    { label: "AI Agents", value: stats.agents, icon: Bot, color: "text-purple-500" },
    { label: "Active Sessions", value: stats.sessions, icon: Monitor, color: "text-emerald-500" },
    { label: "Jobs Run", value: stats.jobs, icon: Activity, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Branded Header */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gold-gradient" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Image src={LOGO_URL} alt="XTREME SCRAPER" className="w-12 h-12 shrink-0" fittingType="fit" />
            <div>
              <h1 className="text-2xl font-heading font-bold">Command Center</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Welcome back{user?.full_name ? ", " + user.full_name : ""} — your automation workspace.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 font-medium capitalize">
              {planName} plan
            </span>
            <Link to="/billing"><Button variant="outline" size="sm">Upgrade</Button></Link>
          </div>
        </div>
      </div>

      {/* Onboarding Banner */}
      {!onboarded && (
        <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50/50">
          <CardContent className="pt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Welcome to XTREME SCRAPER! Let's set up your account.</h3>
                <p className="text-xs text-muted-foreground">Answer a few questions and our AI will configure everything for you.</p>
              </div>
            </div>
            <Link to="/welcome">
              <Button size="sm" className="bg-gold-gradient text-black font-medium">
                Get Started <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border/50">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn("w-5 h-5", s.color)} />
                </div>
                <div className="text-2xl font-heading font-bold">{loading ? "—" : s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Card */}
      {subscription && (
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-sm">Browser Hours Usage</h3>
              </div>
              <span className="text-sm font-medium">
                {stats.browserHours.toFixed(2)} / {maxHours} hrs
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
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

      {/* Quick Actions + Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-5 h-5 text-amber-600" /> Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <Link key={a.label} to={a.link}>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-amber-300 hover:bg-amber-50/30 transition-colors cursor-pointer">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", a.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{a.label}</div>
                      <div className="text-xs text-muted-foreground">{a.desc}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-5 h-5 text-amber-600" /> Recent Activity
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
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
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
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-5 h-5 text-amber-600" /> Getting Started
            <span className="text-xs text-muted-foreground ml-2">({checklistDone}/{checklist.length} complete)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {checklist.map((item, i) => (
              <Link key={i} to={item.link}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  {item.done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
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
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-emerald-700">All set! Your workspace is fully configured.</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}