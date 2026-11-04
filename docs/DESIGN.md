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

## Tokens

- **Room:** `#0b0e17` background, `#141927` surface, `#1c2235` raised, hairline `rgba(255,255,255,.07)`.
- **Text:** `#f4f6fc`, secondary `#99a2bd`, tertiary `#5d6580`.
- **Felt:** radial `#23935b → #0f5434`, rail `#0a2a1c`.
- **Signal colours (each with a darker lip):** go `#2bd67b/#1a9c57`, gold `#ffc233/#d49a00`, wrong `#ff5a5f/#c93c41`, call blue `#3d7bff/#2a58c4`, raise amber `#ffb020/#cc8500`.
- **Chips (casino denominations):** white `#e8ecf5`, red `#e5484d`, green `#22a565`, black `#2a2f3a`, purple `#8b5cf6`, gold `#f5b301`.
- **Type:** Rubik (bundled) — 800/900 for numbers and titles, 500–600 for UI, 400 for body. Sizes 44/32/24/20/17/15/13.
- **Shape:** radius 12 (small), 18 (tiles), 24 (hero); lip 4px on buttons, 3px on tiles.
- **Motion:** springy (cubic-bezier(.2,1.2,.4,1)) for things that appear; 120 ms press; cards deal in sequence; feedback banner slides up.

## Review checklist (run on every screen)

1. Can you tell in one second what the screen is for and what to tap?
2. Is there exactly one primary action, and is it the most prominent thing?
3. Does it look like poker (chips, cards, felt) rather than a settings app?
4. Is any colour used without a meaning?
5. Do three or more identical boxes sit in a row? Break the rhythm.
6. Is every number that matters big, and everything else quiet?
7. Does pressing anything feel physical (lip, sink, haptic)?
