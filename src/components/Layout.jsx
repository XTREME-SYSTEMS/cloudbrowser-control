import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Monitor, Briefcase, Calendar, Settings as SettingsIcon, LayoutDashboard, LogOut, Cloud, Menu, DollarSign, ScrollText, Code2, Trophy, Sparkles, Activity, AlertTriangle, CreditCard, Users, Plug, Folder, Bot, Wand2, Rocket, ShieldCheck, Globe, Shield, Moon, Sun, Command, FileSearch, FlaskConical, Eye, Train, HeartPulse, Copy, Server } from "lucide-react";
import { useTheme } from "next-themes";
import NotificationBell from "@/components/NotificationBell";
import StartHereHandoff from "@/components/StartHereHandoff";
import CommandPalette from "@/components/CommandPalette";
import CopilotPanel from "@/components/copilot/CopilotPanel";
import { Image } from "@/components/ui/image";
import { useIsMobile } from "@/hooks/use-mobile";

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
  { to: "/", label: "Admin Portal", icon: ShieldCheck },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sessions", label: "Sessions", icon: Monitor },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/agent-builder", label: "Agents", icon: Bot },
  { to: "/sandboxes", label: "Sandboxes", icon: Server },
  { to: "/clone-studio", label: "Clone Studio", icon: Copy },
  { to: "/mcp-creator", label: "MCP Creator", icon: Plug },
  { to: "/welcome", label: "Get Started", icon: Rocket },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/api-docs", label: "API Docs", icon: Code2 },
  { to: "/ai-chat", label: "AI Chat", icon: Sparkles },
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