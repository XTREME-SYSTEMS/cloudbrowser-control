import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Trash2, FileText, Loader2, ChevronDown, ChevronRight, Zap } from "lucide-react";

/**
 * TemplateSelector — save and reuse heir search parameter presets.
 * Lets the user save current search settings (deep/extreme toggles, sheet URL,
 * location defaults) as named templates and apply them to new cases instantly.
 */
export default function TemplateSelector({ currentSettings, onApplyTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res = await base44.entities.HeirSearchTemplate.filter({}, { sort: "name", limit: 50 });
      setTemplates(res.items || res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.entities.HeirSearchTemplate.create({
        name: name.trim(),
        description: desc.trim(),
        deep_search: currentSettings.deep_search !== false,
        extreme_deep: currentSettings.extreme_deep === true,
        spreadsheet_url: currentSettings.spreadsheet_url || "",
        sheet_name: currentSettings.sheet_name || "Heirs",
        default_death_location: currentSettings.death_location || "",
        case_prefix: currentSettings.case_prefix || "",
      });
      setName("");
      setDesc("");
      setShowSaveForm(false);
      loadTemplates();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (t) => {
    onApplyTemplate({
      deep_search: t.deep_search,
      extreme_deep: t.extreme_deep,
      spreadsheet_url: t.spreadsheet_url || "",
      sheet_name: t.sheet_name || "Heirs",
      death_location: t.default_death_location || "",
      case_reference: t.case_prefix || "",
    });
  };

  const deleteTemplate = async (id) => {
    try {
      await base44.entities.HeirSearchTemplate.delete(id);
      loadTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Search Templates
          {templates.length > 0 && (
            <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
          )}
        </span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No templates saved yet. Configure your search settings below and save them as a reusable template.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-md border bg-background">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {t.deep_search && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deep</Badge>
                          )}
                          {t.extreme_deep && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary">
                              <Zap className="w-2.5 h-2.5 mr-0.5" />Extreme
                            </Badge>
                          )}
                          {t.spreadsheet_url && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Sheet</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button size="sm" variant="ghost" onClick={() => applyTemplate(t)}
                          className="h-7 px-2 text-xs">Apply</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}
                          className="h-7 px-2 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showSaveForm ? (
                <div className="space-y-2 p-2 rounded-md border bg-background">
                  <div>
                    <Label className="text-xs">Template Name *</Label>
                    <Input placeholder="e.g. Texas Probate — Full Deep" value={name}
                      onChange={e => setName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input placeholder="What this template is for" value={desc}
                      onChange={e => setDesc(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveTemplate} disabled={saving || !name.trim()} className="h-7 text-xs">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                      Save Template
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSaveForm(false)} className="h-7 text-xs">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowSaveForm(true)} className="w-full h-7 text-xs">
                  <Save className="w-3 h-3 mr-1" />Save Current Settings as Template
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}