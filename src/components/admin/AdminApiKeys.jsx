import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Key, Plus, Copy, Check, Trash2, ShieldCheck, Crown, User, Wrench, Eye,
  ChevronDown, ChevronRight, Zap,
} from "lucide-react";

const ROLES = [
  { id: "admin", label: "Admin", icon: Crown, color: "text-amber-600 bg-amber-100", desc: "Full system access — all functions, all entities" },
  { id: "user", label: "User", icon: User, color: "text-blue-600 bg-blue-100", desc: "Standard user — sessions, jobs, scraping" },
  { id: "service", label: "Service", icon: Wrench, color: "text-purple-600 bg-purple-100", desc: "Service account — automated integrations" },
  { id: "vision_cortex", label: "Vision Cortex", icon: Eye, color: "text-emerald-600 bg-emerald-100", desc: "Autonomous operator — full bidirectional system control" },
];

const FUNCTION_CATEGORIES = {
  "Infrastructure & Healing": [
    "runAutonomousAudit", "preflightHeal", "railwayAutoHeal", "engineHealth",
    "railwayAction", "railwayMirror", "getDeploymentStatus", "updateEngineConfig",
    "managePool", "selfHealSelector", "recoverOrphans", "reapExpired", "intelligentRetry",
  ],
  "Validation & Testing": [
    "runFullValidation", "validateCapabilities", "validateSecurity", "validateReliability",
    "validateEnhancements", "runAllCapabilityTests", "runComprehensiveScore",
    "runTestSuite", "runMasterReleaseSuite", "runScaleParitySuite",
    "runTenantIsolationTests", "runDeployedTenantIsolationTests",
  ],
  "Browser & Sessions": [
    "runJob", "engineAction", "resumeSession", "saveProfile", "saveProxy", "testProxy",
  ],
  "Sandbox & Agents": [
    "provisionSandbox", "sandboxManager", "createProject", "aiBuildSteps", "processOnboardingAnswers",
  ],
  "Clone & Deploy": [
    "cloneFullSite", "runDeepClonePipeline", "siteAudit", "diffScreenshots",
    "reconstructBackend", "provisionCloneDeployment", "vercelApi",
  ],
  "Intelligence & Brain": [
    "ingestIntelligence", "followTheMoney", "runIntelligenceCycle",
    "visionCortexSelfReflect", "processBrainCommands", "syncToBrain",
    "testBrainConnection", "agentBrainChat", "receiveBrainCommand", "runDataMonetizationCycle",
  ],
  "Captcha": ["testCaptchaSolver", "solveCaptchaVision"],
  "MCP & Integrations": ["generateMcpConfig", "mcpTools"],
  "Billing & Costs": [
    "calculateCost", "estimateCost", "forecastCost", "generateInvoice", "checkBudget", "detectAnomalies",
  ],
  "Admin & System": [
    "createApiKey", "managePromo", "reconcileSettings", "checkSchedules", "runScheduledJob",
    "exportResults", "getMetrics", "getObservabilityMetrics", "logAudit", "sendNotification",
    "triggerWebhook", "receiveWebhook", "saveWebhook", "checkCompliance", "migrateSecrets",
    "serpMeasurement", "runRealSiteTest", "getCapabilityMatrix", "apiGateway", "cloudBrowserGatewayV6",
  ],
  "Staging": [
    "runStagingTestSuite", "runStagingMasterSuite", "runStagingCredentialContract",
    "runStagingMcpBlackBox", "runStagingJobBlackBox", "runStagingContextBlackBox",
    "runJobStaging", "cloudBrowserGatewayStaging",
  ],
};

const SCOPE_OPTIONS = [
  "sessions:read", "sessions:write", "jobs:read", "jobs:write",
  "scrape:run", "clone:run", "agent:run", "sandbox:manage",
  "admin:all", "vision_cortex:operate", "billing:manage", "promos:manage",
];

