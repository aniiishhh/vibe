import { useSyncExternalStore } from 'react';

/* ---------- On/off preference (per device) ---------- */
const enabledKey = 'vibe.pip';
const listeners = new Set<() => void>();
const readEnabled = () => { try { return localStorage.getItem(enabledKey) !== 'off'; } catch { return true; } };
export function setPipEnabled(value: boolean) {
  try { localStorage.setItem(enabledKey, value ? 'on' : 'off'); } catch { /* ignore */ }
  listeners.forEach((listener) => listener());
}
export function usePipEnabled() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, readEnabled, () => true);
}
