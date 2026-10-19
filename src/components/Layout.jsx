import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Monitor, Briefcase, Settings as SettingsIcon, LayoutDashboard, LogOut, Menu,
  Bot, Rocket, ShieldCheck, Copy, Moon, Sun, Sparkles, Activity, Globe, Users,
  FileText, Crown, Target,
} from "lucide-react";
import { useTheme } from "next-themes";
import NotificationBell from "@/components/NotificationBell";
import StartHereHandoff from "@/components/StartHereHandoff";
import CommandPalette from "@/components/CommandPalette";
import AutonomousChatPanel from "@/components/AutonomousChatPanel";
import { useAuth } from "@/lib/AuthContext";

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
        <div className="absolute inset-0 rounded-full border border-primary/40" style={{ boxShadow: "0 0 12px rgba(0,163,255,0.3)" }} />
        <div className="absolute inset-1 rounded-full border border-primary/20" />
        <span className="font-heading font-black text-lg chrome-text relative z-10">S</span>
      </div>
      <div className="min-w-0">
        <div className="font-heading font-bold text-sm text-foreground tracking-wide leading-tight truncate">STRATEGIC CLOUD</div>
        <div className="font-display text-[10px] text-primary/70 tracking-[0.2em] uppercase leading-tight">Browser</div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-primary hover:bg-primary/5 transition-all w-full"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="font-display tracking-wide">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}

const navGroups = [
  {
    label: "Core",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/skip-tracing", label: "Skip Tracing", icon: Target },
      { to: "/heir-search", label: "Heir Search", icon: Users },
      { to: "/heir-search-dashboard", label: "Case Dashboard", icon: FileText },
      { to: "/strategic-report", label: "Strategic Report", icon: FileText },
      { to: "/heir-portal", label: "Client Portal", icon: Crown },
      { to: "/sessions", label: "Sessions", icon: Monitor },
      { to: "/jobs", label: "Jobs", icon: Briefcase },
    ],
  },
  {
    label: "AI Systems",
    items: [
      { to: "/xtreme-gpt", label: "Xtreme GPT", icon: Bot },
      { to: "/command-center", label: "Command Center", icon: Sparkles },
      { to: "/mission-control", label: "Mission Control", icon: Activity },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/website-factory", label: "Website Factory", icon: Rocket },
      { to: "/clone-studio", label: "Clone Site", icon: Copy },
      { to: "/social-presence", label: "Social Presence", icon: Globe },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

function NavLinks({ onNavigate }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto xa-scroll">
      {isAdmin && (
        <div className="mb-4">
          <Link
            to="/"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              location.pathname === "/"
                ? "bg-primary/10 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
            }`}
            style={location.pathname === "/" ? { boxShadow: "0 0 12px rgba(0,163,255,0.15)" } : {}}
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="font-display tracking-wide">Admin Portal</span>
          </Link>
        </div>
      )}
      {navGroups.map((group) => (
        <div key={group.label} className="mb-4">
          <div className="flex items-center gap-2 px-3 mb-1.5">
            <span className="text-[10px] font-display font-semibold text-muted-foreground/60 uppercase tracking-[0.15em]">{group.label}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
          {group.items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
                }`}
                style={active ? { boxShadow: "0 0 12px rgba(0,163,255,0.12)" } : {}}
              >
                <Icon className={`w-4 h-4 transition-colors ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                <span className="font-display tracking-wide">{label}</span>
                {active && <div className="ml-auto w-1 h-4 rounded-full bg-primary" style={{ boxShadow: "0 0 8px rgba(0,163,255,0.5)" }} />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onLogout }) {
  return (
    <div className="flex flex-col h-full bg-sidebar backdrop-blur-xl">
      <div className="px-5 py-5 border-b border-border">
        <BrandMark />
        <p className="text-[9px] text-muted-foreground/60 tracking-[0.25em] uppercase mt-2 font-display">Intelligence in Motion</p>
      </div>
      <div className="px-3 pt-3">
        <StartHereHandoff />
      </div>
      <NavLinks />
      <div className="p-3 border-t border-border space-y-1">
        <ThemeToggle />
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-display tracking-wide">Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex w-64 border-r border-border flex-col shrink-0">
        <SidebarContent onLogout={handleLogout} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-border">
          <SidebarContent onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 p-4 border-b border-border bg-sidebar shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1 text-muted-foreground hover:text-foreground">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <BrandMark />
          </div>
          <Link to="/xtreme-gpt" className="p-1 text-neutral-400 hover:text-primary">
            <Bot className="w-5 h-5" />
          </Link>
          <Link to="/settings" className="p-1 text-neutral-400 hover:text-primary">
            <SettingsIcon className="w-5 h-5" />
          </Link>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto xa-scroll">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
      <AutonomousChatPanel />
    </div>
  );
}