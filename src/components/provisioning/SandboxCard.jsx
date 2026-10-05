import React from "react";
import { Database, Cloud, Train, HardDrive, Github, CheckCircle2, AlertCircle, Loader2, ExternalLink, XCircle } from "lucide-react";

const PROVIDER_META = {
  supabase: { name: "Supabase", icon: Database, color: "#16A34A", label: "Database project" },
  railway: { name: "Railway", icon: Train, color: "#7C3AED", label: "Worker service" },
  googledrive: { name: "Google Drive", icon: HardDrive, color: "#2563EB", label: "Asset folder" },
  github: { name: "GitHub", icon: Github, color: "#000000", label: "Source repo" },
};

export default function SandboxCard({ sandbox, onApprove, onReject, promoting }) {
  const meta = PROVIDER_META[sandbox.provider] || { name: sandbox.provider, icon: Cloud, color: "#666", label: "" };
  const Icon = meta.icon;

  const statusConfig = {
    pending: { color: "#9CA3AF", bg: "#F3F4F6", label: "Pending" },
    creating: { color: "#2563EB", bg: "#DBEAFE", label: "Creating" },
    active: { color: "#16A34A", bg: "#DCFCE7", label: "Active — awaiting approval" },
    approved: { color: "#16A34A", bg: "#DCFCE7", label: "Approved" },
    promoted: { color: "#8A7300", bg: "#FFF7B3", label: "Promoted to production" },
    failed: { color: "#DC2626", bg: "#FEE2E2", label: "Failed" },
  };
  const sc = statusConfig[sandbox.status] || statusConfig.pending;

  return (
    <div className="xa-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${meta.color}15` }}>
        <Icon className="w-5 h-5" style={{ color: meta.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-black truncate">{meta.name}</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ color: sc.color, background: sc.bg }}>
            {sc.label}
          </span>
        </div>
        <div className="text-xs text-black/50 truncate">{sandbox.project_name}</div>
        {sandbox.external_url && (
          <a href={sandbox.external_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 mt-0.5">
            <ExternalLink className="w-2.5 h-2.5" /> {sandbox.external_url}
          </a>
        )}
        {sandbox.error && <div className="text-[10px] text-red-600 mt-0.5">{sandbox.error}</div>}
        {sandbox.status === "promoted" && sandbox.production_url && (
          <a href={sandbox.production_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-green-700 hover:underline flex items-center gap-0.5 mt-0.5">
            <ExternalLink className="w-2.5 h-2.5" /> Production: {sandbox.production_url}
          </a>
        )}
      </div>

      <div className="shrink-0">
        {sandbox.status === "active" && sandbox.approval_status === "pending" && (
          <div className="flex gap-1.5">
            <button onClick={() => onReject(sandbox.id)} disabled={promoting} className="p-2 rounded-lg border border-[#E5E7EB] text-black/50 hover:text-red-600 hover:border-red-300 transition-colors" title="Reject">
              <XCircle className="w-4 h-4" />
            </button>
            <button onClick={() => onApprove(sandbox.id)} disabled={promoting} className="xa-btn-primary text-xs px-3 py-2" title="Approve for production">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
          </div>
        )}
        {sandbox.status === "approved" && (
          <span className="text-[10px] text-green-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
        )}
        {sandbox.status === "promoted" && (
          <span className="text-[10px] text-[#8A7300] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Live</span>
        )}
        {sandbox.status === "creating" && (
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
        )}
        {sandbox.status === "failed" && (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
    </div>
  );
}