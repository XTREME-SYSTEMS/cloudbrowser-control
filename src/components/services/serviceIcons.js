import {
  Radar, Bot, Target, BarChart3, TrendingUp, Home, KeyRound,
  Camera, ShieldCheck, BellRing, Layers, Gavel, PieChart, Database, Users,
} from "lucide-react";

/** Catalogue icons are stored as names so the catalog stays free of UI imports. */
export const SERVICE_ICONS = {
  Radar, Bot, Target, BarChart3, TrendingUp, Home, KeyRound,
  Camera, ShieldCheck, BellRing, Layers, Gavel, PieChart, Database, Users,
};

export function serviceIcon(name) {
  return SERVICE_ICONS[name] || Radar;
}

/** Literal class strings only — Tailwind purges anything assembled at runtime. */
export const GROUP_STYLES = {
  Acquisition: { chip: "bg-gold/10 text-gold border-gold/30", bar: "bg-gold" },
  Intelligence: { chip: "bg-primary/10 text-primary border-primary/30", bar: "bg-primary" },
  Operations: { chip: "bg-chart-5/10 text-chart-5 border-chart-5/30", bar: "bg-chart-5" },
  Assurance: { chip: "bg-chart-3/10 text-chart-3 border-chart-3/30", bar: "bg-chart-3" },
};

export function groupStyle(group) {
  return GROUP_STYLES[group] || GROUP_STYLES.Intelligence;
}