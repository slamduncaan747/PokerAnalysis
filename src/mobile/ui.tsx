import { ArrowLeft, ChevronRight, Flame } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rankOf, RANKS, suitOf, type Card } from '../lib/cards.ts';
import { haptic } from '../feedback.ts';

/* ------------------------------------------------------------------ cards */
const SUIT = ['♠', '♥', '♦', '♣'];
const SUIT_COLOR = ['#171613', '#d4372c', '#2260cf', '#13804b'];

/** A paper playing card with a serif rank. Four-colour deck so suits read at a glance. */
export function MCard({ card, w = 54, hidden = false, dim = false, className = '', style }: { card?: Card | null; w?: number; hidden?: boolean; dim?: boolean; className?: string; style?: CSSProperties }) {
  const h = Math.round(w * 1.4);
  const r = Math.max(5, Math.round(w * 0.11));
  if (hidden || card === undefined || card === null) {
    return (
      <div
        className={`shrink-0 ${className}`}
        style={{
          width: w,
          height: h,
          borderRadius: r,
          background: '#1c1b18',
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,99,25,.55) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(255,99,25,.55) 0 1px, transparent 1px 6px)',
          boxShadow: `inset 0 0 0 ${Math.max(2, w * 0.08)}px #1c1b18, inset 0 0 0 ${Math.max(2, w * 0.08) + 1}px rgba(242,237,227,.25), 0 6px 14px -6px rgba(0,0,0,.7)`,
          ...style,
        }}
      />
    );
  }
  const rank = RANKS[rankOf(card)];
  const s = suitOf(card);
  return (
    <div
      className={`relative shrink-0 overflow-hidden ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: '#f4efe6',
        color: SUIT_COLOR[s],
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.07), 0 10px 22px -10px rgba(0,0,0,.75), 0 2px 4px rgba(0,0,0,.3)',
        opacity: dim ? 0.4 : 1,
        ...style,
      }}
    >
      <div className="absolute flex flex-col items-center" style={{ left: w * 0.09, top: w * 0.02 }}>
        <span className="m-serif leading-none" style={{ fontSize: w * 0.6, letterSpacing: rank === 'T' ? '-.08em' : '-.02em' }}>
          {rank === 'T' ? '10' : rank}
        </span>
        <span className="leading-none" style={{ fontSize: w * 0.27, marginTop: -w * 0.02 }}>
          {SUIT[s]}
        </span>
      </div>
      <span className="absolute leading-none" style={{ right: w * 0.07, bottom: w * 0.05, fontSize: w * 0.56 }}>
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
export function Screen({ title, eyebrow, right, children, back }: { title: ReactNode; eyebrow?: ReactNode; right?: ReactNode; children: ReactNode; back?: boolean }) {
  const nav = useNavigate();
  return (
    <div className="m-fade px-5 pb-8">
      <div className="m-safe-top" />
      <div className="flex h-12 items-center justify-between">
        {back ? (
          <button
            aria-label="Back"
            className="m-tap -ml-1 grid h-10 w-10 place-items-center rounded-full border border-[var(--line-2)]"
            onClick={() => {
              haptic.tap();
              nav(-1);
            }}
          >
            <ArrowLeft size={19} />
          </button>
        ) : (
          <span className="m-label">{eyebrow}</span>
        )}
        {right}
      </div>
      <h1 className="m-title mt-3 mb-6">{title}</h1>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function Section({ title, kicker, action, children, className = '' }: { title?: ReactNode; kicker?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {kicker && <div className="m-label mb-1">{kicker}</div>}
            <h2 className="m-h2">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({ icon, title, sub, right, to, onClick, href, chevron = true, danger = false }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; to?: string; onClick?: () => void; href?: string; chevron?: boolean; danger?: boolean }) {
  const inner = (
    <div className="flex min-h-[58px] items-center gap-3.5 px-4 py-3">
      {icon && <div className="grid h-8 w-8 shrink-0 place-items-center text-[var(--mute)]">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15.5px] font-medium ${danger ? 'm-loss' : ''}`}>{title}</div>
        {sub && <div className="truncate text-[13px] text-[var(--mute)]">{sub}</div>}
      </div>
      {right}
      {chevron && (to || onClick || href) && <ChevronRight size={17} className="shrink-0 text-[var(--dim)]" />}
    </div>
  );
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
      <button
        onClick={() => {
          haptic.tap();
          onClick();
        }}
        className="m-tap block w-full text-left"
      >
        {inner}
      </button>
    );
  return inner;
}

export function Group({ children }: { children: ReactNode }) {
  return <div className="m-card m-divide overflow-hidden">{children}</div>;
}

