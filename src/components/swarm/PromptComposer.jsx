import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2, Paperclip } from 'lucide-react';

export default function PromptComposer({ onSend, disabled, placeholder }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = Math.min(ref.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="rounded-xl border border-border bg-card focus-within:border-primary/50 transition-colors">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || 'Ask the swarm...'}
        rows={1}
        className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm text-foreground placeholder-muted-foreground focus:outline-none max-h-48"
      />
      <div className="flex items-center justify-between px-3 pb-2">
        <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors" title="Attach">
          <Paperclip className="h-4 w-4" />
        </button>
        <button onClick={handleSend} disabled={!text.trim() || disabled} className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}