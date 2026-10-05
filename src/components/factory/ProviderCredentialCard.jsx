import React, { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Save, Eye, EyeOff } from "lucide-react";

export default function ProviderCredentialCard({ provider, icon: Icon, color, fields, onSave, savedValues }) {
  const [values, setValues] = useState(() => {
    const init = {};
    for (const f of fields) init[f.key] = savedValues?.[f.key] || "";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showSecrets, setShowSecrets] = useState({});

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const toggleSecret = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(values);
      setSaved(true);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = fields.every((f) => values[f.key]);

  return (
    <div className="xa-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-black">{provider.name}</h3>
          <p className="text-xs text-black/50">{provider.description}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shrink-0 ${isConfigured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {isConfigured ? <><CheckCircle2 className="w-3 h-3" /> Ready</> : <><AlertCircle className="w-3 h-3" /> Needs setup</>}
        </span>
      </div>

      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-semibold text-black/70 mb-1 block">{f.label}{f.required !== false && <span className="text-red-500">*</span>}</label>
            <div className="relative">
              {f.type === "textarea" ? (
                <textarea
                  value={values[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={4}
                  className="xa-input font-mono text-xs resize-y"
                  style={f.secret && !showSecrets[f.key] ? { WebkitTextSecurity: "disc" } : {}}
                />
              ) : (
                <input
                  type={f.secret && !showSecrets[f.key] ? "password" : "text"}
                  value={values[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="xa-input font-mono text-xs"
                />
              )}
              {f.secret && (
                <button
                  type="button"
                  onClick={() => toggleSecret(f.key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
                >
                  {showSecrets[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            {f.hint && <p className="text-[10px] text-black/40 mt-1">{f.hint}</p>}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4">
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : saved ? (
          <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</p>
        ) : (
          <p className="text-xs text-black/40">Credentials stored securely as admin settings</p>
        )}
        <button onClick={handleSave} disabled={saving} className="xa-btn-primary text-xs px-4 py-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save credentials"}
        </button>
      </div>
    </div>
  );
}