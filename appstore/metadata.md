# App Store Connect listing — Leakfinder

Copy these into App Store Connect → your app → App Store tab. Character counts are checked against
Apple's limits by `appstore/check-metadata.mjs`.

## App information

| Field | Value |
|---|---|
| Name (≤30) | Leakfinder: Poker Hand Review |
| Subtitle (≤30) | GTO solver & poker trainer |
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

Import your hand histories and get a move-by-move review: every decision graded from Best to Blunder, your biggest leaks ranked, and drills built from your own mistakes.

## Description (≤4000)

Leakfinder reviews your poker hands the way a chess engine reviews a game.

Import the hand history files from your poker client and every decision you made is graded: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Missed value or Blunder, with the expected value of each option and a plain-English explanation of why.

GAME REVIEW
• Accuracy score for every session and every hand
• Win rate, all-in EV, and big blinds lost to mistakes
• Results graph with showdown and non-showdown winnings
• Your stats (VPIP, PFR, 3-bet, c-bet, WTSD and more) compared with winning ranges

LEAK FINDER
• Mistakes grouped into leaks such as calling down too light, missing value with strong hands and under-defending the big blind
• Ranked by how many big blinds each one costs you, with the exact hands as examples and how to fix them

HAND REPLAYER
• Step through any hand on a full table
• Equity bar, your options with their EV, and the coach's verdict for each decision

GTO SOLVER ON YOUR PHONE
• Solve any heads-up flop, turn or river spot to equilibrium, right on the device
• See the solver's strategy for your exact hand, a 13×13 range grid, and click through the game tree
• River spots solve in about a second, turns in seconds

TRAINING THAT STICKS
• Spaced-repetition review of your own mistakes: miss a spot and it comes back soon, get it right and it comes back in days
• Unlimited drills: opening ranges, facing opens, big blind defense, 3-bets, all-ins, pot odds, bluff-catching, value betting, bluffing and draws
• Mastery tracking for every skill

YOUR DEVICES, YOUR DATA
• Hands are analyzed on your device; no account needed
• Sync your computer and iPhone with a short pairing code, directly between the devices
• Or move everything with a backup file over AirDrop
• No ads, no tracking

Supports No-Limit Hold'em hand histories exported as text files (or a .zip of them) from most major poker clients. Leakfinder is a study tool; it does not offer real-money gaming.

Free and open source (AGPL-3.0).

## Keywords (≤100, comma-separated, no spaces needed)

poker,gto,solver,hand history,holdem,trainer,leaks,nlhe,ranges,equity,study,coach,replayer,odds

## What's New (version 1.0.0)

First release: game review, leak finder, hand replayer, on-device GTO solver, training with spaced repetition, and device sync.

## App Review information

- Sign-in required: **No**.
- Notes for the reviewer:
  > Leakfinder is a study tool for poker players. It analyzes hand history text files the user exports from their poker client. No account or login is needed. To see the app with data, tap "Try with 600 demo hands" on the first screen. Then open any hand under Hands to see the move-by-move review, and tap "Solve this spot" on a flop/turn/river decision to run the on-device GTO solver. The app contains no real-money gambling, wagering or purchases and does not link to gambling operators.

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
1–6 in order: game review, hand review, GTO solver, leaks, training, sync. Regenerate them after UI
changes with the demo data (see `RELEASE.md`).

## Export compliance

`ITSAppUsesNonExemptEncryption = NO` is already set in Info.plist (only standard HTTPS/WebRTC encryption),
so TestFlight won't ask on each upload.
