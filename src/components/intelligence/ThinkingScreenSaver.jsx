import { useState, useEffect } from "react";
import { Loader2, Brain, Radar, Search } from "lucide-react";

const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "I told my computer I needed a break — now it won't stop sending KitKat ads.",
  "Why did the marketer get off the trampoline? He was worried about the bounce rate.",
  "I'm reading a book about anti-gravity. It's impossible to put down.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'",
  "Why did the developer go broke? Because he used up all his cache.",
  "I'd tell you a UDP joke, but you might not get it.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "There are 10 types of people: those who understand binary and those who don't.",
  "A SEO expert walks into a bar, tavern, pub, public house, Irish pub, drinking establishment...",
  "Why did the data scientist break up with the statistician? Too many arguments.",
  "My boss told me to have a good day — so I went home.",
  "What do you call a fake noodle? An impasta.",
  "I named my hard drive 'Data' so I can say 'I'm backing up Data every night.'",
];

const MESSAGES = [
  "Scanning national search demand...",
  "Analyzing competitor footprints...",
  "Tracing decision maker profiles...",
  "Ingesting economic indicators...",
  "Normalizing intelligence signals...",
  "Running strategy simulations...",
  "Generating brand options...",
  "Compiling sales assets...",
  "Syncing to Google Drive...",
  "Cross-referencing social signals...",
];

export default function ThinkingScreenSaver({ active, label }) {
  const [jokeIdx, setJokeIdx] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const jokeTimer = setInterval(() => setJokeIdx(i => (i + 1) % JOKES.length), 4000);
    const msgTimer = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 2500);
    return () => { clearInterval(jokeTimer); clearInterval(msgTimer); };
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/40 border-t-primary animate-spin" style={{ animationDuration: "1.5s" }} />
          <div className="absolute inset-2 rounded-full border-2 border-primary/30 border-b-primary animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
          <Brain className="absolute inset-0 m-auto w-10 h-10 text-primary" />
        </div>
        <p className="font-heading font-bold text-lg text-primary mb-2">{label || "System Thinking"}</p>
        <p className="text-sm text-muted-foreground mb-4">{MESSAGES[msgIdx]}</p>
        <div className="p-3 rounded-lg border border-primary/10 bg-primary/5">
          <p className="text-xs text-muted-foreground italic">💭 {JOKES[jokeIdx]}</p>
        </div>
      </div>
    </div>
  );
}