import React from "react";
import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single brand lockup for the whole product.
 *
 * Every surface that shows the logo uses this component, so the mark cannot drift
 * apart again: the public header, the public footer, and the app chrome all render
 * the same tile, wordmark, and tagline.
 *
 * tone="token"   follows the active theme (use inside the app, where light/dark both apply)
 * tone="onLight" for a fixed white background
 * tone="onDark"  for a fixed navy background
 */
const SIZES = {
  sm: { tile: "w-8 h-8 rounded-md", icon: "w-4 h-4", name: "text-[13px]", tag: "text-[8px] tracking-[0.18em]" },
  md: { tile: "w-10 h-10 rounded-lg", icon: "w-5 h-5", name: "text-lg", tag: "text-[10px] tracking-[0.2em]" },
  lg: { tile: "w-11 h-11 rounded-lg", icon: "w-6 h-6", name: "text-xl", tag: "text-[10px] tracking-[0.2em]" },
};

const TONES = {
  token: { tile: "from-primary to-primary/80", icon: "text-primary-foreground", name: "text-foreground", tag: "text-gold" },
  onLight: { tile: "from-[#0a1f3c] to-[#1a3a5c]", icon: "text-[#c9a961]", name: "text-[#0a1f3c]", tag: "text-[#c9a961]" },
  onDark: { tile: "from-[#1a3a5c] to-[#0a1f3c]", icon: "text-[#c9a961]", name: "text-white", tag: "text-[#c9a961]" },
};

export default function BrandMark({
  size = "md",
  tone = "token",
  tagline = "Heir Search · Probate Genealogy",
  className,
}) {
  const s = SIZES[size] || SIZES.md;
  const t = TONES[tone] || TONES.token;

  return (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <div
        className={cn(
          "bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm",
          s.tile,
          t.tile,
        )}
      >
        <Scale className={cn(s.icon, t.icon)} />
      </div>
      <div className="leading-tight min-w-0">
        <div className={cn("font-serif font-bold tracking-tight truncate", s.name, t.name)}>
          Strategic Cloud Browser
        </div>
        {tagline ? (
          <div className={cn("uppercase font-semibold truncate", s.tag, t.tag)}>{tagline}</div>
        ) : null}
      </div>
    </div>
  );
}