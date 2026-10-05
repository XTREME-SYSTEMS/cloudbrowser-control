import { useState, useEffect } from "react";
import { Terminal, Circle, Play } from "lucide-react";

const lines = [
  { type: "comment", text: "# Connect your agent to CloudBrowser" },
  { type: "code", text: "import puppeteer from 'puppeteer-core';" },
  { type: "blank" },
  { type: "code", text: "const browser = await puppeteer.connect({" },
  { type: "indent", text: "browserWSEndpoint:" },
  { type: "indent2", text: "'wss://cloud-browser.base44.app/engine?token=YOUR_KEY'," },
  { type: "indent", text: "proxy: { server: 'residential.cloud-browser.app' }" },
  { type: "code", text: "});" },
  { type: "blank" },
  { type: "code", text: "const page = await browser.newPage();" },
  { type: "code", text: "await page.goto('https://target.com');" },
  { type: "blank" },
  { type: "output", text: "✓ Session started · proxy: us-east-1 · stealth: ON" },
  { type: "output", text: "✓ CAPTCHA solved · hCaptcha · 1.2s" },
  { type: "output", text: "✓ Page loaded · 200 OK · 2.4s" },
];

export default function HeroTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (visibleLines >= lines.length) return;
    const timer = setTimeout(() => setVisibleLines((n) => n + 1), 180);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/50">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#111]">
        <div className="flex gap-1.5">
          <Circle className="w-3 h-3 fill-[#ff5f57] text-[#ff5f57]" />
          <Circle className="w-3 h-3 fill-[#febc2e] text-[#febc2e]" />
          <Circle className="w-3 h-3 fill-[#28c840] text-[#28c840]" />
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 text-xs text-white/40">
          <Terminal className="w-3.5 h-3.5" />
          agent-session.ts
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Play className="w-3 h-3" />
          connected
        </div>
      </div>

      {/* Code body */}
      <div className="p-5 font-mono text-[13px] leading-relaxed min-h-[340px]">
        {lines.slice(0, visibleLines).map((line, i) => {
          if (line.type === "blank") return <div key={i} className="h-4" />;
          if (line.type === "comment")
            return <div key={i} className="text-white/30">{line.text}</div>;
          if (line.type === "output")
            return <div key={i} className="text-emerald-400">{line.text}</div>;
          if (line.type === "indent")
            return <div key={i} className="text-white/70 pl-5">{line.text}</div>;
          if (line.type === "indent2")
            return <div key={i} className="text-amber-300/80 pl-10">{line.text}</div>;
          return <div key={i} className="text-white/90">{line.text}</div>;
        })}
        {visibleLines < lines.length && (
          <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse" />
        )}
      </div>

      {/* Glow */}
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />
    </div>
  );
}