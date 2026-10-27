/**
 * cyberNoirTheme.ts — Additive Cyber-Noir theme toggle for Horizon.
 *
 * HARVEST step (non-destructive): ports Eclipse's "Cyber-Noir" visual preset
 * into Horizon as an OPT-IN skin. Horizon's default "Futuristic Command
 * Center" look is untouched until this is toggled on.
 *
 * How it works:
 *   The preset lives in `./cyber-noir.css` and is 100% gated behind the
 *   `.theme-cyber-noir` class on <html> (documentElement). Flipping that
 *   class on/off switches the entire Cyber-Noir skin without altering any
 *   existing component, token, or config file.
 *
 * Usage:
 *   import { toggleCyberNoir, enableCyberNoir, disableCyberNoir, isCyberNoir }
 *     from './themes/cyberNoirTheme';
 *
 *   toggleCyberNoir();   // returns the new on/off state
 *
 * The choice persists in localStorage so a reload keeps the user's pick
 * (call initCyberNoirFromStorage() once at boot — already wired in main.tsx).
 */

const THEME_CLASS = 'theme-cyber-noir';
const STORAGE_KEY = 'horizon-theme';

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Apply the Cyber-Noir skin. */
export function enableCyberNoir(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add(THEME_CLASS);
  safeLocalStorage()?.setItem(STORAGE_KEY, 'cyber-noir');
}

/** Remove the Cyber-Noir skin (returns to default Horizon look). */
export function disableCyberNoir(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove(THEME_CLASS);
  safeLocalStorage()?.setItem(STORAGE_KEY, 'default');
}

/** Flip the skin; returns the resulting on/off state. */
export function toggleCyberNoir(): boolean {
  if (typeof document === 'undefined') return false;
  const on = document.documentElement.classList.toggle(THEME_CLASS);
  safeLocalStorage()?.setItem(STORAGE_KEY, on ? 'cyber-noir' : 'default');
  return on;
}

/** True when the Cyber-Noir skin is currently active. */
export function isCyberNoir(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(THEME_CLASS);
}

/** Restore a persisted choice at boot (no-op unless the user previously toggled). */
export function initCyberNoirFromStorage(): void {
  if (safeLocalStorage()?.getItem(STORAGE_KEY) === 'cyber-noir') {
    enableCyberNoir();
  }
}
