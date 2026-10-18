import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, X, Search, Loader2 } from "lucide-react";

/**
 * Collapsible result section with delete (x) and deep search buttons.
 * White-background, clean styling.
 */
export default function ResultSection({
  title, icon: Icon, description, sectionKey,
  onDelete, onDeepSearch, searchingSection, defaultOpen = false, children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [deleting, setDeleting] = useState(false);
  const isSearching = searchingSection === sectionKey;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try { await onDelete(sectionKey); } finally { setDeleting(false); }
  };

  const handleDeepSearch = (e) => {
    e.stopPropagation();
    if (onDeepSearch) onDeepSearch(sectionKey);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
          {Icon && <Icon className="w-4 h-4 text-[#0a1f3c] shrink-0" />}
          <span className="text-sm font-medium text-slate-900 truncate">{title}</span>
          {description && !open && <span className="text-xs text-slate-400 truncate hidden md:inline">— {description}</span>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDeepSearch} disabled={isSearching}
            className="h-7 px-2.5 text-xs bg-white border-slate-300 text-[#0a1f3c] hover:bg-[#0a1f3c]/5 hover:border-[#c9a961]/40">
            {isSearching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
            {isSearching ? "Searching..." : "Deep Search"}
          </Button>
          <button onClick={handleDelete} disabled={deleting} title="Delete this section"
            className="flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2 text-sm text-slate-700 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}