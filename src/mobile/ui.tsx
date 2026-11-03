import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import { haptic } from '../feedback.ts';

/* ------------------------------------------------------------------ cards */
const SUIT = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = ['#151a24', '#d92f3d', '#2466d6', '#1a8a4a'];

/** A real-looking playing card. Width drives everything; four-colour deck so suits read at a glance. */
export function MCard({ card, w = 54, hidden = false, dim = false, className = '', style }: { card?: Card | null; w?: number; hidden?: boolean; dim?: boolean; className?: string; style?: CSSProperties }) {
  const h = Math.round(w * 1.4);
  const r = Math.max(6, Math.round(w * 0.14));
  if (hidden || card === undefined || card === null) {
    return (
      <div
        className={`shrink-0 ${className}`}
        style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(135deg,#2e3f6e,#1f2b4d)', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.12), 0 6px 14px -6px rgba(0,0,0,.6)', ...style }}
      />
    );
  }
  const rank = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white ${className}`}
      style={{ width: w, height: h, borderRadius: r, color: SUIT_COLOR[s], boxShadow: '0 1px 0 rgba(255,255,255,.6) inset, 0 8px 18px -8px rgba(0,0,0,.7), 0 2px 4px rgba(0,0,0,.25)', opacity: dim ? 0.4 : 1, ...style }}
    >
      <div className="absolute flex flex-col items-center leading-none" style={{ left: w * 0.1, top: w * 0.08 }}>
        <span className="font-black tracking-tight" style={{ fontSize: w * 0.44, letterSpacing: rank === 'T' ? '-.06em' : undefined }}>
          {rank === 'T' ? '10' : rank}
        </span>
        <span style={{ fontSize: w * 0.3, marginTop: w * 0.02 }}>{SUIT[s]}</span>
      </div>
      <span className="absolute leading-none" style={{ right: w * 0.06, bottom: w * 0.02, fontSize: w * 0.62 }}>
        {SUIT[s]}
      </span>
    </div>
  );
}

/** Two small cards inline, for lists. */
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
export function Screen({ title, subtitle, right, children, back }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; back?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="m-fade px-4 pb-6">
      <div className="m-safe-top" />
      {back && (
        <button
          className="m-tap -ml-2 mt-2 flex items-center text-[17px] font-medium text-accent"
          onClick={() => {
            haptic.tap();
            nav(-1);
          }}
        >
          <ChevronLeft size={26} /> Back
        </button>
      )}
      <div className="flex items-end justify-between gap-3 pt-3 pb-4">
        <div className="min-w-0">
          {subtitle && <div className="m-label mb-1">{subtitle}</div>}
          <h1 className="m-title">{title}</h1>
        </div>
        {right}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Section({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="m-h2">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Tappable row inside a grouped list. */
export function Row({ icon, title, sub, right, to, onClick, href, chevron = true, danger = false }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; href?: string; chevron?: boolean; danger?: boolean }) {
  const inner = (
    <div className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
      {icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-white/[.06] text-[18px]">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[16px] font-[560] ${danger ? 'text-loss' : ''}`}>{title}</div>
        {sub && <div className="truncate text-[13px] text-mute">{sub}</div>}
      </div>
      {right}
      {chevron && (to || onClick || href) && <ChevronRight size={18} className="shrink-0 text-dim" />}
    </div>
  );
  const tap = () => {
    haptic.tap();
    onClick?.();
  };
  if (to)
    return (
      <Link to={to} onClick={() => haptic.tap()} className="m-tap block">
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => haptic.tap()} className="m-tap block">
        {inner}
      </a>
    );
  if (onClick)
    return (
      <button onClick={tap} className="m-tap block w-full text-left">
        {inner}
      </button>
    );
  return inner;
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="m-card divide-y divide-white/[.06] overflow-hidden">{children}</div>;
}

/* -------------------------------------------------------------- controls */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="relative grid rounded-[12px] bg-white/[.07] p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <div
        className="absolute top-[3px] bottom-[3px] rounded-[9px] bg-[#3a4150] shadow transition-transform duration-300"
        style={{ width: `calc((100% - 6px) / ${options.length})`, left: 3, transform: `translateX(${idx * 100}%)`, transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          className="relative z-10 h-9 text-[14px] font-semibold"
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
      style={{ background: checked ? 'var(--color-accent)' : 'rgba(255,255,255,.16)' }}
    >
      <span className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200" style={{ transform: checked ? 'translateX(20px)' : 'none' }} />
    </button>
  );
}

export function PrimaryButton({ children, onClick, to, className = '', tone = 'primary', disabled }: { children: ReactNode; onClick?: () => void; to?: string; className?: string; tone?: 'primary' | 'ghost' | 'light'; disabled?: boolean }) {
  const cls = `m-tap m-btn m-btn-${tone} ${className}`;
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

/* ---------------------------------------------------------------- charts */
export function Sparkline({ data, w = 120, h = 36, color = 'var(--color-accent)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
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
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
    </svg>
  );
}

/** Rating history with min/max labels; width follows the container. */
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
  return (
    <div ref={ref} className="relative w-full" style={{ height: h }}>
      {data.length < 2 ? (
        <div className="grid h-full place-items-center text-[14px] text-dim">Solve a few puzzles to see your graph</div>
      ) : (
        <>
          <Sparkline data={data} w={w} h={h - 4} />
          <span className="m-num absolute top-0 right-0 text-[11px] text-dim">{max}</span>
          <span className="m-num absolute right-0 bottom-0 text-[11px] text-dim">{min}</span>
        </>
      )}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color = 'var(--color-accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--color-accent)', h = 6 }: { value: number; color?: string; h?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/[.07]" style={{ height: h }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
    </div>
  );
}

/* ----------------------------------------------------------- animations */
/** Counts from `from` to `to` (used for rating changes). */
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
  return <span className={`m-num ${className}`}>{v.toLocaleString()}</span>;
}

const CONF_COLORS = ['#3ecf8e', '#f3c23a', '#5c8fdb', '#ef6aa8', '#1cb6a6', '#ffffff'];
export function Confetti({ n = 36 }: { n?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = 120 + Math.random() * 160;
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

/** "05:12:33" until local midnight. */
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
  return <span className="m-num">{`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</span>;
}

export function Flame({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-bold" style={{ fontSize: size }}>
      <span className={n > 0 ? 'm-flame' : 'opacity-40 grayscale'}>🔥</span>
      <span className="m-num">{n}</span>
    </span>
  );
}
