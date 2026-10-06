import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, Globe, CheckCircle2, ShoppingCart, DollarSign } from "lucide-react";

const TLDS = ["com", "net", "org", "store", "online", "site", "blog", "co", "io", "ai", "tech", "biz", "xyz"];

export default function DomainDiscovery({ onDiscovered }) {
  const [keywords, setKeywords] = useState("");
  const [selectedTlds, setSelectedTlds] = useState(["com", "net", "store", "online"]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prices, setPrices] = useState({});
  const [priceLoading, setPriceLoading] = useState({});
  const [buying, setBuying] = useState({});
  const [buyResults, setBuyResults] = useState({});

  const toggleTld = (t) => setSelectedTlds(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const discover = async () => {
    if (!keywords.trim()) return;
    setLoading(true); setError(null); setResults(null); setPrices({}); setBuyResults({});
    try {
      const res = await base44.functions.invoke("runDomainDiscovery", { keywords, tlds: selectedTlds.join(",") });
      setResults(res.data || res);
      if (onDiscovered) onDiscovered(res.data || res);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const checkPrice = async (domain) => {
    setPriceLoading(prev => ({ ...prev, [domain]: true }));
    try {
      const res = await base44.functions.invoke("runDomainBuyer", { domain, buy: false });
      const data = res.data || res;
      if (data.available) setPrices(prev => ({ ...prev, [domain]: data.price }));
      else setPrices(prev => ({ ...prev, [domain]: "unavailable" }));
    } catch (e) { setPrices(prev => ({ ...prev, [domain]: "error" })); }
    setPriceLoading(prev => ({ ...prev, [domain]: false }));
  };

  const buyDomain = async (domain) => {
    setBuying(prev => ({ ...prev, [domain]: true }));
    try {
      const res = await base44.functions.invoke("runDomainBuyer", { domain, buy: true });
      const data = res.data || res;
      setBuyResults(prev => ({ ...prev, [domain]: data }));
      if (data.bought) setPrices(prev => ({ ...prev, [domain]: "bought" }));
    } catch (e) { setBuyResults(prev => ({ ...prev, [domain]: { error: e.message } })); }
    setBuying(prev => ({ ...prev, [domain]: false }));
  };

  const buyAll = async () => { for (const d of (results?.available_domains || []).slice(0, 10)) { await buyDomain(d); } };
  const checkAllPrices = async () => { await Promise.all((results?.available_domains || []).slice(0, 20).map(d => checkPrice(d))); };

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Globe className="w-5 h-5 text-[#8A7300]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">Domain Discovery & Buyer</h2>
          <p className="text-xs text-black/50">Discover across all TLDs · live GoDaddy pricing · one-click buy</p>
        </div>
      </div>

      <div className="space-y-3">
        <input className="xa-input" placeholder="Keywords: dental, plumber, lawyer, restaurant…" value={keywords} onChange={e => setKeywords(e.target.value)} />

        <div className="flex flex-wrap gap-1.5">
          {TLDS.map(t => (
            <button key={t} onClick={() => toggleTld(t)}
              className={`px-2.5 py-1.5 rounded-md border text-xs font-bold transition-colors ${selectedTlds.includes(t) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:border-primary/50'}`} aria-pressed={selectedTlds.includes(t)}>
              .{t}
            </button>
          ))}
        </div>

        <button onClick={discover} disabled={loading || !keywords.trim()} className="xa-btn-primary w-full">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Discovering…</> : <><Search className="w-4 h-4" /> Discover domains</>}
        </button>

        {error && <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

        {results && (
          <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-black/60">{results.available_count || 0} available of {results.candidates_checked || 0} checked</div>
              <div className="flex gap-1.5">
                <button onClick={checkAllPrices} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#FFF7B3] text-[#8A7300]"><DollarSign className="w-3 h-3 inline" /> Check all prices</button>
                <button onClick={buyAll} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-black text-white"><ShoppingCart className="w-3 h-3 inline" /> Buy all</button>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto xa-scroll">
              {(results.available_domains || []).slice(0, 30).map(d => {
                const price = prices[d];
                const isLoadingPrice = priceLoading[d];
                const isBuying = buying[d];
                const buyRes = buyResults[d];
                return (
                  <div key={d} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="font-mono text-black truncate flex-1 min-w-0">{d}</span>
                    {price === "bought" ? (
                      <span className="text-[10px] font-bold text-green-600 shrink-0">✓ BOUGHT</span>
                    ) : price && price !== "unavailable" && price !== "error" ? (
                      <>
                        <span className="font-bold text-black shrink-0">{price}</span>
                        <button onClick={() => buyDomain(d)} disabled={isBuying} className="xa-btn-primary text-[10px] px-2 py-1 shrink-0">
                          {isBuying ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />} Buy
                        </button>
                      </>
                    ) : price === "unavailable" ? (
                      <span className="text-[10px] text-red-500 shrink-0">taken</span>
                    ) : (
                      <button onClick={() => checkPrice(d)} disabled={isLoadingPrice} className="text-[10px] font-bold text-[#CCBB00] hover:underline shrink-0">
                        {isLoadingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : "check price"}
                      </button>
                    )}
                    {buyRes?.error && <span className="text-[9px] text-red-400 shrink-0">failed</span>}
                  </div>
                );
              })}
            </div>
            {buyResults && Object.values(buyResults).some(r => r?.needs_setup) && (
              <div className="mt-2 p-2 rounded-lg bg-orange-50 border border-orange-200 text-[10px] text-orange-700">⚠ GoDaddy API keys not set. Add them in Secrets to enable purchasing.</div>
            )}
            {buyResults && Object.values(buyResults).some(r => r?.needs_contact) && (
              <div className="mt-2 p-2 rounded-lg bg-orange-50 border border-orange-200 text-[10px] text-orange-700">⚠ No registrar profile found. Create one with your contact info to purchase domains.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}