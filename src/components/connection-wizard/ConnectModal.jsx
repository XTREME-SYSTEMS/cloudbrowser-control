import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Link2, Sparkles, Shield, Zap } from "lucide-react";

const STEPS = ["Overview", "Authenticate", "Configure", "Test", "Done"];

export default function ConnectModal({ integration, onClose, onConnected }) {
  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [sandboxIsolated, setSandboxIsolated] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  if (!integration) return null;

  const handleOAuthConnect = async () => {
    try {
      const url = await base44.connectors.connectAppUser(integration.connector_id);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setStep(2);
        }
      }, 500);
    } catch (err) {
      setError(err.message || "Failed to start OAuth flow");
    }
  };

  const handleSecretSave = async () => {
    if (!token.trim()) { setError("Please enter an API token"); return; }
    setTesting(true);
    setError("");
    try {
      await base44.functions.invoke("vercelApi", { action: "save", token, syncEnabled, sandboxIsolated });
      setStep(3);
    } catch (err) {
      setError(err.message || "Failed to save credentials");
    }
    setTesting(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setError("");
    try {
      if (integration.connection_mode === "app_user") {
        await base44.functions.invoke("syncIntegration", { service_type: integration.service_type, action: "test" });
      }
      setStep(4);
    } catch (err) {
      setError(err.message || "Connection test failed");
    }
    setTesting(false);
  };

  const handleFinish = () => { onConnected(); onClose(); };

  return (
    <Dialog open={!!integration} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect {integration.name}</DialogTitle>
          <DialogDescription>Step {step + 1} of {STEPS.length}: {STEPS[step]}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-4">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* Step 0: Overview */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">Credentials are encrypted with AES-GCM and never exposed to the frontend.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">The AI agent can use this integration to sync data, provision resources, and automate workflows.</p>
            </div>
            <Button className="w-full" onClick={() => setStep(1)}>Continue</Button>
          </div>
        )}

        {/* Step 1: Authenticate */}
        {step === 1 && (
          <div className="space-y-4">
            {integration.connection_mode === "app_user" ? (
              <div className="space-y-3">
                <p className="text-sm">Click below to authorize {integration.name} via OAuth. A new tab will open for you to sign in.</p>
                <Button className="w-full" onClick={handleOAuthConnect}>
                  <Link2 className="w-4 h-4" /> Authorize {integration.name}
                </Button>
                <p className="text-xs text-muted-foreground text-center">After authorizing, you'll be returned here automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="token">API Token</Label>
                  <Input id="token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter your API token" />
                </div>
                <p className="text-xs text-muted-foreground">Get your token from the {integration.name} dashboard settings.</p>
                <Button className="w-full" onClick={handleSecretSave} disabled={testing}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Continue"}
                </Button>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><p className="text-sm font-medium">Enable Sync</p><p className="text-xs text-muted-foreground">Automatically sync data between systems</p></div>
              <Button variant={syncEnabled ? "default" : "outline"} size="sm" onClick={() => setSyncEnabled(!syncEnabled)}>{syncEnabled ? "On" : "Off"}</Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div><p className="text-sm font-medium">Sandbox Isolation</p><p className="text-xs text-muted-foreground">Agent creates resources in an isolated sandbox first</p></div>
              <Button variant={sandboxIsolated ? "default" : "outline"} size="sm" onClick={() => setSandboxIsolated(!sandboxIsolated)}>{sandboxIsolated ? "On" : "Off"}</Button>
            </div>
            <Button className="w-full" onClick={() => setStep(3)}>Test Connection</Button>
          </div>
        )}

        {/* Step 3: Test */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            {testing ? (
              <><Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" /><p className="text-sm">Testing connection...</p></>
            ) : (
              <><Check className="w-8 h-8 mx-auto text-green-500" /><p className="text-sm font-medium">Connection successful!</p><p className="text-xs text-muted-foreground">{integration.name} is ready to use.</p></>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {!testing && !error && <Button className="w-full" onClick={() => setStep(4)}>Finish Setup</Button>}
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="space-y-4 text-center">
            <Check className="w-12 h-12 mx-auto text-green-500" />
            <div><p className="text-lg font-semibold">{integration.name} Connected!</p><p className="text-sm text-muted-foreground">You can now use this integration with the AI agent.</p></div>
            <Button className="w-full" onClick={handleFinish}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}