import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Monitor, Briefcase, Settings as SettingsIcon, LayoutDashboard, LogOut, Menu, Bot, Rocket, ShieldCheck, Copy, Moon, Sun, Sparkles, Activity, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import NotificationBell from "@/components/NotificationBell";
import StartHereHandoff from "@/components/StartHereHandoff";
import CommandPalette from "@/components/CommandPalette";
import { useAuth } from "@/lib/AuthContext";

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

const workflowSteps = [
  {
    step: 1,
    label: "Main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/xtreme-gpt", label: "Xtreme GPT", icon: Bot },
      { to: "/command-center", label: "Command Center", icon: Sparkles },
      { to: "/social-presence", label: "Social Presence", icon: Globe },
      { to: "/website-factory", label: "Website Factory", icon: Rocket },
      { to: "/clone-studio", label: "Clone Site", icon: Copy },
      { to: "/mission-control", label: "Mission Control", icon: Activity },
      { to: "/sessions", label: "Sessions", icon: Monitor },
      { to: "/jobs", label: "Jobs", icon: Briefcase },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

function NavLinks({ onNavigate }) {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
      {isAdmin && (
        <div className="space-y-1 pb-2 border-b border-sidebar-border">
          <Link
            to="/"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === "/" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Portal
          </Link>
        </div>
      )}
      {workflowSteps.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {group.step}
            </span>
            <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{group.label}</span>
          </div>
          {group.items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                className={`flex items-center gap-3 pl-10 pr-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
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
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <span className="font-heading font-semibold text-sidebar-foreground text-lg tracking-tight">Xtreme Cloud Browser</span>
      </div>
      <div className="px-4 pt-4">
        <StartHereHandoff />
      </div>
      <div className="px-4 pt-2">
        <Link
          to="/xtreme-gpt"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Bot className="w-4 h-4" />
          Xtreme GPT
        </Link>
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
            <span className="font-heading font-semibold">Xtreme Cloud Browser</span>
          </div>
          <Link to="/xtreme-gpt" className="p-1 text-sidebar-foreground hover:text-sidebar-primary">
            <Bot className="w-5 h-5" />
          </Link>
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