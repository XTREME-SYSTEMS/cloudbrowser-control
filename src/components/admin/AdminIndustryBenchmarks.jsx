import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Info } from "lucide-react";
import BenchmarkCard from "@/components/benchmarks/BenchmarkCard";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "professional_standard", label: "Professional Standards" },
  { id: "evidentiary_standard", label: "Evidentiary Standards" },
  { id: "qa_validation_method", label: "QA & Validation" },
  { id: "compliance_requirement", label: "Compliance" },
  { id: "competitor_benchmark", label: "Competitors" },
  { id: "business_model", label: "Business Model" },
];

const LIMIT = 200;

export default function AdminIndustryBenchmarks() {
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    base44.entities.IndustryBenchmark
      .filter(category === "all" ? {} : { category }, { sort: "display_order", limit: LIMIT })
      .then((page) => {
        if (!cancelled) setItems(page?.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="text-foreground font-medium mb-1">
            The standard the system is held to, and where it still falls short.
          </p>
          Every entry below is quoted from a named authority and carries its own source link. Entries
          marked <span className="text-muted-foreground">Vendor claim — unverified</span> are a
          competitor's own marketing and are recorded as such, not as fact. Nothing here is a legal
          opinion.
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-display transition-all border ${
              category === c.id
                ? "bg-primary/10 text-primary border-primary/30"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No benchmarks recorded in this category yet.
        </p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((b) => (
            <BenchmarkCard key={b.id} benchmark={b} />
          ))}
        </div>
      )}
    </div>
  );
}