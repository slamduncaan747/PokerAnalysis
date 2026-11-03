# App Store Connect listing — Leakfinder

Copy these into App Store Connect → your app → App Store tab. Character counts are checked against
Apple's limits by `appstore/check-metadata.mjs`.

## App information

| Field | Value |
|---|---|
| Name (≤30) | Leakfinder: Poker Puzzles |
| Subtitle (≤30) | Daily hands & GTO training |
| Bundle ID | io.github.slamduncaan747.leakfinder |
| SKU | leakfinder-ios |
| Primary category | Education |
| Secondary category | Sports |
| Privacy Policy URL | https://slamduncaan747.github.io/PokerAnalysis/privacy.html |
| Support URL | https://slamduncaan747.github.io/PokerAnalysis/support.html |
| Marketing URL | https://slamduncaan747.github.io/PokerAnalysis/ |
| Price | Free |
| Copyright | 2026 slamduncaan747 |

## Promotional text (≤170)

A new Daily Hand every day, plus rated poker puzzles checked by a GTO solver. Solve one and your rating climbs — the puzzles get harder as you get better.

## Description (≤4000)

Leakfinder is chess-puzzle training for poker. Every day there's a new Daily Hand, and an endless stream of rated puzzles that adapt to you. Solve a spot and your rating goes up; miss it and it drops. As you improve, the puzzles get harder.

DAILY HAND
• Three hands a day: a warm-up, a thinker and a boss
• The same hands for everyone, one try each
• Keep your streak alive and share your result (no spoilers)

RATED PUZZLES
• Nearly 2,000 hand-picked spots with a difficulty rating
• Postflop puzzles are checked by a real GTO solver for your exact hand, and only kept when one play is clearly best
• After every answer: the solver's strategy, the EV of each option, your equity versus the pot odds, and the key idea in plain English
• Themes to focus on: value bets, bluffs, bluff-catching, big folds, checking, raises, preflop and pot odds
• Rating graph, best streaks, and strengths and weaknesses by theme

TRAIN YOUR OWN GAME
• Play online? Import your hand histories on your computer at Leakfinder (free) and send them to your phone with a short pairing code
• Every decision is graded like a chess game review, and your biggest leaks become drills
• Spaced-repetition review of your own mistakes: miss a spot and it comes back soon; get it right and it comes back in days
• Supports most major poker sites, including PokerStars, GGPoker, CoinPoker, ACR, Winamax and Ignition

MADE FOR YOUR PHONE
• Haptics, sounds and quick one-tap answers
• Show amounts in big blinds or in money at your stake (for example $0.02/$0.05)
• No account needed, no ads, no tracking — everything stays on your device

Leakfinder is a study tool; it offers no real-money gaming. Free and open source (AGPL-3.0).

## Keywords (≤100, comma-separated, no spaces needed)

poker,puzzles,daily,gto,solver,holdem,trainer,leaks,nlhe,study,coach,quiz,ranges,odds,rating

## What's New (version 1.0.0)

First release: the Daily Hand, rated puzzles checked by a GTO solver, and training on your own hands.

## App Review information

- Sign-in required: **No**.
- Notes for the reviewer:
  > Leakfinder is a study tool for poker players, built like chess puzzles. No account or login is needed. On the Today tab, tap Play on the Daily Hand to solve three puzzles; the Puzzles tab has rated puzzles that adapt to the player's rating. To see the training on a player's own hands, open My Game and tap "Try it with 600 demo hands". The app contains no real-money gambling, wagering or purchases and does not link to gambling operators.

## App Privacy ("nutrition label")

For this version (no cloud account):

- **Data Not Collected.** Hands and progress stay on the device. Device-to-device sync connects the
  two devices directly (WebRTC); the PeerJS signalling server only relays connection setup and stores nothing.

If you later switch on cloud accounts (Supabase), update the answers to:

| Data type | Used for | Linked to user | Tracking |
|---|---|---|---|
| Contact Info → Email Address | App Functionality | Yes | No |
| User Content → Other User Content (hand histories, training progress) | App Functionality | Yes | No |
| Identifiers → User ID | App Functionality | Yes | No |

## Age rating

Leakfinder has no wagering, but it is poker-themed. Answering **Simulated Gambling: Frequent/Intense**
is the cautious choice: it avoids a review rejection but gives the app the highest age rating (18+). Declaring
none of the content categories gives a lower rating, with some risk that the reviewer disagrees. Your call.

## Screenshots

`appstore/screenshots/iphone-6.9/` (1320 × 2868, required 6.9" iPhone size) and
`appstore/screenshots/ipad-13/` (2064 × 2752, required because the app also runs on iPad). Upload
1–6 in order: Today (Daily Hand), a puzzle, the solver's answer, Daily Hand result, rating, My Game. Regenerate them after UI
changes with the demo data (see `RELEASE.md`).

## Export compliance

`ITSAppUsesNonExemptEncryption = NO` is already set in Info.plist (only standard HTTPS/WebRTC encryption),
so TestFlight won't ask on each upload.
