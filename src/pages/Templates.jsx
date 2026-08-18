import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Search, ArrowRight, ShoppingCart, LogIn, FileText, Layers, Camera, FileDown, Table, ScrollText, TrendingDown, Share2 } from "lucide-react";

const ICONS = { LogIn, ShoppingCart, FileText, Layers, Camera, FileDown, Table, ScrollText, TrendingDown, Share2, Sparkles };
const CATEGORIES = ["all", "scraping", "automation", "monitoring", "testing", "social", "ecommerce", "general"];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const navigate = useNavigate();

  useEffect(() => { base44.entities.Template.list("-created_date", 100).then(setTemplates).catch(() => {}); }, []);

  const filtered = templates.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" || t.category === category;
    return matchSearch && matchCat;
  });

  const applyTemplate = (t) => {
    sessionStorage.setItem("templateSteps", JSON.stringify(t));
    navigate("/jobs/new");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Sparkles className="w-7 h-7" />Template Library</h1>
        <p className="text-muted-foreground mt-1">Pre-built automation templates — click to use in the Job Builder</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap ${category === c ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{c}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => {
          const Icon = ICONS[t.icon] || Sparkles;
          return (
            <Card key={t.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <span className="text-xs text-muted-foreground">{t.category}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{t.description}</p>
                <p className="text-xs text-muted-foreground mb-3">{t.steps?.length || 0} steps</p>
                <Button onClick={() => applyTemplate(t)} size="sm" className="w-full"><span>Use Template</span> <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}