import { BookOpen, Check, Star, ThumbsUp, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import type { Classification } from '../lib/engine/types.ts';

export const CLASS_META: Record<Classification, { label: string; color: string; symbol: ReactNode; text: string }> = {
  brilliant: { label: 'Brilliant', color: 'var(--color-brilliant)', symbol: '!!', text: 'is brilliant' },
  great: { label: 'Great', color: 'var(--color-great)', symbol: '!', text: 'is a great move' },
  best: { label: 'Best', color: 'var(--color-best)', symbol: <Star size="60%" fill="currentColor" strokeWidth={0} />, text: 'is best' },
  excellent: { label: 'Excellent', color: 'var(--color-excellent)', symbol: <ThumbsUp size="58%" strokeWidth={3} />, text: 'is excellent' },
  good: { label: 'Good', color: 'var(--color-good)', symbol: <Check size="62%" strokeWidth={3.5} />, text: 'is good' },
  book: { label: 'Book', color: 'var(--color-book)', symbol: <BookOpen size="58%" strokeWidth={2.5} />, text: 'is standard (book)' },
  inaccuracy: { label: 'Inaccuracy', color: 'var(--color-inaccuracy)', symbol: '?!', text: 'is an inaccuracy' },
  miss: { label: 'Missed value', color: 'var(--color-miss)', symbol: <X size="62%" strokeWidth={3.5} />, text: 'misses value' },
  mistake: { label: 'Mistake', color: 'var(--color-mistake)', symbol: '?', text: 'is a mistake' },
  blunder: { label: 'Blunder', color: 'var(--color-blunder)', symbol: '??', text: 'is a blunder' },
};

export function ClassBadge({ c, size = 20, className = '' }: { c: Classification; size?: number; className?: string }) {
  const m = CLASS_META[c];
  return (
    <span
      title={m.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white leading-none ${className}`}
      style={{ width: size, height: size, background: m.color, fontSize: size * 0.48, boxShadow: '0 1px 0 rgba(0,0,0,.35)' }}
    >
      {m.symbol}
    </span>
  );
}

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = ['#1d2433', '#d6343f', '#2f6fdb', '#1f8a4c'];

export function PlayingCard({ card, size = 'md', hidden = false, dim = false }: { card?: Card | null; size?: 'xs' | 'sm' | 'md' | 'lg'; hidden?: boolean; dim?: boolean }) {
  const dims = { xs: [22, 30, 13], sm: [30, 42, 16], md: [42, 58, 22], lg: [56, 78, 30] }[size];
  const [w, h, fs] = dims;
  if (hidden || card === undefined || card === null) {
    return (
      <div
        className="rounded-[6px] border border-white/10 shrink-0"
        style={{ width: w, height: h, background: 'repeating-linear-gradient(45deg,#2b3a63 0 4px,#24325a 4px 8px)', boxShadow: '0 2px 4px rgba(0,0,0,.4)' }}
      />
    );
  }
  const r = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-[6px] bg-white shrink-0 select-none"
      style={{ width: w, height: h, color: SUIT_COLOR[s], boxShadow: '0 2px 5px rgba(0,0,0,.45)', opacity: dim ? 0.45 : 1 }}
    >
      <span className="font-extrabold leading-none" style={{ fontSize: fs }}>
        {r === 'T' ? '10' : r}
      </span>
      <span className="leading-none" style={{ fontSize: fs * 0.85 }}>
        {SUIT_GLYPH[s]}
      </span>
    </div>
  );
}

export function CardText({ cards }: { cards: readonly Card[] }) {
  return (
    <span className="inline-flex gap-[3px] font-semibold">
      {cards.map((c, i) => (
        <span key={i} className="rounded px-[3px] bg-white" style={{ color: SUIT_COLOR[suitOf(c)] }}>
          {RANKS[rankOf(c)]}
          {SUIT_GLYPH[suitOf(c)]}
        </span>
      ))}
    </span>
  );
}

export function StatTile({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'win' | 'loss' | 'neutral'; icon?: ReactNode }) {
  const color = tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-ink';
  return (
    <div className="panel p-4 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mute">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-xs text-dim">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-mute">{children}</h2>
      {right}
    </div>
  );
}

export function AccuracyRing({ value, size = 120, label = 'Accuracy' }: { value: number | null; size?: number; label?: string }) {
  const v = value ?? 0;
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = v >= 90 ? 'var(--color-best)' : v >= 80 ? 'var(--color-excellent)' : v >= 70 ? 'var(--color-inaccuracy)' : v >= 55 ? 'var(--color-mistake)' : 'var(--color-blunder)';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-panel-3)" strokeWidth={9} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-extrabold tabular-nums" style={{ fontSize: size * 0.24 }}>
          {value === null ? '—' : value.toFixed(1)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-mute">{label}</span>
      </div>
    </div>
  );
}

export function EvalBar({ value, height = 320, label }: { value: number | null; height?: number; label?: string }) {
  const v = value === null ? 0.5 : Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-6 overflow-hidden rounded-md border border-line" style={{ height, background: '#3b4250' }}>
        <div className="absolute bottom-0 left-0 right-0 bg-[#eef0f3] transition-all duration-500" style={{ height: `${v * 100}%` }} />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-black/30" />
        <span className={`absolute left-0 right-0 text-center text-[9px] font-bold ${v >= 0.5 ? 'bottom-1 text-[#1a1d23]' : 'top-1 text-white'}`}>
          {value === null ? '' : Math.round(v * 100)}
        </span>
      </div>
      {label && <span className="text-[10px] text-dim text-center leading-tight w-14">{label}</span>}
    </div>
  );
}

export const fmtBB = (x: number, signed = false) => {
  const v = Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 10) / 10;
  return `${signed && x > 0 ? '+' : ''}${v.toLocaleString()} bb`;
};

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' }) {
  const cls = {
    neutral: 'bg-panel-3 text-mute',
    good: 'bg-accent/15 text-accent',
    bad: 'bg-loss/15 text-loss',
    warn: 'bg-inaccuracy/15 text-inaccuracy',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export function ProgressBar({ value, color = 'var(--color-accent)', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-panel-3 ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
