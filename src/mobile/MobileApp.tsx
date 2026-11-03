import { CalendarDays, CircleUserRound, Puzzle, Target } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getCloudConfig } from '../cloud/config.ts';
import { useCloud } from '../cloud/state.ts';
import { haptic } from '../feedback.ts';
import { usePuzzles } from '../puzzles/store.ts';
import { useStore } from '../store.ts';
import Today from './Today.tsx';

const PuzzlesTab = lazy(() => import('./PuzzlesTab.tsx'));
const MyGame = lazy(() => import('./MyGame.tsx'));
const Profile = lazy(() => import('./Profile.tsx'));
const SettingsSelect = lazy(() => import('./Profile.tsx').then((m) => ({ default: m.SettingsSelect })));
const Devices = lazy(() => import('./Devices.tsx'));
const MobileHand = lazy(() => import('./MobileHand.tsx'));
const RatedRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.RatedRun })));
const DailyRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.DailyRun })));
const PracticeRun = lazy(() => import('./runs.tsx').then((m) => ({ default: m.PracticeRun })));
const PuzzleReview = lazy(() => import('./runs.tsx').then((m) => ({ default: m.PuzzleReview })));

const TABS = [
  { to: '/', label: 'Today', icon: CalendarDays, end: true },
  { to: '/puzzles', label: 'Puzzles', icon: Puzzle },
  { to: '/game', label: 'My Game', icon: Target },
  { to: '/profile', label: 'Profile', icon: CircleUserRound },
];

function TabBar() {
  return (
    <nav className="m-bar m-hair-t fixed inset-x-0 bottom-0 z-20">
      <div className="mx-auto flex max-w-[600px]">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            replace
            onClick={() => haptic.tap()}
            className="flex flex-1 flex-col items-center gap-[3px] pt-[7px] pb-1"
            style={({ isActive }) => ({ color: isActive ? 'var(--tint)' : 'var(--gray)' })}
          >
            {({ isActive }) => (
              <>
                <Icon size={25} strokeWidth={isActive ? 2.3 : 1.8} />
                <span className="text-[10px] leading-none font-medium tracking-[.1px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      <div className="m-safe-bottom" />
    </nav>
  );
}

function Tabs() {
  const loc = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div ref={ref} className="min-h-[100dvh]" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="mx-auto max-w-[600px]">
        <Suspense fallback={<div className="h-[60vh]" />}>
          <Outlet />
        </Suspense>
      </div>
      <TabBar />
    </div>
  );
}

const Blank = () => <div className="m-app fixed inset-0" />;

/** The phone app: puzzles first, your own hands second. Fully usable without ever importing a hand. */
export default function MobileApp() {
  const init = useStore((s) => s.init);
  const ensureBank = usePuzzles((s) => s.ensureBank);
  useEffect(() => {
    document.documentElement.classList.add('mobile-ui');
    void init().then(() => {
      if (getCloudConfig()) import('../cloud/cloud.ts').then((m) => m.initCloud());
      else useCloud.setState({ configured: false, ready: true });
    });
    // Warm the puzzle bank so the first puzzle opens instantly.
    const t = setTimeout(() => void ensureBank(), 400);
    return () => clearTimeout(t);
  }, [init, ensureBank]);
  return (
    <div className="m-app">
      <HashRouter>
        <Routes>
          <Route element={<Tabs />}>
            <Route path="/" element={<Today />} />
            <Route path="/puzzles" element={<PuzzlesTab />} />
            <Route path="/game" element={<MyGame />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/hand/:id" element={<MobileHand />} />
            <Route path="/settings/:key" element={<SettingsSelect />} />
          </Route>
          <Route
            path="/play"
            element={
              <Suspense fallback={<Blank />}>
                <RatedRun />
              </Suspense>
            }
          />
          <Route
            path="/daily"
            element={
              <Suspense fallback={<Blank />}>
                <DailyRun />
              </Suspense>
            }
          />
          <Route
            path="/practice"
            element={
              <Suspense fallback={<Blank />}>
                <PracticeRun />
              </Suspense>
            }
          />
          <Route
            path="/review/:id"
            element={
              <Suspense fallback={<Blank />}>
                <PuzzleReview />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </div>
  );
}
