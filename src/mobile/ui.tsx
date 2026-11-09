import { Check, ChevronLeft, ChevronRight, Flame, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import { haptic } from '../feedback.ts';
import { tierOf, type ChipColor } from '../puzzles/ranks.ts';

/* ------------------------------------------------------------------ chips */
// Casino denomination colours, turned up so they read on black.
const CHIP: Record<ChipColor, { base: string; edge: string; ink: string }> = {
  white: { base: '#eef0f3', edge: '#3a6df0', ink: '#16181c' },
  red: { base: '#e23b36', edge: '#ffffff', ink: '#ffffff' },
  green: { base: '#17a35f', edge: '#ffffff', ink: '#ffffff' },
  black: { base: '#2a2d33', edge: '#ffbe3d', ink: '#ffffff' },
  purple: { base: '#7a4be0', edge: '#ffffff', ink: '#ffffff' },
  gold: { base: '#ffbe3d', edge: '#ffffff', ink: '#2b1c00' },
  blue: { base: '#2f7bf0', edge: '#ffffff', ink: '#ffffff' },
  orange: { base: '#f57a2a', edge: '#ffffff', ink: '#ffffff' },
  teal: { base: '#16a7a0', edge: '#ffffff', ink: '#ffffff' },
  pink: { base: '#e2478c', edge: '#ffffff', ink: '#ffffff' },
  slate: { base: '#59606b', edge: '#ffffff', ink: '#ffffff' },
};
/** The accent colour a chip colour stands for (icon badges, bars). */
export const TONE: Record<ChipColor, string> = {
  white: '#c9ced6', red: '#ff6a5f', green: '#3fdc85', black: '#a5a9b1', purple: '#a887ff', gold: '#ffbe3d',
  blue: '#5aa2ff', orange: '#ff9548', teal: '#3fd6cd', pink: '#ff7ab0', slate: '#a5a9b1',
};

/** A chip from above: six edge inserts, an inlaid ring, a printed centre. Flat and bold. */
export function Chip({ color, size = 44, children, lip = true }: { color: ChipColor; size?: number; children?: ReactNode; lip?: boolean }) {
  const c = CHIP[color];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size, filter: lip ? 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' : undefined }}>
      <svg viewBox="0 0 64 64" width={size} height={size} className="absolute top-0 left-0">
        <circle cx="32" cy="32" r="31" fill={c.base} />
        <circle cx="32" cy="32" r="27" fill="none" stroke={c.edge} strokeWidth="8" strokeDasharray="9.4 18.87" strokeDashoffset="4.7" />
        <circle cx="32" cy="32" r="21" fill={c.base} />
        <circle cx="32" cy="32" r="20.2" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="31" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
      </svg>
      <div className="f-disp absolute inset-0 grid place-items-center font-extrabold" style={{ color: c.ink, fontSize: size * 0.3 }}>
        {children}
      </div>
    </div>
  );
}

/** A short stack of chips seen at an angle — for bets and the pot. */
export function ChipPile({ colors = ['red', 'black'] as ChipColor[], size = 20 }: { colors?: ChipColor[]; size?: number }) {
  const h = size * 0.36;
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: h + (colors.length - 1) * (h * 0.5) + 2 }}>
      {colors.map((c, i) => (
        <i key={i} className="absolute left-0 rounded-[50%]" style={{ width: size, height: h, bottom: i * h * 0.5, background: CHIP[c].base, boxShadow: `0 1.5px 0 rgba(0,0,0,.5), inset 0 0 0 1.5px ${CHIP[c].edge}cc` }} />
      ))}
    </span>
  );
}

/** Your rank as a chip (denomination inside). */
export function TierChip({ rating, size = 44 }: { rating: number; size?: number }) {
  const { tier } = tierOf(rating);
  return (
    <Chip color={tier.color} size={size} lip={size > 30}>
      <span style={{ fontSize: size * (tier.denom.length > 2 ? 0.24 : 0.32) }}>{tier.denom}</span>
    </Chip>
  );
}

/** A rounded-square icon badge, tinted with one accent. */
export function IconBadge({ color, size = 44, children, solid = false }: { color: ChipColor; size?: number; children: ReactNode; solid?: boolean }) {
  const t = TONE[color];
  return (
    <div className="m-icon" style={{ width: size, height: size, background: solid ? t : `color-mix(in srgb, ${t} 16%, transparent)`, color: solid ? '#0a0b0d' : t }}>
      {children}
    </div>
  );
}

/** Right / wrong, as a solid disc. */
export function Seal({ ok, size = 42 }: { ok: boolean; size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size, background: ok ? 'var(--go)' : 'var(--bad)', color: ok ? 'var(--go-ink)' : 'var(--bad-ink)' }}>
      {ok ? <Check size={size * 0.54} strokeWidth={3.4} /> : <X size={size * 0.5} strokeWidth={3.4} />}
    </div>
  );
}