/* -------------------------------------------------------------- controls */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="relative grid rounded-[12px] border border-[var(--line)] bg-[var(--ink)] p-[3px]" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <div
        className="absolute top-[3px] bottom-[3px] rounded-[9px] bg-[var(--paper)] transition-transform duration-300"
        style={{ width: `calc((100% - 6px) / ${options.length})`, left: 3, transform: `translateX(${idx * 100}%)`, transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          className="relative z-10 h-9 text-[13.5px] font-semibold transition-colors duration-300"
          style={{ color: o.value === value ? 'var(--ink)' : 'var(--mute)' }}
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
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--signal)' : 'var(--ink-4)' }}
    >
      <span className="absolute top-[3px] left-[3px] h-[24px] w-[24px] rounded-full transition-transform duration-200" style={{ background: 'var(--paper)', transform: checked ? 'translateX(20px)' : 'none' }} />
    </button>
  );
}

export function PrimaryButton({ children, onClick, to, className = '', tone = 'primary', disabled }: { children: ReactNode; onClick?: () => void; to?: string; className?: string; tone?: 'primary' | 'signal' | 'ghost' | 'ink'; disabled?: boolean }) {
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
export function Sparkline({ data, w = 120, h = 36, color = 'var(--signal)', fill = true }: { data: number[]; w?: number; h?: number; color?: string; fill?: boolean }) {
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
          <stop offset="0" stopColor={color} stopOpacity=".28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={`${d}L${w},${h}L0,${h}Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="7" fill={color} opacity=".2" />
    </svg>
  );
}

/** Rating history on a hairline grid; width follows the container. */
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
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="m-dash text-[var(--text)]" />
        ))}
      </div>
      {data.length < 2 ? (
        <div className="relative grid h-full place-items-center text-[13px] text-[var(--dim)]">
          <span className="m-mono bg-[var(--ink-2)] px-2">NO DATA YET — SOLVE A FEW</span>
        </div>
      ) : (
        <>
          <Sparkline data={data} w={w} h={h - 4} />
          <span className="m-mono absolute top-1 right-0 text-[10.5px] text-[var(--dim)]">{max}</span>
          <span className="m-mono absolute right-0 bottom-1 text-[10.5px] text-[var(--dim)]">{min}</span>
        </>
      )}
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, color = 'var(--signal)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(242,237,227,.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="butt" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'var(--paper)', h = 4, track = 'rgba(242,237,227,.08)' }: { value: number; color?: string; h?: number; track?: string }) {
  return (
    <div className="w-full overflow-hidden" style={{ height: h, background: track, borderRadius: h }}>
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
  return <span className={`m-num ${className}`}>{v.toLocaleString()}</span>;
}

const CONF_COLORS = ['#ff6319', '#f2ede3', '#fccc0a', '#00add0', '#33c27a'];
export function Confetti({ n = 36 }: { n?: number }) {
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
  return <span className="m-num">{`${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</span>;
}

/** Daily streak chip: a lit flame when alive. */
export function Streak({ n, big = false }: { n: number; big?: boolean }) {
  const on = n > 0;
  return (
    <span className={`inline-flex items-center gap-1.5 ${big ? '' : 'm-chip !normal-case !tracking-normal'}`} style={{ color: on ? 'var(--signal)' : 'var(--dim)', borderColor: on ? 'rgba(255,99,25,.45)' : undefined }}>
      <Flame size={big ? 26 : 14} strokeWidth={2} fill={on ? 'currentColor' : 'none'} className={on ? 'm-live' : ''} />
      <span className={`m-num font-semibold ${big ? 'text-[34px] text-[var(--text)]' : 'text-[13px]'}`}>{n}</span>
    </span>
  );
}

/** The Leakfinder mark: a spade with a leak. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 64 76" aria-hidden>
      <path d="M32 6C22 18 10 25 10 37a10.5 10.5 0 0 0 18 7.4L25 54h14l-3-9.6A10.5 10.5 0 0 0 54 37C54 25 42 18 32 6z" fill="var(--paper)" />
      <path d="M32 58.5c-2.9 0-5-2.1-5-4.8 0-2.7 2.7-6.3 5-9.2 2.3 2.9 5 6.5 5 9.2 0 2.7-2.1 4.8-5 4.8z" fill="var(--signal)" transform="translate(0 9.5)" />
    </svg>
  );
}

/** Serif text with amounts and numbers set in Geist, so "11bb" never reads as "llbb". */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/((?:[−-]\s?)?[$€£₮]?\d[\d,]*(?:\.\d+)?(?:bb|%)?)/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} style={{ fontFamily: 'var(--f-sans)', fontSize: '.8em', fontWeight: 500, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
