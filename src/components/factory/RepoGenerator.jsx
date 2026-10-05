import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Github, ExternalLink } from "lucide-react";

export default function RepoGenerator({ onCreated }) {
  const [repoName, setRepoName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const create = async () => {
    if (!repoName.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runRepoGenerator", { repo_name: repoName, description });
      setResult(res.data || res);
      if (onCreated) onCreated(res.data || res);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Github className="w-5 h-5 text-[#8A7300]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">GitHub Repo Generator</h2>
          <p className="text-xs text-black/50">Auto-create repos from your templates</p>
        </div>
      </div>

      <div className="space-y-3">
        <input className="xa-input" placeholder="Repo name (e.g. dental-site-001)" value={repoName} onChange={e => setRepoName(e.target.value)} />
        <input className="xa-input" placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
        <button onClick={create} disabled={loading || !repoName.trim()} className="xa-btn-primary w-full">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating repo…</> : <><Github className="w-4 h-4" /> Create GitHub repo</>}
        </button>
        {error && <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
        {result && result.repo_url && (
          <a href={result.repo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-xs font-bold text-green-700">
            <ExternalLink className="w-3.5 h-3.5" /> {result.repo_url}
          </a>
        )}
        {result && result.needs_auth && (
          <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-700">
            ⚠ GitHub connector not authorized. Authorize it from the Integration Stack below, then retry.
          </div>
        )}
      </div>
    </section>
  );
}