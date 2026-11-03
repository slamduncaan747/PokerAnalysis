import { create } from 'zustand';
import { useCallback } from 'react';

/** Display units for amounts: big blinds, or money at a chosen stake. */
export interface Stake {
  sb: number;
  bb: number;
}
export const STAKES: Stake[] = [
  { sb: 0.01, bb: 0.02 },
  { sb: 0.02, bb: 0.05 },
  { sb: 0.05, bb: 0.1 },
  { sb: 0.1, bb: 0.25 },
  { sb: 0.25, bb: 0.5 },
  { sb: 0.5, bb: 1 },
  { sb: 1, bb: 2 },
  { sb: 2, bb: 5 },
  { sb: 5, bb: 10 },
];
export const CURRENCIES = ['$', '€', '£', '₮'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Settings {
  units: 'bb' | 'money';
  stake: Stake;
  currency: Currency;
  /** In hand reviews, show each hand at its own real stakes instead of the default stake. */
  handStakes: boolean;
  haptics: boolean;
  sounds: boolean;
}

const KEY = 'leakfinder.settings.v1';
const DEFAULTS: Settings = { units: 'bb', stake: STAKES[1], currency: '$', handStakes: true, haptics: true, sounds: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { set: _s, ...rest } = { ...get(), ...p };
    void _s;
    try {
      localStorage.setItem(KEY, JSON.stringify(rest));
    } catch {
      /* ignore */
    }
  },
}));

export const stakeLabel = (s: Stake, cur: string = '$') => `${cur}${trim(s.sb)}/${cur}${trim(s.bb)}`;
const trim = (x: number) => (x >= 1 ? String(x) : x.toFixed(2));

function money(x: number, cur: string): string {
  const a = Math.abs(x);
  const s = a >= 1000 ? Math.round(a).toLocaleString('en-US') : a >= 100 ? a.toFixed(0) : a.toFixed(2);
  return `${x < 0 ? '−' : ''}${cur}${s}`;
}

function bbText(x: number): string {
  const r = Math.round(x * 10) / 10;
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1);
  return `${r < 0 ? '−' : ''}${s}bb`;
}

/** A hand's own stake: big blind in money, its currency, and whether it's tournament chips. */
export interface RealStake {
  bb: number;
  currency?: string;
  tournament?: boolean;
}

/**
 * Formats an amount given in big blinds in the user's units.
 * `real` = the hand's own stake (used when handStakes is on and the hand has real money).
 */
export function formatAmount(bb: number, s: Pick<Settings, 'units' | 'stake' | 'currency' | 'handStakes'>, real?: RealStake): string {
  if (s.units === 'bb' || real?.tournament) return bbText(bb);
  if (real && s.handStakes && real.bb > 0 && real.currency) return money(bb * real.bb, currencyGlyph(real.currency) ?? s.currency);
  return money(bb * s.stake.bb, s.currency);
}

function currencyGlyph(c?: string): string | undefined {
  if (!c) return undefined;
  if (/usdt|₮/i.test(c)) return '₮';
  if (/usd|\$/i.test(c)) return '$';
  if (/eur|€/i.test(c)) return '€';
  if (/gbp|£/i.test(c)) return '£';
  return undefined;
}

/** "12.5bb" amounts inside free text (never "bb/100" rates or the BB position). */
const BB_RE = /(−|-)?(\d+(?:\.\d+)?)\s?bb\b(?!\s?\/\s?100)/g;

export function rewriteAmounts(text: string, s: Pick<Settings, 'units' | 'stake' | 'currency' | 'handStakes'>, real?: RealStake): string {
  if (s.units === 'bb' || real?.tournament) return text;
  return text.replace(BB_RE, (_m, sign: string | undefined, num: string) => formatAmount((sign ? -1 : 1) * parseFloat(num), s, real));
}

/** Hook: `fmt(bb)` and `tx(text)` in the current units. Pass a hand's stake to honour "real stakes". */
export function useUnits(real?: RealStake) {
  const units = useSettings((s) => s.units);
  const stake = useSettings((s) => s.stake);
  const currency = useSettings((s) => s.currency);
  const handStakes = useSettings((s) => s.handStakes);
  const rb = real?.bb;
  const rc = real?.currency;
  const rt = real?.tournament;
  const fmt = useCallback((bb: number) => formatAmount(bb, { units, stake, currency, handStakes }, rb ? { bb: rb, currency: rc, tournament: rt } : undefined), [units, stake, currency, handStakes, rb, rc, rt]);
  const tx = useCallback((t: string) => rewriteAmounts(t, { units, stake, currency, handStakes }, rb ? { bb: rb, currency: rc, tournament: rt } : undefined), [units, stake, currency, handStakes, rb, rc, rt]);
  return { fmt, tx, units };
}

/** A hand's own stake for `useUnits`: real money for cash games, chips (shown in bb) for tournaments. */
export const realStakeOf = (h: { bb: number; currency: string; gameType: 'cash' | 'tournament' }): RealStake => ({ bb: h.bb, currency: h.currency, tournament: h.gameType === 'tournament' });
