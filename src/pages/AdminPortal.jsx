import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, CreditCard, Phone, Key, Ticket, Eye, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminPhoneNumbers from "@/components/admin/AdminPhoneNumbers";
import AdminApiKeys from "@/components/admin/AdminApiKeys";
import AdminPromos from "@/components/admin/AdminPromos";
import AdminVisionCortex from "@/components/admin/AdminVisionCortex";

const LOGO_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "phone", label: "Phone Numbers", icon: Phone },
  { id: "apikeys", label: "API Keys", icon: Key },
  { id: "promos", label: "Promos", icon: Ticket },
  { id: "visioncortex", label: "Vision Cortex", icon: Eye },
];

export default function AdminPortal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [isAdmin, setIsAdmin] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u || u.role !== "admin") {
        navigate("/", { replace: true });
      } else {
        setIsAdmin(true);
      }
    }).catch(() => navigate("/"));
  }, [navigate]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={LOGO_URL} alt="XTREME SCRAPER" className="w-9 h-9 shrink-0" fittingType="fit" />
            <div>
              <span className="font-heading font-bold text-lg block leading-tight">XTREME SCRAPER</span>
              <span className="text-xs text-muted-foreground">Admin Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to App
            </Button>
          </div>
        </div>
      </header>

      {/* Gold accent bar */}
      <div className="h-1 bg-gold-gradient" />

      {/* Tabs */}
      <div className="border-b border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? "border-amber-500 text-amber-700"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {activeTab === "overview" && <AdminOverview key={`ov-${refreshKey}`} />}
        {activeTab === "subscriptions" && <AdminSubscriptions key={`sub-${refreshKey}`} />}
        {activeTab === "phone" && <AdminPhoneNumbers key={`ph-${refreshKey}`} />}
        {activeTab === "apikeys" && <AdminApiKeys key={`ak-${refreshKey}`} />}
        {activeTab === "promos" && <AdminPromos key={`pr-${refreshKey}`} />}
        {activeTab === "visioncortex" && <AdminVisionCortex key={`vc-${refreshKey}`} />}
      </div>
    </div>
  );
}