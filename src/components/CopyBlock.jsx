import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export default function CopyBlock({ text, label, mono = true }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      {label && <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>}
      <div className="relative group">
        <pre className={`p-3 rounded-md bg-muted border text-xs overflow-x-auto whitespace-pre-wrap break-all ${mono ? "font-mono" : ""}`}>{text}</pre>
        <Button size="sm" variant="ghost" className="absolute top-1 right-1 opacity-60 group-hover:opacity-100" onClick={copy}>
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}