const PRESETS = [
  { name: "Vision Cortex Operator", role: "vision_cortex", external_label: "XTREME_SCRAPER_VC_KEY", scopes: ["admin:all", "vision_cortex:operate"], functions: [], desc: "Full bidirectional autonomous control" },
  { name: "Full Admin Access", role: "admin", external_label: "XTREME_SCRAPER_ADMIN_KEY", scopes: ["admin:all"], functions: [], desc: "Complete system access" },
  { name: "Service Account", role: "service", external_label: "XTREME_SCRAPER_SVC_KEY", scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write"], functions: ["runJob", "engineAction", "provisionSandbox"], desc: "Automated integrations" },
  { name: "Standard User", role: "user", external_label: "XTREME_SCRAPER_USER_KEY", scopes: ["sessions:read", "sessions:write", "scrape:run"], functions: ["runJob"], desc: "Basic user access" },
];

export default function AdminApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCats, setExpandedCats] = useState({});
  const [newKey, setNewKey] = useState({
    name: "", description: "", role: "user", external_label: "",
    scopes: ["sessions:read", "sessions:write", "scrape:run"],
    allowed_functions: [], expiresInDays: 30,
  });
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await base44.entities.ApiKey.list("-created_date", 100);
      setKeys(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleScope = (scope) => {
    setNewKey(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope) ? prev.scopes.filter(s => s !== scope) : [...prev.scopes, scope],
    }));
  };

  const toggleFunction = (fn) => {
    setNewKey(prev => ({
      ...prev,
      allowed_functions: prev.allowed_functions.includes(fn)
        ? prev.allowed_functions.filter(f => f !== fn)
        : [...prev.allowed_functions, fn],
    }));
  };

  const toggleCategory = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const selectAllInCategory = (cat, fns) => {
    setNewKey(prev => {
      const allIncluded = fns.every(fn => prev.allowed_functions.includes(fn));
      if (allIncluded) {
        return { ...prev, allowed_functions: prev.allowed_functions.filter(f => !fns.includes(f)) };
      }
      return { ...prev, allowed_functions: [...new Set([...prev.allowed_functions, ...fns])] };
    });
  };

  const applyPreset = (preset) => {
    setNewKey({
      name: preset.name,
      description: preset.desc,
      role: preset.role,
      external_label: preset.external_label,
      scopes: preset.scopes,
      allowed_functions: preset.functions || [],
      expiresInDays: 30,
    });
  };

  const handleCreate = async () => {
    if (!newKey.name.trim()) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createApiKey", {
        name: newKey.name,
        description: newKey.description,
        role: newKey.role,
        external_label: newKey.external_label,
        scopes: newKey.scopes,
        allowed_functions: newKey.allowed_functions,
        expires_in_days: newKey.expiresInDays,
      });
      const fullKey = res.data?.api_key || res.data?.key;
      if (fullKey) {
        setGeneratedKey(fullKey);
        setCopied(false);
        setShowCreate(false);
        setNewKey({ name: "", description: "", role: "user", external_label: "", scopes: ["sessions:read", "sessions:write", "scrape:run"], allowed_functions: [], expiresInDays: 30 });
        load();
      } else {
        alert("Key created but full key not returned.");
        load();
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await base44.entities.ApiKey.update(keyId, { active: false });
      load();
    } catch (e) { alert("Failed to revoke key"); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading API keys…</div>;

  const roleInfo = ROLES.find(r => r.id === newKey.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">API Key Generator</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate keys with role-based access, function-level scopes, and external system labels.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="bg-gold-gradient text-black">
          <Plus className="w-4 h-4 mr-1" /> Generate Key
        </Button>
      </div>

      {/* Generated key display */}
      {generatedKey && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm">API Key Generated — Copy Now!</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">This is the only time the full key will be shown. Store it securely.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-black/5 rounded-md text-xs font-mono break-all">{generatedKey}</code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setGeneratedKey(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="pt-5 space-y-5">
            {/* Presets */}
            <div>
              <Label className="mb-2 block">Quick Presets</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="text-left p-3 rounded-lg border border-border/50 hover:border-amber-300 hover:bg-amber-50/30 transition-colors"
                  >
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Role selector */}
            <div>
              <Label className="mb-2 block">Role</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setNewKey(prev => ({ ...prev, role: r.id }))}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-colors",
                        newKey.role === r.id ? "border-amber-400 bg-amber-50" : "border-border/50 hover:border-amber-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", r.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">{r.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name + Description */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input placeholder="e.g. Vision Cortex Admin, Production API" value={newKey.name} onChange={e => setNewKey({ ...newKey, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="What this key is used for" value={newKey.description} onChange={e => setNewKey({ ...newKey, description: e.target.value })} />
              </div>
            </div>

            {/* External Label */}
            <div className="space-y-2">
              <Label>External System Label</Label>
              <Input
                placeholder="e.g. XTREME_SCRAPER_ADMIN_KEY — what this key is called in other systems"
                value={newKey.external_label}
                onChange={e => setNewKey({ ...newKey, external_label: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">The label used when referencing this key in external systems, config files, or documentation.</p>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label>Expiration (days)</Label>
              <Input type="number" value={newKey.expiresInDays} onChange={e => setNewKey({ ...newKey, expiresInDays: Number(e.target.value) })} />
            </div>

            {/* Scopes */}
            <div className="space-y-2">
              <Label>Permission Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map(scope => (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      newKey.scopes.includes(scope)
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-transparent text-muted-foreground border-border hover:border-amber-300"
                    )}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>

            {/* Function-level scopes */}
            <div className="space-y-2">
              <Label>Allowed Backend Functions {newKey.allowed_functions.length > 0 && `(${newKey.allowed_functions.length} selected)`}</Label>
              <p className="text-xs text-muted-foreground mb-2">Leave empty to allow all functions for this role. Select specific functions to restrict access.</p>
              <div className="space-y-1 max-h-64 overflow-y-auto border border-border/50 rounded-lg p-3">
                {Object.entries(FUNCTION_CATEGORIES).map(([cat, fns]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-2 py-1">
                      <button onClick={() => toggleCategory(cat)} className="flex items-center gap-1 text-sm font-medium hover:text-amber-600">
                        {expandedCats[cat] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {cat}
                      </button>
                      <span className="text-xs text-muted-foreground">({fns.length})</span>
                      <button onClick={() => selectAllInCategory(cat, fns)} className="text-xs text-amber-600 hover:underline ml-2">
                        {fns.every(fn => newKey.allowed_functions.includes(fn)) ? "Clear" : "Select all"}
                      </button>
                    </div>
                    {expandedCats[cat] && (
                      <div className="flex flex-wrap gap-1.5 pl-5 pb-2">
                        {fns.map(fn => (
                          <button
                            key={fn}
                            onClick={() => toggleFunction(fn)}
                            className={cn(
                              "px-2 py-0.5 rounded text-xs font-mono border transition-colors",
                              newKey.allowed_functions.includes(fn)
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-transparent text-muted-foreground border-border/50 hover:border-amber-300"
                            )}
                          >
                            {fn}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newKey.name.trim()} className="bg-gold-gradient text-black">
                {creating ? "Generating…" : "Generate Key"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key list */}
      <div className="grid gap-3">
        {keys.map(k => {
          const rInfo = ROLES.find(r => r.id === k.role) || ROLES[1];
          const Icon = rInfo.icon;
          return (
            <Card key={k.id} className="border-border/50">
              <CardContent className="pt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", k.active === false ? "bg-muted" : rInfo.color)}>
                    <Icon className={cn("w-5 h-5", k.active === false && "text-muted-foreground")} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{k.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">{k.role}</Badge>
                      {k.external_label && (
                        <code className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{k.external_label}</code>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {k.key_prefix || "****"}…{k.active === false ? " (revoked)" : ""}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(k.scopes || []).slice(0, 4).map(s => (
                        <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                      ))}
                      {(k.scopes || []).length > 4 && <span className="text-xs text-muted-foreground">+{(k.scopes || []).length - 4}</span>}
                      {(k.allowed_functions || []).length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">{k.allowed_functions.length} functions</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.active !== false && k.expires_at && new Date(k.expires_at) < new Date() && (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                  )}
                  {k.active !== false && (
                    <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {keys.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No API keys yet. Generate one to get started.</div>
        )}
      </div>
    </div>
  );
}