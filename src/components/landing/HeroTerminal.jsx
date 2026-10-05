import { useState, useEffect } from "react";

const lines = [
  { type: "cmd", text: 'browser.connect({ endpoint: "cloud-browser" })' },
  { type: "ok", text: "Chromium fleet assigned    region: us-central1" },
  { type: "ok", text: "fingerprint profile loaded" },
  { type: "ok", text: "session authenticated    latency: 42ms" },
  { type: "cmd", text: 'page.goto("https://example.com")' },
  { type: "ok", text: "navigation complete    200 OK" },
];

export default function HeroTerminal() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= lines.length) return;
    const t = setTimeout(() => setVisible((n) => n + 1), 350);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="xa-scanlines bg-[rgba(18,19,21,0.92)] border border-[#53565b] rounded-[5px] shadow-[0_18px_45px_rgba(0,0,0,0.6)] p-4 backdrop-blur-md font-mono text-[10px] leading-[1.9] text-[#c8cbd0] min-h-[260px]">
      <div className="border-b border-[#424448] pb-2 mb-2 text-[#9ca3af]">
        ◉　◉　◉　　session://engine/live
      </div>
      {lines.slice(0, visible).map((l, i) => (
        <div key={i}>
          <b className="text-[#ff8800]">{l.type === "cmd" ? "›" : "✓"}</b> {l.text}
        </div>
      ))}
      {visible < lines.length && <span className="text-[#ff8800]">▮</span>}
    </div>
  );
}