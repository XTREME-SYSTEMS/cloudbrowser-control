import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Monitor, Briefcase, Calendar, Settings as SettingsIcon, LayoutDashboard, LogOut, Cloud, Menu, DollarSign, ScrollText, Code2, Trophy, Sparkles, Activity, AlertTriangle, CreditCard, Users, Plug, Folder, Bot, Wand2, Rocket, ShieldCheck, Globe, Shield, Moon, Sun, Command } from "lucide-react";
import { useTheme } from "next-themes";
import NotificationBell from "@/components/NotificationBell";
import StartHereHandoff from "@/components/StartHereHandoff";
import CommandPalette from "@/components/CommandPalette";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions", icon: Monitor },
  { to: "/projects", label: "Projects", icon: Folder },
  { to: "/onboarding", label: "Onboarding", icon: Rocket },
  { to: "/enhancements", label: "Fortress", icon: ShieldCheck },
  { to: "/connection-wizard", label: "Connect", icon: Wand2 },
  { to: "/ai-chat", label: "AI Agent", icon: Bot },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
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
  { to: "/capabilities", label: "Capabilities", icon: ShieldCheck },
  { to: "/proxies", label: "Proxies", icon: Globe },
  { to: "/captcha", label: "Captcha", icon: Shield },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({ onNavigate }) {
  const location = useLocation();
  return (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onLogout }) {
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-semibold text-sidebar-foreground">Cloud Browser</span>
        </div>
      </div>
      <div className="px-4 pt-4">
        <StartHereHandoff />
      </div>
      <NavLinks />
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <ThemeToggle />
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-sidebar-border flex-col">
        <SidebarContent onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent onLogout={handleLogout} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 p-4 border-b bg-sidebar shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Cloud className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold">Cloud Browser</span>
          </div>
          <Link to="/settings" className="p-1 text-sidebar-foreground hover:text-sidebar-primary">
            <SettingsIcon className="w-5 h-5" />
          </Link>
          <NotificationBell />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette />
    </div>
  );
}