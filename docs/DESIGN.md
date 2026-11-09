# Leakfinder phone app — design brief

## The meta-skill: what great consumer apps have in common

Studied: Duolingo, Chess.com and Lichess puzzles, NYT Games (Wordle), Robinhood / Cash App,
Strava / Apple Fitness. None of their visuals are copied; these are the principles underneath.

| # | Principle | Where it comes from | What it means for Leakfinder |
|---|---|---|---|
| 1 | **One ownable visual signature, used everywhere** | Duolingo's chunky owl-green buttons; Cash App's single green; Robinhood's charts | Everything is built from poker's own objects: **casino chips, cards and felt**. Icons are chips, ranks are chips, bets are chip stacks. |
| 2 | **The game is the hero** | Chess.com puzzles give the board the full width, chrome shrinks to almost nothing | The puzzle screen is an **edge-to-edge felt table**; the controls sit below it. No "card on a grey page". |
| 3 | **Tactile, physical controls** | Duolingo's buttons have a lip and press down; tiles feel like objects | Every button and tappable tile has a **3D lip** and sinks when pressed, with a haptic. |
| 4 | **Juicy, instant feedback** | Duolingo's bottom banner turns green or red and carries the Continue button | Answers land in a **full-width banner** in the result colour, with the rating change as a chip and the key idea in one sentence. |
| 5 | **Identity through progress** | Chess.com titles, Duolingo leagues, Strava streaks | Your rating maps to a **rank chip in real casino denominations** — Fish ($1) → Rec ($5) → Grinder ($25) → Reg ($100) → Shark ($500) → Crusher ($1K) — with progress to the next one. Daily streak is always visible. |
| 6 | **A daily ritual with a shareable result** | Wordle, NYT Games hub tiles | The **Daily Hand** is the hero tile of Today: three face-down cards that flip to ✓/✗, a countdown, a spoiler-free share. |
| 7 | **Big, confident numbers** | Robinhood's balance, Fitness rings | Rating, score and streak are set huge in a heavy rounded face; secondary text is small and quiet. Scale contrast does the hierarchy. |
| 8 | **Committed palette with meaning** | Chess.com's dark board room, Spotify's dark + one accent | **Dark ink-navy** room, **felt green** table, **chip colours** for categories. Green = go/correct, red = wrong, gold = rating and rewards. Nothing else gets a colour. |
| 9 | **Varied rhythm, no card soup** | App Store Today, NYT Games | Mix a full-bleed hero, a horizontal shelf of big tiles, and a few compact lists. Not ten identical white boxes. |
| 10 | **Personality in the words** | Duolingo, Wordle | Short, warm, poker-native copy: "Nailed it.", "Good fold.", "3 to Reg". Never jargon walls. |

## Direction: Night Game

The card-room idea, executed like a modern App Store game. One rule per element, used everywhere.

- **Canvas.** Near-black (`--bg #0a0b0d`). Panels are filled (`--s1`, `--s2`, `--s3`), radius 24, never outlined.
- **The table is the hero.** One saturated felt green inside a dark rail (`.m-rail > .m-felt`). It appears only where you play: the puzzle screen, the Daily Hand, the result card, the My Game empty state.
- **Colour means something.** White is the primary button. Amber (`--gold`) is rating and streak. Green (`--go`) is right, red (`--bad`) is wrong. Theme icons are tinted rounded squares (`IconBadge`).
- **Type.** Bricolage Grotesque 700–800 for display and every number; Inter for body. Scale: `.f-hero .f-display .f-title .f-head .f-body .f-ui .f-small .f-caps`.
- **Cards and chips.** Ivory stock with a fine gold line, one heavy oversized rank top-left and one big suit bottom-right; red crosshatch backs with an ivory border. Flat, vivid chips mark rank.
- **Feedback.** Answering slides up a sheet coloured by the result, with a one-line reason, "Why?" for the detail and one Continue button.
- **Chrome.** Four-tab translucent bar with line icons; large left-aligned screen titles.

Tokens live on `.m-app` in `src/index.css`; primitives in `src/mobile/ui.tsx`. New screens compose those and add no colours of their own.
