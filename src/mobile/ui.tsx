import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import { haptic } from '../feedback.ts';
import { tierOf, type ChipColor } from '../puzzles/ranks.ts';

/* ------------------------------------------------------------------ chips */
const CHIP: Record<ChipColor, { base: string; dark: string; insert: string; ink: string }> = {
  white: { base: '#eceff6', dark: '#b9c0d2', insert: '#3d7bff', ink: '#1d2233' },
  red: { base: '#e5484d', dark: '#a8262b', insert: '#ffffff', ink: '#ffffff' },
  green: { base: '#22a565', dark: '#126b3f', insert: '#ffffff', ink: '#ffffff' },
  black: { base: '#2c313d', dark: '#12151c', insert: '#f2d06b', ink: '#ffffff' },
  purple: { base: '#8b5cf6', dark: '#5b33b8', insert: '#ffffff', ink: '#ffffff' },
  gold: { base: '#f5b301', dark: '#a87700', insert: '#ffffff', ink: '#3a2600' },
  blue: { base: '#3d7bff', dark: '#2147a8', insert: '#ffffff', ink: '#ffffff' },
  orange: { base: '#ff8a3d', dark: '#b8541a', insert: '#ffffff', ink: '#ffffff' },
  teal: { base: '#20b5c0', dark: '#0f7179', insert: '#ffffff', ink: '#ffffff' },
  pink: { base: '#f25c9a', dark: '#a8306a', insert: '#ffffff', ink: '#ffffff' },
  slate: { base: '#5b6585', dark: '#363d56', insert: '#ffffff', ink: '#ffffff' },
};

/** A casino chip, seen from above: edge inserts, an inner ring, and whatever sits in the middle. */
export function Chip({ color, size = 44, children, lip = true }: { color: ChipColor; size?: number; children?: ReactNode; lip?: boolean }) {
  const c = CHIP[color];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 66" width={size} height={size * (66 / 64)} className="absolute top-0 left-0 overflow-visible">
        {lip && <circle cx="32" cy="34.5" r="30" fill={c.dark} />}
        <circle cx="32" cy="32" r="30" fill={c.base} />
        <circle cx="32" cy="32" r="26" fill="none" stroke={c.insert} strokeWidth="7" strokeDasharray="8.17 12.25" strokeDashoffset="4" />
        <circle cx="32" cy="32" r="20.5" fill={c.dark} opacity=".45" />
        <circle cx="32" cy="32" r="19" fill={c.base} />
        <circle cx="32" cy="32" r="16.8" fill="none" stroke={c.insert} strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="2.2 2.4" />
        <ellipse cx="32" cy="18" rx="17" ry="8" fill="#fff" opacity=".13" />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-extrabold" style={{ color: c.ink, fontSize: size * 0.27, letterSpacing: '-.02em' }}>
        {children}
      </div>
    </div>
  );
}

/** A few chips tossed together, seen from above — for bets and the pot. */
export function ChipPile({ colors = ['red', 'black'] as ChipColor[], size = 20 }: { colors?: ChipColor[]; size?: number }) {
  const step = size * 0.55;
  return (
    <div className="relative shrink-0" style={{ width: size + step * (colors.length - 1), height: size + 2 }}>
      {colors.map((c, i) => (
        <div key={i} className="absolute" style={{ left: i * step, top: i % 2 ? 2 : 0, zIndex: colors.length - i }}>
          <Chip color={c} size={size} />
        </div>
      ))}
    </div>
  );
}

/** Your rank as a chip (denomination inside). */
export function TierChip({ rating, size = 44 }: { rating: number; size?: number }) {
  const { tier } = tierOf(rating);
  return (
    <Chip color={tier.color} size={size}>
      <span style={{ fontSize: size * (tier.denom.length > 2 ? 0.24 : 0.3) }}>{tier.denom}</span>
    </Chip>
  );
}

/* ------------------------------------------------------------------ cards */
const SUIT = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = ['#161a26', '#e5323b', '#2166e8', '#12924f'];

