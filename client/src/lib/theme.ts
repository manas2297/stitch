import { useSyncExternalStore } from 'react';

/**
 * App colour theme. "system" follows the OS `prefers-color-scheme` live; "light"/"dark" pin it.
 * The resolved theme is applied as a `dark` class + `color-scheme` on <html>. index.html runs the
 * same logic inline before React loads so there is no flash of the wrong theme; keep the storage key
 * and class names in sync with that script.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'stitch.theme';
export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let preference: ThemePreference = readPreference();
let systemDark = !!media?.matches;
const listeners = new Set<() => void>();

const resolve = (): ResolvedTheme => (preference === 'system' ? (systemDark ? 'dark' : 'light') : preference);

function apply() {
  const resolved = resolve();
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

function emit() {
  apply();
  snapshot = { preference, resolved: resolve() };
  listeners.forEach((l) => l());
}

let snapshot = { preference, resolved: resolve() };

media?.addEventListener('change', (e) => {
  systemDark = e.matches;
  if (preference === 'system') emit();
});

// Another window/tab of the app changed the preference.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== THEME_STORAGE_KEY) return;
    preference = readPreference();
    emit();
  });
}

if (typeof document !== 'undefined') apply();

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* storage unavailable: the choice still applies for this session */
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Current preference and the theme it resolves to; re-renders on change (including OS changes). */
export function useTheme() {
  const s = useSyncExternalStore(subscribe, () => snapshot);
  return { ...s, setPreference: setThemePreference };
}
