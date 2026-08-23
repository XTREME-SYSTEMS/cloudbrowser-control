import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Triangle, Github, HardDrive, Database, Sparkles, Shield, Zap, ArrowRight, Calendar, FileText, CheckSquare, Mail, Table } from "lucide-react";
import IntegrationCard from "@/components/connection-wizard/IntegrationCard";
import ConnectModal from "@/components/connection-wizard/ConnectModal";

const AVAILABLE = [
  { service_type: "googledrive", name: "Google Drive", description: "Sync files and documents, browse folders, and manage Drive content.", icon: HardDrive, connection_mode: "app_user", connector_id: "69db1e5e75a5f8c15c80cf34" },
  { service_type: "googlecalendar", name: "Google Calendar", description: "View, create, and manage calendar events and schedules.", icon: Calendar, connection_mode: "app_user", connector_id: "69ddcb305a599e0b4a1b3cff" },
  { service_type: "gmail", name: "Gmail", description: "Send emails, read inbox, and manage email threads.", icon: Mail, connection_mode: "app_user", connector_id: "69db200274332486fd28dd7e" },
  { service_type: "googlesheets", name: "Google Sheets", description: "Read and write spreadsheet data, sync tables, and automate data entry.", icon: Table, connection_mode: "app_user", connector_id: "69db1fad3c50db37ad0ce8dd" },
  { service_type: "googledocs", name: "Google Docs", description: "Create, read, and edit documents and sync content.", icon: FileText, connection_mode: "app_user", connector_id: "69ddcb7e5d965b5605cd24b4" },
  { service_type: "googletasks", name: "Google Tasks", description: "Manage task lists and to-do items synced with Google.", icon: CheckSquare, connection_mode: "app_user", connector_id: "69db201897e4e8f9ae073be7" },
  { service_type: "supabase", name: "Supabase", description: "Read and write database schemas, run SQL, and sync table data.", icon: Database, connection_mode: "app_user", connector_id: "69e521c8418f5cecefb2567c" },
  { service_type: "vercel", name: "Vercel", description: "Deploy and manage web apps, trigger builds, and sync deployment status.", icon: Triangle, connection_mode: "secret" },
];

export default function ConnectionWizard() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalIntegration, setModalIntegration] = useState(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      const list = await base44.entities.Integration.list("-created_date", 50);
      setIntegrations(list);
    } catch { setIntegrations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const handleConnect = (integration) => setModalIntegration(integration);

  const handleDisconnect = async (integration) => {
    if (integration.connection_mode === "app_user" && integration.connector_id) {
      try { await base44.connectors.disconnectAppUser(integration.connector_id); } catch { /* may not be connected */ }
    }
    await base44.entities.Integration.update(integration.id, { status: "disconnected", has_credentials: false });
    fetchIntegrations();
  };

  const getStatus = (serviceType) => {
    const record = integrations.find((i) => i.service_type === serviceType);
    return record?.status || "pending";
  };

  const getLastSynced = (serviceType) => {
    const record = integrations.find((i) => i.service_type === serviceType);
    return record?.last_synced ? new Date(record.last_synced).toLocaleDateString() : "";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Connection Wizard</h1>
        <p className="text-muted-foreground mt-1">Connect Cloud Browser to external systems — step by step, AI-assisted.</p>
      </div>

      {/* AI Assist banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">AI-Assisted Setup</p>
            <p className="text-xs text-muted-foreground">Need help connecting? Ask the autonomous agent to guide you or set it up automatically.</p>
          </div>
          <Link to="/ai-chat">
            <Button size="sm">Ask AI <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </CardContent>
      </Card>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Shield className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">Secure</p><p className="text-xs text-muted-foreground">AES-GCM encrypted credentials</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Zap className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">Auto-Sync</p><p className="text-xs text-muted-foreground">Real-time data synchronization</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Sparkles className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">Agent-Ready</p><p className="text-xs text-muted-foreground">AI can use all connections</p></div></CardContent></Card>
      </div>

      {/* Available integrations */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Available Integrations</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE.map((int) => (
              <IntegrationCard
                key={int.service_type}
                name={int.name}
                description={int.description}
                icon={int.icon}
                status={getStatus(int.service_type)}
                lastSynced={getLastSynced(int.service_type)}
                onConnect={() => handleConnect(int)}
                onDisconnect={() => {
                  const record = integrations.find((i) => i.service_type === int.service_type);
                  if (record) handleDisconnect({ ...record, connection_mode: int.connection_mode, connector_id: int.connector_id });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ConnectModal
        integration={modalIntegration}
        onClose={() => setModalIntegration(null)}
        onConnected={fetchIntegrations}
      />
    </div>
  );
}