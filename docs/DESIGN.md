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

## Direction: The Card Room (chosen by the owner)

A private card room, executed with restraint: the references above supply the mechanics
(Robinhood's big number, Chess.com's table-first puzzle, Duolingo's satisfying answer,
NYT's daily ritual); the room supplies the look.

- **Room:** near-black with a green undertone `#0a0f0d`; surfaces `#111815`; hairlines `rgba(255,255,255,.07)`.
- **Text:** warm ivory `#f2ece0`, secondary `#a29d90`, tertiary `#6d6b62`.
- **Gold `#d4b26a`:** fine detail only — hairlines, small caps labels, the streak, rating changes, the seal. Never a gradient on text, never a big fill.
- **The table:** baize with a soft overhead light and a faint fabric texture; a leather rail with a 1px brass inlay.
- **Cards:** ivory `#fbf8f1`, classic two-colour deck (`#141414` / `#b3261e`), serif ranks with lining figures. Backs are oxblood with a fine engraved pattern and an ivory border.
- **Chips:** clay chips in muted real denomination colours (white, red, green, black, purple, gold, plus blue and orange), cream edge spots, serif denomination.
- **Type:** Cormorant Garamond (600–700, lining figures) for numbers, titles and card ranks; Inter for everything you read. At most one small-caps label per surface.
- **Buttons:** ivory fill for the one thing to do; everything else is dark with a hairline. Poker actions are all the same until you answer.
- **Answers:** a sheet in deep green (right) or oxblood (wrong), a gold seal, a serif verdict, one sentence, Continue.
- **Motion:** unhurried — cards deal in sequence, results turn over, sheets glide up.

## Rules learned from the first review

- At most one small label per screen; no tracked-uppercase micro-labels, no "·" chains.
- The verdict is one sentence of 12 words or fewer; details live under "Why?".
- Never reveal a puzzle's theme before the answer.
- One big number instead of rows of identical stat boxes.
- No chart until there is enough data to make it meaningful (10 rated games).
- Lists for many items (themes, drills); tiles only for a few important things.
- The table keeps a fixed height so nothing jumps between puzzles.

## Review checklist (run on every screen)

1. Can you tell in one second what the screen is for and what to tap?
2. Is there exactly one primary action, and is it the most prominent thing?
3. Does it look like poker (chips, cards, felt) rather than a settings app?
4. Is any colour used without a meaning?
5. Do three or more identical boxes sit in a row? Break the rhythm.
6. Is every number that matters big, and everything else quiet?
7. Does pressing anything feel physical (lip, sink, haptic)?
