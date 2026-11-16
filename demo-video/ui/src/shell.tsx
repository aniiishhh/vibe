import { createContext, useContext } from 'react';
import { PanelLeft, SquarePen } from 'lucide-react';

export interface ShellControls {
  sidebarCollapsed: boolean;
  openSidebar: () => void;
  createParty: (preset?: { name: string; goal: string }) => void;
}

export const ShellContext = createContext<ShellControls | null>(null);

export function useShell() {
  return useContext(ShellContext);
}

/** Sidebar toggle and new-party buttons shown in page headers when the sidebar is hidden. */
export function ShellNavButtons() {
  const shell = useShell();
  if (!shell) return null;
  return (
    <div className="shell-nav-buttons">
      <button className="icon-button" type="button" aria-label="Open sidebar" title="Open sidebar" onClick={shell.openSidebar}><PanelLeft size={18} /></button>
      <button className="icon-button" type="button" aria-label="New party" title="New party" onClick={() => shell.createParty()}><SquarePen size={17} /></button>
    </div>
  );
}
