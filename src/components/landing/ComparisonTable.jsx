import { Check, X, Minus } from "lucide-react";

const features = [
  { label: "Self-hosted on your Google Cloud", cb: true, bl: true, bd: false, br: false },
  { label: "Managed cloud option", cb: true, bl: true, bd: true, br: true },
  { label: "Headless Chrome fleet management", cb: true, bl: true, bd: true, br: true },
  { label: "Built-in CAPTCHA solving", cb: true, bl: true, bd: false, br: true },
  { label: "Residential proxy rotation", cb: true, bl: true, bd: false, br: true },
  { label: "AI agent browser integration", cb: true, bl: true, bd: true, br: false },
  { label: "MCP server protocol", cb: true, bl: true, bd: false, br: false },
  { label: "Website cloning & parity engine", cb: true, bl: false, bd: false, br: false },
  { label: "Autonomous self-healing workflows", cb: true, bl: false, bd: false, br: false },
  { label: "Session persistence & auth profiles", cb: true, bl: true, bd: true, br: true },
  { label: "Live session view & recording", cb: true, bl: true, bd: true, br: true },
  { label: "Enterprise SSO & audit logs", cb: true, bl: true, bd: true, br: true },
  { label: "Data sovereignty / air-gapped deploy", cb: true, bl: true, bd: false, br: false },
  { label: "Per-request pricing (no bandwidth fees)", cb: true, bl: false, bd: false, br: false },
];

function Cell({ value }) {
  if (value === true) return <Check className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-white/20 mx-auto" />;
  return <Minus className="w-4 h-4 text-white/30 mx-auto" />;
}

export default function ComparisonTable() {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
      {/* Header */}
      <div className="grid grid-cols-5 gap-2 px-4 py-4 border-b border-white/10 bg-white/5">
        <div className="text-xs font-semibold text-white/50 uppercase tracking-wider">Capability</div>
        <div className="text-center">
          <div className="text-sm font-bold text-gold-gradient">CloudBrowser</div>
        </div>
        <div className="text-center text-sm font-semibold text-white/60">Browserless</div>
        <div className="text-center text-sm font-semibold text-white/60">Browserbase</div>
        <div className="text-center text-sm font-semibold text-white/60">Bright Data</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {features.map((f, i) => (
          <div
            key={f.label}
            className={`grid grid-cols-5 gap-2 px-4 py-3 items-center ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
          >
            <div className="text-sm text-white/80">{f.label}</div>
            <div className="flex justify-center bg-amber-500/5 rounded-md py-1">
              <Cell value={f.cb} />
            </div>
            <div className="flex justify-center"><Cell value={f.bl} /></div>
            <div className="flex justify-center"><Cell value={f.bd} /></div>
            <div className="flex justify-center"><Cell value={f.br} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}