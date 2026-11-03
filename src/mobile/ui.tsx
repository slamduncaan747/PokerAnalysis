import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import { haptic } from '../feedback.ts';

/* ------------------------------------------------------------------ cards */
const SUIT = ['♠', '♥', '♦', '♣'];
// Four-colour deck: suits read at a glance, even small.
const SUIT_COLOR = ['#1c1c1e', '#e0322b', '#1f6fe5', '#14904f'];

export function MCard({ card, w = 54, hidden = false, dim = false, className = '', style }: { card?: Card | null; w?: number; hidden?: boolean; dim?: boolean; className?: string; style?: CSSProperties }) {
  const h = Math.round(w * 1.38);
  const r = Math.max(5, Math.round(w * 0.13));
  if (hidden || card === undefined || card === null) {
    return <div className={`shrink-0 ${className}`} style={{ width: w, height: h, borderRadius: r, background: 'var(--card-back)', boxShadow: `inset 0 0 0 ${Math.max(2, w * 0.07)}px rgba(255,255,255,.9), 0 2px 6px rgba(0,0,0,.25)`, ...style }} />;
  }
  const rank = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white ${className}`}
      style={{ width: w, height: h, borderRadius: r, color: SUIT_COLOR[s], boxShadow: '0 0 0 .5px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.18)', opacity: dim ? 0.4 : 1, ...style }}
    >
      <div className="absolute flex flex-col items-center" style={{ left: w * 0.1, top: w * 0.07 }}>
        <span className="t-rounded leading-none font-bold" style={{ fontSize: w * 0.44, letterSpacing: rank === 'T' ? '-.06em' : 0 }}>
          {rank === 'T' ? '10' : rank}
        </span>
        <span className="leading-none" style={{ fontSize: w * 0.3, marginTop: w * 0.03 }}>
          {SUIT[s]}
        </span>
      </div>
      <span className="absolute leading-none" style={{ right: w * 0.08, bottom: w * 0.06, fontSize: w * 0.5 }}>
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

/* --------------------------------------------------------------- layout */
/**
 * A screen with an iOS navigation bar: a large title that collapses into a small centred title in a
 * translucent bar as you scroll, an optional back button and trailing control.
 */
export function Screen({ title, eyebrow, right, children, back, backLabel = 'Back' }: { title: string; eyebrow?: ReactNode; right?: ReactNode; children: ReactNode; back?: boolean; backLabel?: string }) {
  const nav = useNavigate();
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="m-fade">
      <header className={`sticky top-0 z-20 m-safe-top transition-[background-color,box-shadow] duration-200 ${collapsed ? 'm-bar m-hair-b' : ''}`}>
        <div className="relative flex h-11 items-center justify-between px-2">
          <div className="z-10 flex min-w-[70px] items-center">
            {back && (
              <button
                className="m-press flex items-center text-[17px] c-tint"
                onClick={() => {
                  haptic.tap();
                  nav(-1);
                }}
              >
                <ChevronLeft size={28} strokeWidth={2.2} className="-mr-0.5" />
                {backLabel}
              </button>
            )}
          </div>
          <div className="t-headline absolute inset-x-0 text-center transition-opacity duration-200" style={{ opacity: collapsed ? 1 : 0 }}>
            {title}
          </div>
          <div className="z-10 flex min-w-[70px] justify-end pr-2">{collapsed && right}</div>
        </div>
      </header>
      <div className="px-4 pb-10">
        <div className="flex items-end justify-between gap-3 pt-1 pb-4">
          <div className="min-w-0">
            {eyebrow && <div className="t-foot c-2 font-semibold uppercase">{eyebrow}</div>}
            <h1 className="t-large">{title}</h1>
          </div>
          {right && <div className="pb-1">{right}</div>}
        </div>
        <div ref={sentinel} className="h-0" />
        <div className="flex flex-col gap-7">{children}</div>
      </div>
    </div>
  );
}

/** A content section with a bold header (like the App Store), or a settings-style small caps header. */
export function Section({ title, action, footer, children, small = false }: { title?: ReactNode; action?: ReactNode; footer?: ReactNode; children: ReactNode; small?: boolean }) {
  return (
    <section>
      {(title || action) && (
        <div className={`flex items-end justify-between ${small ? 'mb-1.5 px-4' : 'mb-2.5 px-1'}`}>
          {title && (small ? <h2 className="t-foot c-2 uppercase">{title}</h2> : <h2 className="t-title3 font-bold">{title}</h2>)}
          {action}
        </div>
      )}
      {children}
      {footer && <p className="t-foot c-2 mt-1.5 px-4">{footer}</p>}
    </section>
  );
}

export function Group({ children, inset = 16 }: { children: ReactNode; inset?: number }) {
  return (
    <div className="m-group" style={{ ['--inset' as string]: `${inset}px` }}>
      {children}
    </div>
  );
}

/** A list row: optional icon tile, title, subtitle, trailing value/accessory and a disclosure chevron. */
export function Row({ icon, title, sub, value, right, to, onClick, href, chevron = true, danger = false, center = false }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; value?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; href?: string; chevron?: boolean; danger?: boolean; center?: boolean }) {
  const tappable = !!(to || onClick || href);
  const inner = (
    <div className={`flex min-h-[44px] items-center gap-3 py-2.5 pr-4 pl-4 ${center ? 'justify-center' : ''}`}>
      {icon}
      <div className={`min-w-0 ${center ? '' : 'flex-1'}`}>
        <div className={`t-body truncate ${danger ? 'c-red' : center ? 'c-tint' : ''}`}>{title}</div>
        {sub && <div className="t-foot c-2 truncate">{sub}</div>}
      </div>
      {value !== undefined && <div className="t-body c-2 t-num shrink-0">{value}</div>}
      {right}
      {chevron && tappable && !center && <ChevronRight size={18} strokeWidth={2.4} className="c-3 -mr-1 shrink-0" />}
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

/* -------------------------------------------------------------- controls */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="relative grid h-8 rounded-[9px] p-[2px]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: 'var(--fill)' }}>
      <div
        className="absolute top-[2px] bottom-[2px] rounded-[7px] transition-transform duration-300"
        style={{ width: `calc((100% - 4px) / ${options.length})`, left: 2, transform: `translateX(${idx * 100}%)`, background: 'var(--seg)', boxShadow: '0 3px 8px rgba(0,0,0,.12), 0 3px 1px rgba(0,0,0,.04)', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          className={`relative z-10 text-[13px] ${o.value === value ? 'font-semibold' : 'font-medium'}`}
          onClick={() => {
            if (o.value !== value) haptic.tap();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS switch. */
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
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--green)' : 'var(--fill-2)' }}
    >
      <span className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white transition-transform duration-200" style={{ transform: checked ? 'translateX(20px)' : 'none', boxShadow: '0 3px 8px rgba(0,0,0,.15), 0 3px 1px rgba(0,0,0,.06)' }} />
    </button>
  );
}

export function Button({ children, onClick, to, className = '', tone = 'filled', disabled }: { children: ReactNode; onClick?: () => void; to?: string; className?: string; tone?: 'filled' | 'tinted' | 'gray' | 'plain'; disabled?: boolean }) {
  const cls = `m-press m-btn m-btn-${tone} ${className}`;
  if (to)
    return (
      <Link to={to} className={cls} onClick={() => haptic.press()}>
        {children}
      </Link>
    );
  return (
    <button
      className={cls}
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

export function Badge({ n, color = 'var(--red)' }: { n: number; color?: string }) {
  if (n <= 0) return null;
  return <span className="t-num inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[13px] font-semibold text-white" style={{ background: color }}>{n > 99 ? '99+' : n}</span>;
}

export function StreakLabel({ n }: { n: number }) {
  return (
    <span className="t-sub inline-flex items-center gap-1 font-semibold" style={{ color: n > 0 ? 'var(--orange)' : 'var(--label-3)' }}>
      <Flame size={16} fill={n > 0 ? 'currentColor' : 'none'} strokeWidth={2} />
      <span className="t-num">{n}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- charts */
export function Sparkline({ data, w = 120, h = 36, color = 'var(--tint)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
  const id = useMemo(() => `sg${Math.random().toString(36).slice(2, 8)}`, []);
  if (data.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
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
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} stroke="var(--bg-2)" strokeWidth="1.5" />
    </svg>
  );
}

/** Rating history with light gridlines and value labels, like Health and Stocks. */
export function RatingChart({ data, h = 150 }: { data: number[]; h?: number }) {
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
  const min = Math.min(...data);
  const max = Math.max(...data);
  const plotW = Math.max(40, w - 40);
  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between" style={{ right: 40 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-px" style={{ background: 'var(--sep)' }} />
        ))}
      </div>
      {data.length < 2 ? (
        <div className="t-foot c-2 relative grid h-full place-items-center" style={{ paddingRight: 40 }}>
          Solve a few puzzles to see your progress
        </div>
      ) : (
        <>
          <Sparkline data={data} w={plotW} h={h - 2} />
          <span className="t-cap c-2 t-num absolute top-0 right-0">{max}</span>
          <span className="t-cap c-2 t-num absolute right-0 bottom-0">{min}</span>
        </>
      )}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--green)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fill)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--tint)', h = 4 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden" style={{ height: h, background: 'var(--fill)', borderRadius: h }}>
      <div className="h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, borderRadius: h, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
    </div>
  );
}

/* ----------------------------------------------------------- animations */
export function CountUp({ from, to, ms = 700, className = '' }: { from: number; to: number; ms?: number; className?: string }) {
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
  return <span className={`t-num ${className}`}>{v.toLocaleString()}</span>;
}

const CONF_COLORS = ['#34c759', '#ff9500', '#5856d6', '#ff2d55', '#ffcc00', '#30b0c7'];
export function Confetti({ n = 40 }: { n?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = 120 + Math.random() * 170;
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
  return <span className="t-num">{`${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</span>;
}
