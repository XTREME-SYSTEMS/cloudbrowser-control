import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Globe, ExternalLink, CheckCircle, Clock, XCircle } from "lucide-react";

export default function DirectoryDiscovery() {
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  const fetchSites = useCallback(async () => {
    try {
      const page = await base44.entities.DirectorySubmission.filter({}, { sort: "-created_date", limit: 100 });
      setSites(page.items || []);
    } catch { setSites([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSites(); }, [fetchSites]);

  const handleDiscover = async () => {
    if (!industry.trim()) return;
    setDiscovering(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("discoverSubmissionSites", { industry, location, max_sites: 200 });
      setResult(res.data);
      await fetchSites();
    } catch (e) { setResult({ error: e.message }); }
    setDiscovering(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await base44.entities.DirectorySubmission.update(id, { submission_status: status, submission_date: status === "submitted" ? new Date().toISOString() : null });
      await fetchSites();
    } catch {}
  };

  const statusIcon = (status) => {
    if (status === "verified" || status === "submitted") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="xa-card">
        <h3 className="font-heading font-bold text-lg mb-1">Directory Submission Discovery</h3>
        <p className="text-sm text-muted-foreground mb-4">Finds every website where you can submit your company information — business directories, local citations, review sites, social profiles, press release sites, and more.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold mb-1">Industry *</Label>
            <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. roofing, dental, legal" className="xa-input" />
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1">Location (optional)</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Miami, FL" className="xa-input" />
          </div>
          <div className="flex items-end">
            <Button onClick={handleDiscover} disabled={discovering || !industry.trim()} className="xa-btn-primary w-full">
              {discovering ? <><Loader2 className="w-4 h-4 animate-spin" /> Discovering...</> : <><Search className="w-4 h-4" /> Find Sites</>}
            </Button>
          </div>
        </div>
        {result && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
            {result.error ? <span className="text-red-500">{result.error}</span> : <span className="text-green-600 font-medium">Discovered {result.total_discovered} sites, saved {result.saved} to database.</span>}
          </div>
        )}
      </div>

      <div className="xa-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold text-lg">Discovered Sites ({sites.length})</h3>
          <Button variant="outline" size="sm" onClick={fetchSites} disabled={loading}><Loader2 className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : sites.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No sites discovered yet. Run a discovery search above.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-auto xa-scroll">
            {sites.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                {statusIcon(s.submission_status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{s.site_name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{s.category?.replace(/_/g, " ")}</Badge>
                    {s.domain_authority > 0 && <span className="text-[10px] text-muted-foreground">DA: {s.domain_authority}</span>}
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate">
                    <Globe className="w-3 h-3 shrink-0" /> {s.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.submission_status === "discovered" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "submitted")} className="h-7 text-xs">Mark Submitted</Button>
                  )}
                  {s.submission_status === "submitted" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "verified")} className="h-7 text-xs">Verify</Button>
                  )}
                  <a href={s.signup_url || s.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-muted"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}