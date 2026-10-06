import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import BrandLockup from '@/components/BrandLockup';
import NotificationBell from '@/components/NotificationBell';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LayoutDashboard, CreditCard, Phone, Key, Ticket, Eye, RefreshCw,
  ArrowLeft, Users, Sparkles, Search, Bell, Settings, LogOut, ChevronRight,
  Activity, TrendingUp, Zap, Menu, X,
} from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminPhoneNumbers from "@/components/admin/AdminPhoneNumbers";
import AdminApiKeys from "@/components/admin/AdminApiKeys";
import AdminPromos from "@/components/admin/AdminPromos";
import AdminVisionCortex from "@/components/admin/AdminVisionCortex";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminTeam from "@/components/admin/AdminTeam";

const NAV_GROUPS = [
  {
    label: "Platform",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
      { id: "users", label: "Users", icon: Users },
      { id: "team", label: "Team", icon: Users },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { id: "phone", label: "Phone & Proxies", icon: Phone },
      { id: "apikeys", label: "API Keys", icon: Key },
      { id: "promos", label: "Promo Codes", icon: Ticket },
    ],
  },
  {
    label: "Autonomy",
    items: [
      { id: "visioncortex", label: "Vision Cortex", icon: Eye },
    ],
  },
];

const PAGE_META = {
  overview: { title: "System Overview", subtitle: "Platform health and key metrics at a glance" },
  subscriptions: { title: "Subscriptions", subtitle: "View and manage all user subscription plans" },
  phone: { title: "Phone & Proxies", subtitle: "Proxy IP addresses and phone numbers for verification" },
  apikeys: { title: "API Keys", subtitle: "Generate keys with role-based access and function-level scopes" },
  promos: { title: "Promo Codes", subtitle: "Create and manage promotional codes for plan upgrades" },
  visioncortex: { title: "Vision Cortex", subtitle: "Bidirectional autonomous system operator" },
  users: { title: "User Management", subtitle: "Create accounts, manage roles, and preview dashboards" },
  team: { title: "Team", subtitle: "Invite members and manage access" },
};

export default function AdminPortal() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);


  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const handler = (e) => { if (e.detail) setActiveTab(e.detail); };
    window.addEventListener("admin-tab-change", handler);
    return () => window.removeEventListener("admin-tab-change", handler);
  }, []);

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121214]">
        <div className="w-8 h-8 border-4 border-[#754313] border-t-[#ff8800] rounded-full animate-spin" />
      </div>
    );
  }

  const meta = PAGE_META[activeTab] || PAGE_META.overview;

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    navigate("/login");
  };

  const SidebarContent = () => (
    <>
      <div className="px-5 py-5 border-b border-[#34363a]">
        <BrandLockup compact subtitle="Admin Portal" />
      </div>

      <nav className="flex-1 overflow-y-auto xa-scroll px-3 py-4 space-y-6">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <div className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-[#777d83]">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map(item => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                      active
                        ? "bg-[#ff8800] text-[#171514] shadow-lg shadow-[#ff8800]/20"
                        : "text-[#b5b8bc] hover:text-[#e7e8e9] hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-[#34363a]">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-[#191a1c]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#b95700] to-[#ff8800] flex items-center justify-center text-[#171514] font-bold text-sm shrink-0">
            {(user.full_name || user.email || "A")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#e7e8e9] truncate">{user.full_name || "Admin"}</div>
            <div className="text-[11px] text-[#777d83] truncate">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-[#777d83] hover:text-[#e7e8e9] hover:bg-white/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#121214] flex">
      <aside className="hidden md:flex w-60 xl:w-64 flex-col bg-[#161619] fixed inset-y-0 left-0 z-40 border-r border-[#34363a]">
        <SidebarContent />
      </aside>

      {sidebarOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 flex-col bg-[#161619] flex border-r border-[#34363a]">
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close admin navigation"
              className="absolute top-4 right-4 p-1.5 rounded-md text-[#b5b8bc] hover:text-[#e7e8e9] hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </aside>
        </>
      )}

      <div className="flex-1 md:ml-60 xl:ml-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-[#161619]/80 backdrop-blur-lg border-b border-[#34363a]">
          <div className="px-4 md:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open admin navigation"
                className="md:hidden p-2 rounded-md hover:bg-white/5 text-[#b5b8bc]"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-[#e7e8e9] leading-tight truncate font-heading">{meta.title}</h1>
                <p className="text-xs text-[#9ca3af] truncate hidden sm:block">{meta.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">

              <Button variant="ghost" size="sm" onClick={handleRefresh} aria-label="Refresh current section" className="text-[#9ca3af] hover:bg-white/5">
                <RefreshCw className="w-4 h-4" />
              </Button>
              <NotificationBell />
              <div className="hidden sm:block w-px h-6 bg-[#34363a]" />
              <Button variant="outline" size="sm" onClick={() => navigate("/command-center")} className="hidden xl:flex border-[#34363a] text-[#b5b8bc] hover:bg-white/5 hover:text-[#e7e8e9]">
                <Sparkles className="w-4 h-4 mr-1.5 text-[#ff8800]" /> Command Center
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="border-[#34363a] text-[#b5b8bc] hover:bg-white/5 hover:text-[#e7e8e9]">
                <ArrowLeft className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Back to App</span>
              </Button>
            </div>
          </div>
          <div className="h-0.5 bg-gradient-to-r from-[#b95700] via-[#ff8800] to-[#c96708]" />
        </header>

        <main className="carbon-workspace flex-1 p-4 lg:p-7 xl:p-8 max-w-screen-2xl w-full mx-auto">
          {activeTab === "overview" && <AdminOverview key={`ov-${refreshKey}`} />}
          {activeTab === "subscriptions" && <AdminSubscriptions key={`sub-${refreshKey}`} />}
          {activeTab === "phone" && <AdminPhoneNumbers key={`ph-${refreshKey}`} />}
          {activeTab === "apikeys" && <AdminApiKeys key={`ak-${refreshKey}`} />}
          {activeTab === "promos" && <AdminPromos key={`pr-${refreshKey}`} />}
          {activeTab === "visioncortex" && <AdminVisionCortex key={`vc-${refreshKey}`} />}
          {activeTab === "users" && <AdminUsers key={`us-${refreshKey}`} />}
          {activeTab === "team" && <AdminTeam key={`tm-${refreshKey}`} />}
        </main>
      </div>
    </div>
  );
}