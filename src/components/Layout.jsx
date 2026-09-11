import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Monitor, Briefcase, Settings as SettingsIcon, LayoutDashboard, LogOut, Menu, CreditCard, Plug, Bot, Rocket, ShieldCheck, Copy, Server, Moon, Sun, Layers, Target, Sparkles, Box, Radar, Building2, Users } from "lucide-react";
import { useTheme } from "next-themes";
import NotificationBell from "@/components/NotificationBell";
import StartHereHandoff from "@/components/StartHereHandoff";
import CommandPalette from "@/components/CommandPalette";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import { Image } from "@/components/ui/image";
import { useIsMobile } from "@/hooks/use-mobile";
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

const navGroups = [
  {
    label: "Getting Started",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/welcome", label: "Onboarding", icon: Rocket },
    ],
  },
  {
    label: "Build",
    items: [
      { to: "/sandboxes", label: "Sandboxes", icon: Server },
      { to: "/agent-builder", label: "Build Agent", icon: Bot },
      { to: "/clone-studio", label: "Clone Site", icon: Copy },
      { to: "/batch-clone", label: "Batch Clone", icon: Layers },
      { to: "/gap-playground", label: "Gap Playground", icon: Target },
      { to: "/gap-map", label: "Gap Map", icon: Sparkles },
      { to: "/sandboxed-clone", label: "Sandbox Clone", icon: Box },
      { to: "/skip-tracing", label: "Skip Tracing", icon: Radar },
      { to: "/swarm-orchestrator", label: "Swarm Orchestrator", icon: Bot },
      { to: "/architecture", label: "Architecture", icon: Building2 },
      { to: "/mcp-creator", label: "Connect AI Tools", icon: Plug },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/sessions", label: "Sessions", icon: Monitor },
      { to: "/jobs", label: "Jobs", icon: Briefcase },
      { to: "/team", label: "Team", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/billing", label: "Billing", icon: CreditCard },
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
      {navGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="px-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{group.label}</div>
          {group.items.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
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
        </div>
      ))}
    </nav>
  );
}

function SidebarContent({ onLogout, onToggleCopilot, copilotOpen }) {
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png" alt="XTREME SCRAPER" className="w-8 h-8 shrink-0" fittingType="fit" />
          <span className="font-heading font-semibold text-sidebar-foreground">XTREME SCRAPER</span>
        </div>
      </div>
      <div className="px-4 pt-4">
        <StartHereHandoff />
      </div>
      {onToggleCopilot && (
        <div className="px-4 pt-2">
          <button
            onClick={onToggleCopilot}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm w-full transition-colors ${
              copilotOpen ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Bot className="w-4 h-4" />
            {copilotOpen ? "Hide Copilot" : "Copilot"}
          </button>
        </div>
      )}
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-sidebar-border flex-col">
        <SidebarContent onLogout={handleLogout} onToggleCopilot={() => setCopilotOpen(!copilotOpen)} copilotOpen={copilotOpen} />
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
            <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png" alt="XTREME SCRAPER" className="w-7 h-7 shrink-0" fittingType="fit" />
            <span className="font-heading font-semibold">XTREME SCRAPER</span>
          </div>
          <button onClick={() => setCopilotOpen(!copilotOpen)} className="p-1 text-sidebar-foreground hover:text-sidebar-primary">
            <Bot className="w-5 h-5" />
          </button>
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

      {/* Copilot panel - desktop inline (right side) */}
      {copilotOpen && !isMobile && (
        <aside className="hidden md:flex w-[340px] border-l border-sidebar-border shrink-0">
          <CopilotPanel onClose={() => setCopilotOpen(false)} />
        </aside>
      )}

      {/* Copilot panel - mobile drawer (right side) */}
      <Sheet open={copilotOpen && isMobile} onOpenChange={setCopilotOpen}>
        <SheetContent side="right" className="w-[340px] p-0">
          <CopilotPanel onClose={() => setCopilotOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette />
    </div>
  );
}