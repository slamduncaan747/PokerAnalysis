import { CalendarDays, Target, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { haptic } from '../feedback.ts';
import { Btn, Chip, IconBadge, MCard } from './ui.tsx';

const KEY = 'lf.welcomed';

export function needsWelcome(games: number): boolean {
  if (games > 0) return false;
  try {
    return !localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

function done() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: just show it again next time */
  }
}

const POINTS = [
  { icon: <CalendarDays size={21} strokeWidth={2.5} />, color: 'green' as const, title: 'Three hands a day', sub: 'The Daily Hand takes two minutes.' },
  { icon: <TrendingUp size={21} strokeWidth={2.5} />, color: 'gold' as const, title: 'A rating that moves', sub: 'Solve puzzles, climb from Fish to Crusher.' },
  { icon: <Target size={21} strokeWidth={2.5} />, color: 'red' as const, title: 'Checked by a solver', sub: 'Every answer is the real best play.' },
];

/** First launch only: say what this is in one screen, then put a hand in front of them. */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const nav = useNavigate();
  const leave = (to?: string) => {
    haptic.tap();
    done();
    onDone();
    if (to) nav(to);
  };
  return (
    <div className="m-app m-fade fixed inset-0 z-50 flex flex-col overflow-y-auto">
      <div className="m-safe-top" />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4">
        <div className="m-rail m-pop" style={{ borderRadius: 40 }}>
          <div className="m-felt relative flex h-[230px] items-center justify-center overflow-hidden" style={{ borderRadius: 32 }}>
            <div className="absolute top-[18%] left-[9%] -rotate-12"><Chip color="red" size={48}><span>5</span></Chip></div>
            <div className="absolute bottom-[14%] left-[20%] rotate-6"><Chip color="black" size={40}><span>100</span></Chip></div>
            <div className="flex">
              <MCard card={51} w={88} className="m-deal" style={{ transform: 'rotate(-9deg) translateY(6px)' }} />
              <MCard card={50} w={88} className="m-deal" style={{ marginLeft: -20, transform: 'rotate(9deg)', ['--i' as string]: 1 }} />
            </div>
            <div className="absolute top-[14%] right-[10%] rotate-12"><Chip color="green" size={44}><span>25</span></Chip></div>
            <div className="absolute right-[18%] bottom-[12%] -rotate-6"><Chip color="purple" size={38}><span>500</span></Chip></div>
          </div>
        </div>
        <h1 className="f-display mt-8" style={{ fontSize: 38, lineHeight: 1.05 }}>
          Get better at poker, one hand at a time.
        </h1>
        <div className="mt-7 flex flex-col gap-5">
          {POINTS.map((p, i) => (
            <div key={p.title} className="m-in flex items-center gap-4" style={{ ['--i' as string]: i + 2 }}>
              <IconBadge color={p.color} size={46}>{p.icon}</IconBadge>
              <div>
                <div className="text-[17px] leading-tight font-bold">{p.title}</div>
                <div className="f-ui t2 mt-0.5 font-normal">{p.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-8 pb-4">
          <Btn onClick={() => leave('/daily')}>Play your first hand</Btn>
          <Btn tone="ghost" onClick={() => leave()}>
            Look around first
          </Btn>
        </div>
      </div>
      <div className="m-safe-bottom" />
    </div>
  );
}
