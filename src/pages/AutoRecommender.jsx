import React, { useState, useMemo } from "react";
import { Search, LayoutGrid, Download, Copy, Bot, SearchX, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { siteCategories } from "@/components/auto-recommender/categoriesData";
import CategoryCard from "@/components/auto-recommender/CategoryCard";

const filterOptions = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "scraper", label: "Scrape", icon: Download },
  { value: "clone_engine", label: "Clone", icon: Copy },
  { value: "form_filler", label: "Form Auto", icon: FileText },
  { value: "ai_agent", label: "AI Agent", icon: Bot },
];

export default function AutoRecommender() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q && activeFilter === "all") return siteCategories;
    return siteCategories.filter((cat) => {
      const matchesQuery =
        !q ||
        cat.name.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.subcategories.some(
          (sub) =>
            sub.name.toLowerCase().includes(q) ||
            sub.sites.some((s) => s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q))
        );
      const matchesFilter =
        activeFilter === "all" ||
        cat.subcategories.some((sub) => sub.sites.some((s) => s.capabilities.includes(activeFilter)));
      return matchesQuery && matchesFilter;
    });
  }, [query, activeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gold-gradient p-6 text-black">
        <h1 className="text-2xl font-bold font-heading">Auto Recommender</h1>
        <p className="text-sm text-black/80 mt-1">
          Browse the top {siteCategories.length} categories of sites you can scrape and clone. Click a category to see
          subcategories, example sites, and one-click launch buttons.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories, subcategories, or sites..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((opt) => {
            const Icon = opt.icon;
            const active = activeFilter === opt.value;
            return (
              <Button
                key={opt.value}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setActiveFilter(opt.value)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {siteCategories.length} categories
      </p>

      {/* Category Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <SearchX className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No categories match your search. Try a different keyword or filter.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}