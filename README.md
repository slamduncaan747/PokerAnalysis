# Leakfinder — free poker hand review

Upload your poker hand histories and get a **chess.com-style game review** of your play:
every decision graded from **Brilliant / Great / Best** down to **Inaccuracy / Mistake / Blunder**,
your biggest leaks ranked by how many big blinds they cost, and **training drills built from your
own mistakes** (with spaced repetition) so the fixes actually stick.

Everything runs **in your browser**. Hand histories are never uploaded anywhere — they're parsed,
analyzed and stored locally (IndexedDB). It's a static site, so hosting is free (GitHub Pages,
Netlify, Vercel, or just `npm run dev`).

## Features

| | |
|---|---|
| **Import** | Drag & drop `.txt` hand histories (or paste). Duplicates skipped. Supports PokerStars (cash, Zoom, MTT/SNG), GGPoker/Natural8 exports, ACR/WPN, Winamax, Ignition/Bovada/Bodog, and most PokerStars-style formats. NLHE only. |
| **Dashboard** | Win rate (bb/100), all-in EV ("luck"), EV lost to mistakes, accuracy ring + move-classification breakdown, results graph (net / all-in EV / showdown / non-showdown), win rate by position, accuracy & EV lost by street, costliest hands. |
| **Stats vs. winning ranges** | VPIP, PFR, 3-bet, fold to 3-bet, steal, BB fold vs steal, open-limp, c-bet, fold to c-bet, WTSD, W$SD, WWSF, AF/AFq — each plotted against a typical winning-reg band with advice when you're outside it. |
| **Leak finder** | Mistakes grouped into ~20 leak types (calling down too light, missing value, over-folding the BB, flatting 3-bet hands, bluffing into strength, …), ranked by bb lost, each with an explanation, how-to-fix, and links to the exact hands. |
| **Hand review** | Replayer with an equity "eval bar", move list annotated with classification badges, and a coach panel for each of your decisions: what you did, the best option, the EV of every option (or the chart frequencies preflop), your equity vs. the opponent's modeled range, pot odds, and a plain-English explanation. Keyboard: ←/→ step, ↑/↓ change hand. |
| **Training** | *Review your mistakes*: a Leitner spaced-repetition deck made from your own errors (miss it and it comes back soon; get it right and it comes back in 1 → 3 → 7 → 16 days). *Drills*: unlimited generated spots for opening ranges, facing opens, BB defense, facing 3-bets, vs limpers, preflop all-ins, pot odds, bluff-catching, value betting, bluffing and draws — graded by the same engine. Mastery tracking per drill. |

## How the engine works

It's a transparent, explainable model built on established poker tooling rather than a black box:

- **Hand evaluation:** [`phe`](https://github.com/thlorenz/phe), a JS port of HenryRLee's
  [PokerHandEvaluator](https://github.com/HenryRLee/PokerHandEvaluator) (~11M 7-card evals/sec).
- **Preflop:** decisions are compared to solver-inspired 100bb charts (RFI by position, vs. open,
  BB defense, vs. 3-bet, cold 4-bet, vs. 4-bet, vs. limpers, short-stack push ranges). Mixed
  strategies are respected. All-in spots use exact equity math vs. the opponent's range.
- **Postflop:** each opponent gets a preflop range from their line, which is then narrowed street
  by street based on their actions and how each combo connects with the board (made-hand strength
  + draw potential). For every option (fold / check / call / bet sizes / raises) the engine estimates
  EV using Monte-Carlo equity vs. those ranges, fold equity from a minimum-defense-aware calling
  model, equity realization by position, implied odds for draws and future-street value for strong hands.
- **Grading:** EV lost relative to the pot → Best / Excellent / Good / Inaccuracy / Mistake / Blunder
  (+ *Missed value* for passive play with strong hands, *Great* for only-moves, *Brilliant* for
  profitable bluffs and hero calls). Accuracy is an EV-weighted score like a chess engine's.

**Limitations (honest ones):** this is a fast heuristic model, not a full game-theory solver. Charts
assume ~100bb 6-max/9-max cash; tournament ICM is ignored; opponent ranges are modeled, not read
from real stats. Treat a single verdict as a strong hint and the aggregated leaks as the real signal.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the printed URL and click **Try with 600 demo hands** (or drop in your own files).

Other scripts:

```bash
npm test          # parser, engine and training tests (vitest)
npm run build     # static production build in dist/
npm run gen:demo  # regenerate public/demo/sample-hands.txt from the simulator
```

## Deploy for free (GitHub Pages)

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds, and publishes.

The build uses relative paths + hash routing, so it also works on Netlify/Vercel/any static host
or straight from the `dist/` folder.

## Project layout

```
src/lib/parser/      hand-history parsers (Stars family + Ignition) → normalized Hand model
src/lib/engine/      evaluator wrapper, ranges & charts, equity, board strength, analyzer,
                     classification, leaks, summary stats
src/lib/training/    drill generators, synthetic-hand builder, spaced repetition
src/workers/         analysis Web Worker (keeps the UI responsive on big imports)
src/pages/           Dashboard, Hands, Hand review, Leaks, Train, Train session, Import
scripts/             demo-hand simulator, preflop equity table generator
```
