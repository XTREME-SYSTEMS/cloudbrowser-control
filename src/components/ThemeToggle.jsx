import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

const MODES = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const active = MODES.find((m) => m.value === theme) || MODES[0];
  const ActiveIcon = active.icon;
  const cycle = () => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark');
  return (
    <button onClick={cycle} className="h-9 w-9 grid place-items-center rounded-full border border-border/70 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors" aria-label={`Theme: ${active.label}. Click to cycle.`} title={`Theme: ${active.label}`}>
      <ActiveIcon className="w-4 h-4" />
    </button>
  );
}