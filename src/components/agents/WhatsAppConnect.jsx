import { base44 } from "@/api/base44Client";
import { MessageCircle } from "lucide-react";

/**
 * The agent's WhatsApp door. The platform handles the sign-in behind this link,
 * so the operator connects their own phone in one tap and the agent then reaches
 * them there with the same identity it has in the app.
 */
export default function WhatsAppConnect() {
  return (
    <a
      href={base44.agents.getWhatsAppConnectURL("autonomous_agent")}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-display font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <MessageCircle className="h-3.5 w-3.5" />
      Connect WhatsApp
    </a>
  );
}