import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, Phone, Mail, MapPin, Globe2, AlertCircle, User } from "lucide-react";

/**
 * Dialog for a skip-trace lookup on a name or address.
 * Results are candidate leads unless this view displays traceable source evidence.
 */
export default function EntitySearchDialog({ open, onOpenChange, query, type = "name" }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !query) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResults(null);
    (async () => {
      try {
        const response = await base44.functions.invoke("runSkipTraceFallback", {
          owner_name: query,
          deep_search: true,
        });
        if (cancelled) return;
        const data = response.data || response;
        if (data.error) setError(data.error);
        else setResults(data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Skip-Trace Lookup
          </DialogTitle>
          <DialogDescription>
            Searching for <span className="font-medium text-foreground">{query}</span>
            {type === "address" ? " (address lookup)" : " (person lookup)"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking available sources permitted for this workflow...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Search Error</p>
              <p className="text-xs">{error}</p>
            </div>
          </div>
        )}

        {results && !loading && !error && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900">
              <p className="font-semibold">Unverified leads — review required</p>
              <p className="text-xs mt-1">This view does not establish source provenance or verify identity, contact ownership, or property ownership. Treat displayed values as leads until checked against traceable source records.</p>
            </div>
            {results.found_owner_name && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Possible owner match: {results.found_owner_name}</span>
                {results.confidence_score != null && (
                  <Badge variant="outline" className="ml-auto">{results.confidence_score}% reported confidence (not verification)</Badge>
                )}
              </div>
            )}

            {results.phone_numbers?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Candidate Phone Numbers ({results.phone_numbers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {results.phone_numbers.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Phone className="w-3 h-3 mr-1" />{p.number || p.phone}
                      {p.confidence != null && <span className="text-muted-foreground ml-1">({p.confidence}%)</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {results.emails?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Candidate Emails ({results.emails.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {results.emails.map((e, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Mail className="w-3 h-3 mr-1" />{e.email || e.address}
                      {e.confidence != null && <span className="text-muted-foreground ml-1">({e.confidence}%)</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {results.addresses?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Candidate Addresses ({results.addresses.length})
                </p>
                <div className="space-y-1">
                  {results.addresses.map((a, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />{a.address || a}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {results.social_profiles?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Globe2 className="w-3 h-3" /> Candidate Social Profiles ({results.social_profiles.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {results.social_profiles.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border hover:border-primary/40 hover:text-primary transition-colors text-xs">
                      <Globe2 className="w-3 h-3" />{s.platform}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {results.notes && (
              <div className="p-3 rounded-md bg-muted/50">
                <p className="text-xs text-muted-foreground">{results.notes}</p>
              </div>
            )}

            {!results.found_owner_name && !results.phone_numbers?.length && !results.emails?.length &&
             !results.addresses?.length && !results.social_profiles?.length && (
              <p className="text-sm text-muted-foreground text-center py-8">No results found for this search.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}