/* ------------------------------------------------------------------ cards */
const SUIT = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = ['#15161a', '#e0332f', '#e0332f', '#15161a'];

/** A playing card: white, one heavy rank, one big suit. Readable at any size. */
export function MCard({ card, w = 54, hidden = false, dim = false, className = '', style }: { card?: Card | null; w?: number; hidden?: boolean; dim?: boolean; className?: string; style?: CSSProperties }) {
  const h = Math.round(w * 1.4);
  const r = Math.max(4, Math.round(w * 0.14));
  const shadow = w >= 40 ? '0 1px 0 rgba(0,0,0,.25), 0 10px 20px rgba(0,0,0,.35)' : '0 1px 2px rgba(0,0,0,.4)';
  if (hidden || card === undefined || card === null) {
    const b = Math.max(2, w * 0.07);
    return (
      <div
        className={`shrink-0 ${className}`}
        style={{
          width: w,
          height: h,
          borderRadius: r,
          background: '#e0332f',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.16) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,.16) 0 2px, transparent 2px 7px)',
          boxShadow: `inset 0 0 0 ${b}px #fff, ${shadow}`,
          ...style,
        }}
      />
    );
  }
  const rank = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(180deg,#ffffff,#f1f2f4)', color: SUIT_COLOR[s], boxShadow: shadow, opacity: dim ? 0.4 : 1, ...style }}>
      <span className="f-disp absolute leading-none font-extrabold" style={{ left: w * 0.13, top: w * 0.1, fontSize: w * 0.52, letterSpacing: rank === 'T' ? '-.09em' : '-.03em' }}>
        {rank === 'T' ? '10' : rank}
      </span>
      <span className="absolute leading-none" style={{ right: w * 0.1, bottom: w * 0.08, fontSize: w * 0.56 }}>
        {SUIT[s]}
      </span>
    </div>
  );
}

export function MiniCards({ cards, w = 22 }: { cards: readonly Card[]; w?: number }) {
  return (
    <div className="flex gap-[3px]">
      {cards.map((c, i) => (
        <MCard key={i} card={c} w={w} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- controls */
export type BtnTone = 'go' | 'gold' | 'bad' | 'ok' | 'blue' | 'amber' | 'slate' | 'ghost' | 'outline' | 'card';

/** Buttons: white for the one thing to do, a tonal fill for the rest. */
export function Btn({ children, onClick, to, tone = 'go', className = '', disabled, style }: { children: ReactNode; onClick?: () => void; to?: string; tone?: BtnTone; className?: string; disabled?: boolean; style?: CSSProperties }) {
  const cls = `m-btn3d b-${tone} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls} style={style} onClick={() => haptic.press()}>
        {children}
      </Link>
    );
  return (
    <button
      className={cls}
      style={style}
      disabled={disabled}
      onClick={() => {
        haptic.press();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

/** A tappable tile. */
export function Tile({ children, to, onClick, className = '', style }: { children: ReactNode; to?: string; onClick?: () => void; className?: string; style?: CSSProperties }) {
  const cls = `m-tile m-press block text-left ${className}`;
  if (to)
    return (
      <Link to={to} className={cls} style={style} onClick={() => haptic.tap()}>
        {children}
      </Link>
    );
  return (
    <button
      className={`${cls} w-full`}
      style={style}
      onClick={() => {
        haptic.tap();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function StreakPill({ n }: { n: number }) {
  return (
    <span className="m-pill f-num" style={{ color: n > 0 ? 'var(--gold)' : 'var(--text-3)' }}>
      <Flame size={17} fill={n > 0 ? 'currentColor' : 'none'} strokeWidth={2.4} />
      {n}
    </span>
  );
}

export function RatingPill({ rating }: { rating: number }) {
  return (
    <span className="m-pill f-num" style={{ paddingLeft: 6 }}>
      <TierChip rating={rating} size={22} />
      {rating.toLocaleString()}
    </span>
  );
}

/* --------------------------------------------------------------- layout */
/** A tab screen: a status row (rank + streak), then content. */
export function TabScreen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="flex h-[60px] items-center justify-between">
        <h1 className="f-display">{title}</h1>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <div className="mt-2 flex flex-col gap-8">{children}</div>
    </div>
  );
}

/** A pushed screen with a back chevron. */
export function PushScreen({ title, children }: { title: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="relative flex h-[60px] items-center">
        <button
          aria-label="Back"
          className="m-press grid h-10 w-10 place-items-center rounded-full"
          style={{ background: 'var(--s1)' }}
          onClick={() => {
            haptic.tap();
            nav(-1);
          }}
        >
          <ChevronLeft size={24} strokeWidth={2.6} className="-ml-0.5" />
        </button>
        <div className="f-head pointer-events-none absolute inset-x-12 text-center">{title}</div>
      </div>
      <div className="mt-3 flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function Section({ title, action, children, note }: { title?: ReactNode; action?: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between px-1">
          {title && <h2 className="f-head">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {note && <p className="f-small t3 mt-2.5 px-1 font-normal">{note}</p>}
    </section>
  );
}

/** A dark list (settings, recent items). */
export function List({ children }: { children: ReactNode }) {
  return <div className="m-tile-flat m-list overflow-hidden">{children}</div>;
}

export function Row({ icon, title, sub, value, right, to, onClick, href, chevron = true, danger = false }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; href?: string; chevron?: boolean; danger?: boolean }) {
  const tappable = !!(to || onClick || href);
  const inner = (
    <div className="flex min-h-[62px] items-center gap-3.5 px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[16px] leading-snug font-semibold ${danger ? 'c-bad' : ''}`}>{title}</div>
        {sub && <div className="f-small t2 truncate font-normal">{sub}</div>}
      </div>
      {value !== undefined && <div className="f-ui f-num t2 shrink-0">{value}</div>}
      {right}
      {chevron && tappable && <ChevronRight size={18} strokeWidth={2.4} className="t3 -mr-1 shrink-0" />}
    </div>
  );
  const cls = 'block w-full text-left m-row-press transition-colors';
  if (to)
    return (
      <Link to={to} onClick={() => haptic.tap()} className={cls}>
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => haptic.tap()} className={cls}>
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button
        onClick={() => {
          haptic.tap();
          onClick();
        }}
        className={cls}
      >
        {inner}
      </button>
    );
  return inner;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic.tap();
        onChange(!checked);
      }}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--go)' : 'var(--s3)' }}
    >
      <span className="absolute top-[3px] left-[3px] h-6 w-6 rounded-full bg-white transition-transform duration-200" style={{ transform: checked ? 'translateX(20px)' : 'none', boxShadow: '0 2px 4px rgba(0,0,0,.3)' }} />
    </button>
  );
}

