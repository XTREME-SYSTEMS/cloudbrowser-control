import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Volume2 } from 'lucide-react';

export default function EconomyMessages({ messages }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  useEffect(() => () => globalThis.speechSynthesis?.cancel(), []);
  const speak = text => {
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };
  return <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
    <div className="mx-auto max-w-3xl space-y-6">
      {messages.map((message, index) => <div key={index} className={message.role === 'user' ? 'ml-auto w-fit max-w-[90%] rounded-3xl bg-muted px-4 py-3' : 'py-2'}>
        <ReactMarkdown className="text-sm leading-relaxed space-y-3 break-words [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">{message.content}</ReactMarkdown>
        {message.role === 'assistant' && globalThis.speechSynthesis && <button onClick={() => speak(message.content)} title="Read aloud using your browser" aria-label="Read reply aloud" className="mt-2 grid h-11 w-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted"><Volume2 className="h-4 w-4" /></button>}
      </div>)}
      <div ref={end} />
    </div>
  </div>;
}