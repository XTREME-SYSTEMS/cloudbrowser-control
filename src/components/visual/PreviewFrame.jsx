import React from "react";
import { PREVIEW_STYLES } from "@/lib/visual/previewStyles";

// Renders a live HTML preview inside a device frame (browser or phone).
// Injects the scoped CSS + brand CSS variables so the preview re-renders
// instantly when the studio config changes.
export default function PreviewFrame({ html, config, platform = "desktop", themeVars = {}, scale = 1 }) {
  const isPhone = platform === "mobile";
  const frameW = isPhone ? 300 : 760;
  const frameH = isPhone ? 600 : 460;

  const styleTag = `<style>${PREVIEW_STYLES}</style>`;
  const varsStyle = Object.entries(themeVars).map(([k, v]) => `${k}:${v}`).join(";");

  const content = `${styleTag}<div class="vg-screen" style="${varsStyle}">${html}</div>`;

  return (
    <div
      style={{
        width: frameW * scale,
        height: frameH * scale,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <div
        style={{
          width: frameW,
          height: frameH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          borderRadius: isPhone ? 24 : 12,
          overflow: "hidden",
          border: isPhone ? "8px solid hsl(var(--background))" : "1px solid hsl(var(--border))",
          boxShadow: "0 8px 30px hsl(var(--background) / 0.4)",
          background: "hsl(var(--card))",
        }}
      >
        {isPhone && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: 80,
              height: 16,
              background: "hsl(var(--background))",
              borderRadius: "0 0 12px 12px",
              zIndex: 10,
            }}
          />
        )}
        <iframe
          title="preview"
          srcDoc={content}
          style={{
            width: "100%",
            height: "100%",
            border: 0,
            display: "block",
          }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}