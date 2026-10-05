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
  if (value === true) return <Check className="w-3.5 h-3.5 text-[#ff8800] mx-auto" />;
  if (value === false) return <X className="w-3.5 h-3.5 text-[#555] mx-auto" />;
  return <Minus className="w-3.5 h-3.5 text-[#555] mx-auto" />;
}

export default function ComparisonTable() {
  return (
    <div className="xa-panel overflow-x-auto">
      <table className="w-full border-collapse text-[10px] text-[#bfc2c5]">
        <thead>
          <tr>
            <th className="text-left p-2 border-b border-[#36383b] text-[#ff8800] font-bold">Platform</th>
            <th className="text-center p-2 border-b border-[#36383b] text-[#ff8800] font-bold">CloudBrowser</th>
            <th className="text-center p-2 border-b border-[#36383b] text-[#ff8800] font-bold">Browserless</th>
            <th className="text-center p-2 border-b border-[#36383b] text-[#ff8800] font-bold">Browserbase</th>
            <th className="text-center p-2 border-b border-[#36383b] text-[#ff8800] font-bold">Bright Data</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.label}>
              <td className="p-2 border-b border-[#36383b] text-[#bfc2c5]">{f.label}</td>
              <td className="p-2 border-b border-[#36383b] text-center bg-[#ff8800]/5"><Cell value={f.cb} /></td>
              <td className="p-2 border-b border-[#36383b] text-center"><Cell value={f.bl} /></td>
              <td className="p-2 border-b border-[#36383b] text-center"><Cell value={f.bd} /></td>
              <td className="p-2 border-b border-[#36383b] text-center"><Cell value={f.br} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}