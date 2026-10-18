import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ClipboardPaste, Loader2, Wand2, CheckCircle, Users } from "lucide-react";

/**
 * Paste & Organize intake — paste raw case text (obituary, court filing,
 * attorney email, case notes) and AI extracts structured fields + family.
 */
export default function PasteIntake({ onParsed }) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("parseCaseText", { text });
      const data = res.data || res;
      if (data.error) {
        setError(data.error);
        return;
      }
      const p = data.parsed || {};
      setParsed(p);
      onParsed(p);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-[#faf8f3] p-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardPaste className="w-4 h-4 text-[#0a1f3c]" />
        <span className="text-sm font-semibold text-[#0a1f3c]">Paste &amp; Organize</span>
        <span className="text-xs text-slate-400">— paste an obituary, court filing, or case notes</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Paste any case text here — obituary, probate filing, attorney email, family notes. The AI will extract the deceased, dates, addresses, and every named family member..."
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white resize-none focus:outline-none focus:border-[#0a1f3c] focus:ring-1 focus:ring-[#c9a961]/30"
      />
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <Button
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="bg-[#0a1f3c] hover:bg-[#1a3a5c] text-white border-0"
        >
          {parsing ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Organizing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-1.5" />Organize with AI
            </>
          )}
        </Button>
        {parsed && !parsing && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            {parsed.family_members?.length || 0} family members extracted — fields populated below
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {parsed?.family_members?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {parsed.family_members.map((fm, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0a1f3c]/5 border border-[#0a1f3c]/10 text-xs text-[#0a1f3c]"
            >
              <Users className="w-3 h-3 text-[#c9a961]" />
              {fm.name}
              {fm.relationship && (
                <span className="text-slate-400">· {fm.relationship}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}