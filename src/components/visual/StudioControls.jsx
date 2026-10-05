import React from "react";
import { DEFAULT_CONFIG, PRESETS, FONT_OPTIONS, loadFont, lighten, darken, contrastColor } from "@/lib/visual/studioConfig";
import { Sun, Moon, Type, Palette, Image as ImageIcon, RotateCcw } from "lucide-react";

// Studio control panel — rebrands every live preview. Changes propagate
// to the parent via onChange(config) and persist to localStorage.
export default function StudioControls({ config, onChange }) {
  const update = (patch) => onChange({ ...config, ...patch });

  const applyPreset = (preset) => {
    update({ primaryColor: preset.primary, secondaryColor: preset.secondary });
  };

  const reset = () => onChange({ ...DEFAULT_CONFIG });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-amber-500" />
          <span className="font-heading font-bold text-sm">Studio Controls</span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Brand colors */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Brand Color</label>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="color"
            value={config.primaryColor}
            onChange={(e) => update({ primaryColor: e.target.value })}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer"
          />
          <input
            type="text"
            value={config.primaryColor}
            onChange={(e) => update({ primaryColor: e.target.value })}
            className="xa-input flex-1 font-mono text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border hover:border-amber-400 transition-colors text-xs"
              title={p.name}
            >
              <span className="w-4 h-4 rounded-full border border-border" style={{ background: p.primary }} />
              <span className="font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Secondary color */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Accent / Secondary</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={config.secondaryColor}
            onChange={(e) => update({ secondaryColor: e.target.value })}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer"
          />
          <input
            type="text"
            value={config.secondaryColor}
            onChange={(e) => update({ secondaryColor: e.target.value })}
            className="xa-input flex-1 font-mono text-xs"
          />
        </div>
      </div>

      {/* Theme mode */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Theme Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => update({ themeMode: "light" })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
              config.themeMode === "light" ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border text-muted-foreground"
            }`}
          >
            <Sun className="w-3.5 h-3.5" /> Light
          </button>
          <button
            onClick={() => update({ themeMode: "dark" })}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
              config.themeMode === "dark" ? "border-amber-400 bg-amber-50 text-amber-900" : "border-border text-muted-foreground"
            }`}
          >
            <Moon className="w-3.5 h-3.5" /> Dark
          </button>
        </div>
      </div>

      {/* Font family */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block flex items-center gap-1">
          <Type className="w-3 h-3" /> Font Family
        </label>
        <select
          value={config.fontFamily}
          onChange={(e) => {
            loadFont(e.target.value);
            update({ fontFamily: e.target.value });
          }}
          className="xa-input text-xs cursor-pointer"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {/* Font scale */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">
          Text Size: {config.fontScale.toFixed(1)}×
        </label>
        <input
          type="range"
          min="0.7"
          max="1.4"
          step="0.1"
          value={config.fontScale}
          onChange={(e) => update({ fontScale: parseFloat(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Logo text */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Logo Text</label>
        <input
          type="text"
          value={config.logoText}
          onChange={(e) => update({ logoText: e.target.value })}
          className="xa-input text-xs"
          placeholder="CloudBrowser"
        />
      </div>

      {/* Logo image URL */}
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block flex items-center gap-1">
          <ImageIcon className="w-3 h-3" /> Logo Image URL
        </label>
        <input
          type="text"
          value={config.logoImage}
          onChange={(e) => update({ logoImage: e.target.value })}
          className="xa-input text-xs"
          placeholder="https://… (optional)"
        />
      </div>

      {/* Content fields */}
      <div className="pt-3 border-t border-border">
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Heading</label>
        <input
          type="text"
          value={config.heading}
          onChange={(e) => update({ heading: e.target.value })}
          className="xa-input text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Subtitle</label>
        <input
          type="text"
          value={config.subtitle}
          onChange={(e) => update({ subtitle: e.target.value })}
          className="xa-input text-xs"
        />
      </div>
      <div>
        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2 block">Brand Name</label>
        <input
          type="text"
          value={config.brandName}
          onChange={(e) => update({ brandName: e.target.value })}
          className="xa-input text-xs"
        />
      </div>
    </div>
  );
}