import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkerCommand from "@/components/factory/WorkerCommand";
import WorkerFleetManager from "@/components/factory/WorkerFleetManager";
import SystemBuilderForm from "@/components/factory/SystemBuilderForm";
import ActiveBuilds from "@/components/factory/ActiveBuilds";

export default function SystemFactory() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">SYSTEM FACTORY</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Build Anything, Autonomously</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => navigate("/batch")} className="xa-btn-primary text-xs px-3 py-2">⚡ Batch Ops</button>
            <button onClick={() => navigate("/")} className="xa-btn-outline text-xs px-3 py-2">← Center</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <WorkerCommand />
        <WorkerFleetManager />
        <SystemBuilderForm onSubmitted={() => setRefreshKey(k => k + 1)} />
        <ActiveBuilds refreshKey={refreshKey} />
      </main>
    </div>
  );
}