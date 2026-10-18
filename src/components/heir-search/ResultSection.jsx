import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, X, Search, Loader2 } from "lucide-react";

/**
 * Collapsible result section with delete (x) and deep search buttons.
 * - Click the header to expand/collapse
 * - X button removes this section's data from the record
 * - Deep Search button runs a targeted search for this section
 */
export default function ResultSection({
  title,
  icon: Icon,
  description,
  sectionKey,
  result,
  setResult,
  onDelete,
  onDeepSearch,
  searchingSection,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [deleting, setDeleting] = useState(false);
  const isSearching = searchingSection === sectionKey;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(sectionKey);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeepSearch = (e) => {
    e.stopPropagation();
    if (onDeepSearch) onDeepSearch(sectionKey);
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors -mb-0" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeepSearch}
              disabled={isSearching}
              className="h-7 px-2 text-xs"
            >
              {isSearching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />}
              {isSearching ? "Searching..." : "Deep Search"}
            </Button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete this section"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60 transition-all disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        {description && !open && (
          <CardDescription className="mt-1 ml-6">{description}</CardDescription>
        )}
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 text-sm pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}