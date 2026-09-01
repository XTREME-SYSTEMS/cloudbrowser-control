import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { LayoutDashboard, Monitor, Briefcase, Calendar, DollarSign, Settings, Code2, Trophy, Sparkles, Activity, AlertTriangle, CreditCard, Users, ScrollText, Plug, Folder, Bot, Wand2, Rocket, ShieldCheck, Globe, Shield, Cloud, Moon, Sun } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useTheme } from "next-themes";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions", icon: Monitor },
  { to: "/projects", label: "Projects", icon: Folder },
  { to: "/onboarding", label: "Onboarding", icon: Rocket },
  { to: "/enhancements", label: "Fortress", icon: ShieldCheck },
  { to: "/connection-wizard", label: "Connect", icon: Wand2 },
  { to: "/ai-chat", label: "AI Agent", icon: Bot },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/jobs/kanban", label: "Job Board", icon: Briefcase },
  { to: "/schedules", label: "Schedules", icon: Calendar },
  { to: "/costs", label: "Costs", icon: DollarSign },
  { to: "/jobs/ai-builder", label: "AI Builder", icon: Sparkles },
  { to: "/templates", label: "Templates", icon: Briefcase },
  { to: "/analytics", label: "Analytics", icon: Activity },
  { to: "/errors", label: "Errors", icon: AlertTriangle },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/team", label: "Team", icon: Users },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/connection-info", label: "Connection Info", icon: Plug },
  { to: "/api-docs", label: "API Docs", icon: Code2 },
  { to: "/test-results", label: "Test Results", icon: Trophy },
  { to: "/proxies", label: "Proxies", icon: Globe },
  { to: "/captcha", label: "Captcha", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentJobs, setRecentJobs] = useState([]);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (open && recentJobs.length === 0) {
      base44.entities.Job.list("-updated_date", 5)
        .then(setRecentJobs)
        .catch(() => {});
    }
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, jobs, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); }}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle {theme === "dark" ? "Light" : "Dark"} Mode
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Navigate">
          {navItems.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => go(to)}>
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>

        {recentJobs.length > 0 && (
          <CommandGroup heading="Recent Jobs">
            {recentJobs.map((job) => (
              <CommandItem key={job.id} onSelect={() => go(`/jobs/${job.id}`)}>
                <Briefcase className="mr-2 h-4 w-4" />
                {job.name}
                <span className="ml-auto text-xs text-muted-foreground">{job.status}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}