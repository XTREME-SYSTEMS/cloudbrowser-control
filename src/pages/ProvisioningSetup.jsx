import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Database, Cloud, Train, Globe, ShieldCheck, Rocket } from "lucide-react";
import ProviderCredentialCard from "@/components/factory/ProviderCredentialCard";

const PROVIDERS = [
  {
    key: "supabase",
    name: "Supabase",
    description: "Backend database & auth for deployed sites",
    icon: Database,
    color: "#16A34A",
    fields: [
      { key: "project_url", label: "Project URL", placeholder: "https://xxxxx.supabase.co", hint: "Found in Supabase Dashboard → Project Settings → API" },
      { key: "service_role_key", label: "Service Role Key", secret: true, placeholder: "eyJhbGciOi…", hint: "Project Settings → API → service_role key" },
      { key: "anon_key", label: "Anon Key", secret: true, placeholder: "eyJhbGciOi…", hint: "Project Settings → API → anon public key", required: false },
    ],
  },
  {
    key: "vercel",
    name: "Vercel",
    description: "Frontend hosting & deployments",
    icon: Cloud,
    color: "#000000",
    fields: [
      { key: "api_token", label: "API Token", secret: true, placeholder: "vercel_xxx…", hint: "Vercel → Settings → Tokens → Create Token" },
      { key: "team_id", label: "Team ID", placeholder: "team_xxx", hint: "Vercel → Settings → General → Team ID", required: false },
    ],
  },
  {
    key: "railway",
    name: "Railway",
    description: "Worker hosting & 24/7 background jobs",
    icon: Train,
    color: "#7C3AED",
    fields: [
      { key: "api_token", label: "API Token", secret: true, placeholder: "railway_xxx…", hint: "Railway → Account Settings → API Tokens" },
      { key: "environment_id", label: "Environment ID", placeholder: "env_xxx", hint: "Railway → Project → Settings → Environment", required: false },
    ],
  },
  {
    key: "google_cloud",
    name: "Google Cloud",
    description: "Infrastructure & service accounts",
    icon: Globe,
    color: "#2563EB",
    fields: [
      { key: "project_id", label: "Project ID", placeholder: "my-project-123", hint: "Google Cloud Console → project selector" },
      { key: "service_account_json", label: "Service Account JSON", secret: true, type: "textarea", placeholder: '{ "type": "service_account", … }', hint: "IAM → Service Accounts → Create Key → JSON" },
    ],
  },
];

export default function ProvisioningSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savedValues, setSavedValues] = useState({});
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.Setting.filter(
        { category: "integrations", setting_key: { $regex: "^provisioning\\." } },
        { sort: "-created_date", limit: 100 }
      );
      const items = page?.items || [];
      const grouped = {};
      for (const s of items) {
        const providerKey = s.setting_key.replace("provisioning.", "").split(".")[0];
        if (!grouped[providerKey]) grouped[providerKey] = {};
        const fieldKey = s.setting_key.split(".").slice(2).join(".");
        try {
          grouped[providerKey][fieldKey] = JSON.parse(s.desired_value || "''");
        } catch {
          grouped[providerKey][fieldKey] = s.desired_value || "";
        }
      }
      setSavedValues(grouped);
    } catch (e) {
      setError("Failed to load: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveProvider = async (providerKey, values) => {
    for (const [fieldKey, value] of Object.entries(values)) {
      const settingKey = `provisioning.${providerKey}.${fieldKey}`;
      const existing = await base44.entities.Setting.filter({ setting_key: settingKey }, { limit: 1 });
      const items = existing?.items || [];
      const payload = {
        setting_key: settingKey,
        category: "integrations",
        scope_type: "platform",
        desired_value: JSON.stringify(value),
        sensitive: true,
        operator_editable: true,
        apply_status: "pending",
        changed_at: new Date().toISOString(),
      };
      if (items.length > 0) {
        await base44.entities.Setting.update(items[0].id, payload);
      } else {
        await base44.entities.Setting.create(payload);
      }
    }
  };

  const configuredCount = PROVIDERS.filter((p) => {
    const vals = savedValues[p.key] || {};
    return p.fields.filter((f) => f.required !== false).every((f) => vals[f.key]);
  }).length;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">PROVISIONING</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Infrastructure Credentials</h1>
            <p className="text-xs text-black/50 mt-0.5">Connect Supabase, Vercel, Railway & Google Cloud so the factory can provision everything.</p>
          </div>
          <button onClick={() => navigate("/website-factory")} className="xa-btn-outline text-xs px-3 py-2 shrink-0">← Factory</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="xa-card p-4 flex items-center gap-3 bg-[#FFF7B3]/30 border-[#E6D400]/30">
          <ShieldCheck className="w-5 h-5 text-[#8A7300] shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-sm text-black">{configuredCount} of {PROVIDERS.length} providers ready</div>
            <div className="text-xs text-black/50">All credentials are stored as sensitive admin settings — only visible to admins.</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-black/30" /></div>
        ) : (
          PROVIDERS.map((p) => (
            <ProviderCredentialCard
              key={p.key}
              provider={p}
              icon={p.icon}
              color={p.color}
              fields={p.fields}
              savedValues={savedValues[p.key]}
              onSave={(values) => saveProvider(p.key, values)}
            />
          ))
        )}

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <button
          onClick={() => navigate("/website-factory")}
          disabled={loading}
          className="xa-btn-primary w-full py-4 text-base"
        >
          <Rocket className="w-5 h-5" />
          {configuredCount === PROVIDERS.length ? "All ready — go to Website Factory" : "Save & go to Website Factory"}
        </button>
      </main>
    </div>
  );
}