import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Monitor, Smartphone, Sparkles, Search, Grid3x3, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StudioControls from "@/components/visual/StudioControls";
import PreviewFrame from "@/components/visual/PreviewFrame";
import { GALLERY_FAMILIES, renderPreview } from "@/lib/visual/previewRenderer";
import { loadConfig, saveConfig, loadFont, themeToCssVars } from "@/lib/visual/studioConfig";

const LOGO_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/b9a9faf73_logo.png";

export default function VisualGallery() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(loadConfig);
  const [activeFamily, setActiveFamily] = useState("desktop");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useEffect(() => {
    saveConfig(config);
    loadFont(config.fontFamily);
  }, [config]);

  const themeVars = useMemo(() => themeToCssVars(config), [config]);

  const family = GALLERY_FAMILIES.find((f) => f.key === activeFamily);
  const filteredItems = useMemo(() => {
    if (!search.trim()) return family?.items || [];
    const q = search.toLowerCase();
    return (family?.items || []).filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
  }, [family, search]);

  const handleConfigChange = (next) => setConfig(next);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="CloudBrowser" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="font-heading font-bold text-base block leading-tight">Visual Gallery</span>
              <span className="text-xs text-muted-foreground">Universal Template System</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </div>
        </div>
      </header>
      <div className="h-1 bg-gold-gradient" />

      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Left: Studio Controls */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="xa-card !p-4 max-h-[calc(100vh-7rem)] overflow-y-auto xa-scroll">
              <StudioControls config={config} onChange={handleConfigChange} />
            </div>
          </aside>

          {/* Right: Gallery */}
          <main>
            {/* Family tabs */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {GALLERY_FAMILIES.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setActiveFamily(f.key); setSelectedTemplate(null); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                    activeFamily === f.key
                      ? "bg-amber-400 text-black"
                      : "border border-border text-muted-foreground hover:text-foreground hover:border-amber-400"
                  }`}
                >
                  {f.platform === "desktop" ? <Monitor className="w-4 h-4" /> : f.platform === "mobile" ? <Smartphone className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {f.label}
                  <span className="ml-1 text-xs opacity-60">({f.items.length})</span>
                </button>
              ))}
            </div>

            {/* Search + scale */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-muted-foreground" />
                <input
                  type="range"
                  min="0.3"
                  max="0.7"
                  step="0.05"
                  value={previewScale}
                  onChange={(e) => setPreviewScale(parseFloat(e.target.value))}
                  className="w-24 accent-amber-500"
                />
              </div>
            </div>

            {/* Selected preview (full) or grid */}
            {selectedTemplate ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-heading font-bold text-lg">{selectedTemplate.name}</h2>
                    <p className="text-xs text-muted-foreground">{family.label} · {selectedTemplate.id}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(null)}>
                    <Grid3x3 className="w-4 h-4 mr-1" /> Back to grid
                  </Button>
                </div>
                <div className="xa-card flex items-center justify-center" style={{ minHeight: 520 }}>
                  <PreviewFrame
                    html={renderPreview(selectedTemplate.id, config)}
                    config={config}
                    platform={family.platform === "mobile" ? "mobile" : "desktop"}
                    themeVars={themeVars}
                    scale={family.platform === "mobile" ? 1.1 : 0.7}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className="xa-card !p-3 text-left hover:border-amber-400 transition-all group"
                  >
                    <div className="flex items-center justify-center mb-3 overflow-hidden rounded-lg" style={{ minHeight: 200 }}>
                      <PreviewFrame
                        html={renderPreview(template.id, config)}
                        config={config}
                        platform={family.platform === "mobile" ? "mobile" : "desktop"}
                        themeVars={themeVars}
                        scale={family.platform === "mobile" ? previewScale * 0.65 : previewScale}
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="font-bold text-sm">{template.name}</span>
                      <Maximize2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredItems.length === 0 && (
              <div className="xa-card text-center py-16">
                <p className="text-muted-foreground">No templates match "{search}"</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}