import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Folder,
  ShoppingCart,
  Building2,
  Briefcase,
  Users,
  Newspaper,
  Phone,
  Plane,
  Gavel,
  TrendingUp,
  HeartPulse,
  GraduationCap,
  Landmark,
  Car,
  UtensilsCrossed,
  Scale,
  Search,
  Trophy,
  Code,
  Film,
  Building,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { difficultyStyles, capabilityLabels } from "./categoriesData";

const iconMap = {
  ShoppingCart,
  Building2,
  Briefcase,
  Users,
  Newspaper,
  Phone,
  Plane,
  Gavel,
  TrendingUp,
  HeartPulse,
  GraduationCap,
  Landmark,
  Car,
  UtensilsCrossed,
  Scale,
  Search,
  Trophy,
  Code,
  Film,
  Building,
  Globe,
};

export default function CategoryCard({ category }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = iconMap[category.icon] || Globe;

  return (
    <Card className="overflow-hidden border-border/60 transition-shadow hover:shadow-lg">
      <CardHeader
        className="cursor-pointer flex-row items-center gap-3 space-y-0"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gold-gradient text-black">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-heading truncate">{category.name}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{category.description}</p>
        </div>
        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {category.subcategories.map((sub) => (
            <div key={sub.name}>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-primary" />
                {sub.name}
              </h4>
              <div className="space-y-2">
                {sub.sites.map((site) => (
                  <div
                    key={site.url}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-border/50 p-3 bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{site.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${difficultyStyles[site.difficulty]}`}>
                          {site.difficulty}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{site.url}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {site.capabilities.map((cap) => (
                          <span key={cap} className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {capabilityLabels[cap] || cap}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button asChild size="sm" variant="default" className="h-7 text-xs">
                        <Link to={`/clone-studio?url=${encodeURIComponent(site.url)}`}>Clone</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                        <Link to={`/agent-builder?url=${encodeURIComponent(site.url)}`}>Scrape</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}