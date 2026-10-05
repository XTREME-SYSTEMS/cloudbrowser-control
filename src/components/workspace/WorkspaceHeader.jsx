import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, PanelLeftOpen, SquarePen } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkspaceHeader({ isChat, collapsed, onExpand, onMenu, onNewChat }) {
  return (
    <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-5 safe-top">
      <div className="flex items-center">
        <button onClick={onMenu} aria-label="Open navigation" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-muted md:hidden"><Menu className="h-5 w-5" /></button>
        {collapsed && <button onClick={onExpand} aria-label="Expand sidebar" className="hidden h-11 w-11 place-items-center rounded-lg hover:bg-muted md:grid"><PanelLeftOpen className="h-5 w-5" /></button>}
      </div>
      <nav aria-label="Workspace view" className="flex rounded-full border border-border/30 bg-muted/60 p-1 text-sm">
        <Link to="/" aria-current={isChat ? 'page' : undefined} className={cn('min-w-20 rounded-full px-5 py-2 text-center', isChat ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Chat</Link>
        <Link to="/dashboard" aria-current={!isChat ? 'page' : undefined} className={cn('min-w-20 rounded-full px-5 py-2 text-center', !isChat ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Work</Link>
      </nav>
      <button onClick={onNewChat} aria-label="Start a new chat" title="New chat" className="grid h-11 w-11 place-items-center justify-self-end rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><SquarePen className="h-5 w-5" /></button>
    </header>
  );
}