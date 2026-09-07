import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Lightbulb, ChevronDown, ChevronUp, Loader2, AlertTriangle, Wrench, Shield, Zap, Eye } from "lucide-react";

const CATEGORY_ICONS = {
  hardening: Shield,
  reliability: Zap,
  competitive: Wrench,
  observability: Eye,
  dx: Wrench,
  proxy_captcha: AlertTriangle,
};

const PRIORITY_COLORS = {
  1: "text-red-500 bg-red-500/10 border-red-500/20",
  2: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  3: "text-blue-500 bg-blue-500/10 border-blue-500/20",
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  failed: "Failed",
  blocked: "Blocked",
};

export default function SuggestionsBar({ onSuggestionClick, expanded, onToggle }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    try {
      const records = await base44.entities.SystemEnhancement.filter(
        { status: { $in: ["pending", "in_progress", "failed", "blocked"] } },
        "priority",
        20
      );
      setSuggestions(records || []);
    } catch {
      setSuggestions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSuggestions();
    // Refresh every 60s
    const interval = setInterval(fetchSuggestions, 60000);
    return () => clearInterval(interval);
  }, [fetchSuggestions]);

  return (
    <div className="border-t bg-muted/30">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          Suggestions
          {suggestions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
              {suggestions.length}
            </span>
          )}
        </span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="max-h-44 overflow-y-auto px-2 pb-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No pending enhancements — system is healthy</p>
          ) : (
            suggestions.map((s) => {
              const Icon = CATEGORY_ICONS[s.category] || Lightbulb;
              return (
                <button
                  key={s.id}
                  onClick={() => onSuggestionClick(s)}
                  className="group flex items-start gap-2 w-full p-2 rounded-md text-left text-xs border border-transparent hover:border-primary/30 hover:bg-accent/50 transition-all"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground group-hover:text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.title}</p>
                    <p className="text-muted-foreground truncate">{s.description}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 border ${PRIORITY_COLORS[s.priority] || PRIORITY_COLORS[3]}`}>
                    P{s.priority}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}