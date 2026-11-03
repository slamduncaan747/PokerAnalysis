import { Crosshair, GraduationCap, LayoutDashboard, ListOrdered, Lock, Upload } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store.ts';
import { ProgressBar } from './ui.tsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hands', label: 'Hands', icon: ListOrdered },
  { to: '/leaks', label: 'Leaks', icon: Crosshair },
  { to: '/train', label: 'Train', icon: GraduationCap },
  { to: '/import', label: 'Import', icon: Upload },
];

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden>
        <rect width="64" height="64" rx="14" fill="#3ecf8e" />
        <path d="M32 12c-9 10-18 15-18 24a9 9 0 0 0 15 6.5L26 52h12l-3-9.5A9 9 0 0 0 50 36c0-9-9-14-18-24z" fill="#06140d" />
      </svg>
      <span className="text-lg font-extrabold tracking-tight">Leakfinder</span>
    </div>
  );
}

function ImportStatusBar() {
  const status = useStore((s) => s.status);
  if (status.phase !== 'parsing' && status.phase !== 'analyzing') return null;
  const pct = status.total ? (status.done / status.total) * 100 : 5;
  return (
    <div className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur px-4 py-2">
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-xs text-mute">
        <span className="whitespace-nowrap font-medium text-ink">
          {status.phase === 'parsing' ? status.message ?? 'Reading hand histories…' : `Analyzing hands ${status.done.toLocaleString()} / ${status.total.toLocaleString()}`}
        </span>
        <ProgressBar value={pct} />
      </div>
    </div>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-full">
      <aside className="hidden md:flex w-56 shrink-0 flex-col gap-1 border-r border-line bg-panel/60 px-3 py-5 sticky top-0 h-screen">
        <div className="px-2 mb-6">
          <Logo />
        </div>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-panel-3 text-ink' : 'text-mute hover:bg-panel-2 hover:text-ink'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto rounded-lg border border-line bg-panel-2 p-3 text-[11px] leading-relaxed text-mute">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
            <Lock size={12} /> 100% private
          </div>
          Hand histories are analyzed in your browser and never leave your device.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-line bg-panel/95 backdrop-blur px-4 py-3">
          <Logo />
        </header>
        <ImportStatusBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 md:px-8 md:pb-10">
          <Outlet />
        </main>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-line bg-panel/95 backdrop-blur">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[10px] ${isActive ? 'text-accent' : 'text-mute'}`}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
