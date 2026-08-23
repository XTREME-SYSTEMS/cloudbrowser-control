import { useState, useRef } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChatInput({ onSend, onUpload, disabled }) {
  const [text, setText] = useState("");
  const fileRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4 border-t">
      <input type="file" ref={fileRef} className="hidden" onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} />
      <Button type="button" variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={disabled}>
        <Paperclip className="w-4 h-4" />
      </Button>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask the agent to do anything..."
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" size="icon" disabled={!text.trim() || disabled}>
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}