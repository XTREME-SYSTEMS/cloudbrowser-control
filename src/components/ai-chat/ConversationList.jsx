import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConversationList({ conversations, activeId, onSelect, onCreate, onDelete }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <Button onClick={onCreate} className="w-full" size="sm">
          <Plus className="w-4 h-4" /> New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
        ) : conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
              c.id === activeId ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">{c.metadata?.name || "Untitled"}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}