export function MCard({ card, w = 54, hidden = false, dim = false, className = '', style }: { card?: Card | null; w?: number; hidden?: boolean; dim?: boolean; className?: string; style?: CSSProperties }) {
  const h = Math.round(w * 1.4);
  const r = Math.max(5, Math.round(w * 0.12));
  if (hidden || card === undefined || card === null) {
    return (
      <div
        className={`shrink-0 ${className}`}
        style={{
          width: w,
          height: h,
          borderRadius: r,
          background: '#c8343c',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.18) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(255,255,255,.18) 0 2px, transparent 2px 7px)',
          boxShadow: `inset 0 0 0 ${Math.max(2, w * 0.07)}px #fff, 0 3px 8px rgba(0,0,0,.35)`,
          ...style,
        }}
      />
    );
  }
  const rank = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white ${className}`}
      style={{ width: w, height: h, borderRadius: r, color: SUIT_COLOR[s], boxShadow: '0 -1px 0 rgba(0,0,0,.06) inset, 0 4px 10px rgba(0,0,0,.35)', opacity: dim ? 0.4 : 1, ...style }}
    >
      <div className="absolute flex flex-col items-center" style={{ left: w * 0.09, top: w * 0.05 }}>
        <span className="leading-none font-bold" style={{ fontSize: w * 0.46, letterSpacing: rank === 'T' ? '-.08em' : '-.02em' }}>
          {rank === 'T' ? '10' : rank}
        </span>
        <span className="leading-none" style={{ fontSize: w * 0.3, marginTop: w * 0.02 }}>
          {SUIT[s]}
        </span>
      </div>
      <span className="absolute leading-none" style={{ right: w * 0.07, bottom: w * 0.04, fontSize: w * 0.56 }}>
        {SUIT[s]}
      </span>
    </div>
  );
}

export function MiniCards({ cards, w = 22 }: { cards: readonly Card[]; w?: number }) {
  return (
    <div className="flex gap-0.5">
      {cards.map((c, i) => (
        <MCard key={i} card={c} w={w} />
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- controls */
export type BtnTone = 'go' | 'gold' | 'bad' | 'blue' | 'amber' | 'slate' | 'ghost' | 'outline' | 'card';

/** The 3D button: colour, lip, sinks when pressed. */
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

/** A tappable tile with a lip. */
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
    <span className="m-pill f-num !pl-2.5" style={{ color: n > 0 ? '#ff9f43' : 'var(--text-3)' }}>
      <Flame size={18} fill={n > 0 ? 'currentColor' : 'none'} strokeWidth={2.2} />
      {n}
    </span>
  );
}

export function RatingPill({ rating }: { rating: number }) {
  return (
    <span className="m-pill f-num">
      <TierChip rating={rating} size={24} />
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
      <div className="flex items-center justify-between pt-3 pb-1">
        <h1 className="f-display">{title}</h1>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <div className="mt-4 flex flex-col gap-7">{children}</div>
    </div>
  );
}

/** A pushed screen with a back chevron. */
export function PushScreen({ title, children }: { title: string; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="m-fade px-5 pb-10">
      <div className="m-safe-top" />
      <div className="relative flex h-12 items-center">
        <button
          aria-label="Back"
          className="m-press -ml-2 grid h-10 w-10 place-items-center rounded-full"
          onClick={() => {
            haptic.tap();
            nav(-1);
          }}
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <div className="f-ui absolute inset-x-12 text-center font-bold">{title}</div>
      </div>
      <div className="mt-3 flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function Section({ title, action, children, note }: { title?: ReactNode; action?: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between">
          {title && <h2 className="f-head">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {note && <p className="f-small t3 mt-2 px-1">{note}</p>}
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
    <div className="flex min-h-[56px] items-center gap-3.5 px-4 py-3">
      {icon}
      <div className="min-w-0 flex-1">
        <div className={`f-ui truncate font-semibold ${danger ? 'c-bad' : ''}`}>{title}</div>
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
export function Sparkline({ data, w = 120, h = 36, color = 'var(--gold)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
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
          <stop offset="0" stopColor={color} stopOpacity=".3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4.5" fill={color} stroke="var(--s1)" strokeWidth="2" />
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

export function Ring({ value, size = 64, stroke = 8, color = 'var(--go)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--s3)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--go)', h = 10 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden" style={{ height: h, background: 'var(--s3)', borderRadius: h }}>
      <div className="relative h-full" style={{ width: `${Math.max(0.02, Math.min(1, value)) * 100}%`, background: color, borderRadius: h, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }}>
        {h >= 8 && <div className="absolute inset-x-2 top-[2px] h-[3px] rounded-full bg-white/30" />}
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

const CONF_COLORS = ['#2bd67b', '#ffc233', '#3d7bff', '#ff5a5f', '#8b5cf6', '#ffffff'];
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
