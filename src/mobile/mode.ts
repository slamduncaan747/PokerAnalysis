import { Capacitor } from '@capacitor/core';

/** The public site, opened from the iOS app for the full analytics. */
export const WEB_URL = 'https://slamduncaan747.github.io/PokerAnalysis/?ui=web';

const KEY = 'leakfinder.ui';
export type UiMode = 'mobile' | 'web';

/**
 * Which interface to show. The iOS app is always the mobile app; in a browser, `?ui=mobile|web`
 * chooses (and is remembered), otherwise phones get the mobile app and everything else the web app.
 */
export function uiMode(): UiMode {
  if (Capacitor.isNativePlatform()) return 'mobile';
  try {
    const q = new URLSearchParams(location.search).get('ui');
    if (q === 'mobile' || q === 'web') {
      localStorage.setItem(KEY, q);
      return q;
    }
    const saved = localStorage.getItem(KEY);
    if (saved === 'mobile' || saved === 'web') return saved;
  } catch {
    /* storage blocked */
  }
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 600;
  return coarse && small ? 'mobile' : 'web';
}

export function setUiMode(m: UiMode) {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.set('ui', m);
  url.hash = '#/';
  location.href = url.toString();
}