export function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="f-num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[13px] font-bold" style={{ background: 'var(--bad)', color: '#fff' }}>{n > 99 ? '99+' : n}</span>;
}

/* ---------------------------------------------------------------- charts */
export function Sparkline({ data, w = 120, h = 36, color = 'var(--go)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  const id = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, []);
  if (data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={color} stroke="var(--s1)" strokeWidth="2" />
    </svg>
  );
}

export function RatingChart({ data, h = 140 }: { data: number[]; h?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      {data.length < 2 ? (
        <div className="f-small t3 grid h-full place-items-center rounded-[14px]" style={{ background: 'rgba(255,255,255,.03)' }}>
          Your rating graph appears after a few puzzles
        </div>
      ) : (
        <>
          <Sparkline data={data} w={Math.max(60, w - 44)} h={h} />
          <span className="f-small f-num t3 absolute top-0 right-0">{Math.max(...data)}</span>
          <span className="f-small f-num t3 absolute right-0 bottom-0">{Math.min(...data)}</span>
        </>
      )}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 5, color = 'var(--go)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--go)', h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden" style={{ height: h, background: 'var(--s3)', borderRadius: h }}>
      <div className="relative h-full" style={{ width: `${Math.max(0.02, Math.min(1, value)) * 100}%`, background: color, borderRadius: h, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }}>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- animations */
export function CountUp({ from, to, ms = 800, className = '' }: { from: number; to: number; ms?: number; className?: string }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - (1 - k) ** 3;
      setV(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms]);
  return <span className={`f-num ${className}`}>{v.toLocaleString()}</span>;
}

const CONF_COLORS = ['#ffbe3d', '#ffffff', '#ff6a5f', '#3fdc85', '#5aa2ff'];
export function Confetti({ n = 44 }: { n?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = 130 + Math.random() * 170;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d - 60, r: Math.random() * 720 - 360, c: CONF_COLORS[i % CONF_COLORS.length], delay: Math.random() * 80 };
      }),
    [n],
  );
  return (
    <div className="m-confetti pointer-events-none absolute inset-0 overflow-visible">
      {bits.map((b, i) => (
        <i key={i} style={{ background: b.c, ['--x' as string]: `${b.x}px`, ['--y' as string]: `${b.y}px`, ['--r' as string]: `${b.r}deg`, animationDelay: `${b.delay}ms` }} />
      ))}
    </div>
  );
}

export function Countdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = new Date(now);
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const s = Math.max(0, Math.floor((mid - now) / 1000));
  const pad = (x: number) => String(x).padStart(2, '0');
  return <span className="f-num">{`${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</span>;
}
