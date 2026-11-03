// Hand-written fixtures mirroring each supported site's export format.

export const STARS_CASH = `PokerStars Hand #244123456789:  Hold'em No Limit ($0.25/$0.50 USD) - 2023/03/15 21:30:45 ET
Table 'Aase III' 6-max Seat #3 is the button
Seat 1: player1 ($50 in chips)
Seat 2: Hero ($48.75 in chips)
Seat 3: player3 ($102.30 in chips)
Seat 4: player4 ($50 in chips) is sitting out
Seat 5: player5 ($23.10 in chips)
Seat 6: player6 ($60 in chips)
player5: posts small blind $0.25
player6: posts big blind $0.50
*** HOLE CARDS ***
Dealt to Hero [Ah Kd]
player1: folds
Hero: raises $1 to $1.50
player3: calls $1.50
player5: folds
player6: raises $5.25 to $6.75
Hero: calls $5.25
player3: folds
*** FLOP *** [Kc 7d 2s]
player6: bets $8.40
Hero: raises $16.80 to $25.20
player6: calls $16.80
*** TURN *** [Kc 7d 2s] [9h]
player6: checks
Hero: bets $16.80 and is all-in
player6: calls $16.80
*** RIVER *** [Kc 7d 2s 9h] [3c]
*** SHOW DOWN ***
player6: shows [Qs Qd] (a pair of Queens)
Hero: shows [Ah Kd] (a pair of Kings)
Hero collected $96.35 from pot
*** SUMMARY ***
Total pot $99.25 | Rake $2.90
Board [Kc 7d 2s 9h 3c]
Seat 1: player1 folded before Flop (didn't bet)
Seat 2: Hero showed [Ah Kd] and won ($96.35) with a pair of Kings
Seat 3: player3 (button) folded before Flop
Seat 5: player5 (small blind) folded before Flop
Seat 6: player6 (big blind) showed [Qs Qd] and lost with a pair of Queens



PokerStars Hand #244123456790:  Hold'em No Limit ($0.25/$0.50 USD) - 2023/03/15 21:31:45 ET
Table 'Aase III' 6-max Seat #5 is the button
Seat 1: player1 ($50 in chips)
Seat 2: Hero ($97.10 in chips)
Seat 3: player3 ($100.80 in chips)
Seat 5: player5 ($23.10 in chips)
Seat 6: player6 ($10 in chips)
player6: posts small blind $0.25
player1: posts big blind $0.50
*** HOLE CARDS ***
Dealt to Hero [7c 2d]
Hero: folds
player3: raises $1 to $1.50
player5: folds
player6: folds
player1: folds
Uncalled bet ($1) returned to player3
player3 collected $1.25 from pot
player3: doesn't show hand
*** SUMMARY ***
Total pot $1.25 | Rake $0
Seat 1: player1 (big blind) folded before Flop
Seat 2: Hero folded before Flop (didn't bet)
Seat 3: player3 collected ($1.25)
Seat 5: player5 (button) folded before Flop (didn't bet)
Seat 6: player6 (small blind) folded before Flop
`;

export const STARS_TOURNEY = `PokerStars Hand #230000000001: Tournament #3400000001, $1.40+$0.10 USD Hold'em No Limit - Level III (25/50) - 2022/11/01 20:00:00 ET
Table '3400000001 1' 9-max Seat #2 is the button
Seat 1: alpha (1450 in chips)
Seat 2: bravo (2000 in chips)
Seat 3: charlie (1800 in chips)
Seat 4: Hero (1500 in chips)
alpha: posts the ante 5
bravo: posts the ante 5
charlie: posts the ante 5
Hero: posts the ante 5
charlie: posts small blind 25
Hero: posts big blind 50
*** HOLE CARDS ***
Dealt to Hero [Td Tc]
alpha: raises 75 to 125
bravo: folds
charlie: folds
Hero: raises 1370 to 1495 and is all-in
alpha: calls 1320 and is all-in
Uncalled bet (50) returned to Hero
*** FLOP *** [2c 5h 9s]
*** TURN *** [2c 5h 9s] [Kd]
*** RIVER *** [2c 5h 9s Kd] [3h]
*** SHOW DOWN ***
Hero: shows [Td Tc] (a pair of Tens)
alpha: shows [Ac Qd] (high card Ace)
Hero collected 2935 from pot
*** SUMMARY ***
Total pot 2935 | Rake 0
Board [2c 5h 9s Kd 3h]
`;

export const GG_CASH = `Poker Hand #HD1234567890: Hold'em No Limit ($0.05/$0.1) - 2024/01/10 18:05:12
Table 'NLHGold12' 6-max Seat #1 is the button
Seat 1: a1b2c3 ($10.4 in chips)
Seat 2: f9e8d7 ($9.7 in chips)
Seat 3: Hero ($10 in chips)
Seat 4: 77aa11 ($12.15 in chips)
f9e8d7: posts small blind $0.05
Hero: posts big blind $0.1
*** HOLE CARDS ***
Dealt to a1b2c3
Dealt to f9e8d7
Dealt to Hero [Js Ts]
Dealt to 77aa11
77aa11: raises $0.15 to $0.25
a1b2c3: folds
f9e8d7: folds
Hero: calls $0.15
*** FLOP *** [Qs 9s 2h]
Hero: checks
77aa11: bets $0.18
Hero: raises $0.6 to $0.78
77aa11: folds
Uncalled bet ($0.6) returned to Hero
*** SHOWDOWN ***
Hero collected $0.87 from pot
*** SUMMARY ***
Total pot $0.91 | Rake $0.04 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
Board [Qs 9s 2h]
`;

export const ACR_CASH = `Game Hand #2155000111 - Holdem(No Limit) - $0.05/$0.10 - 2024/02/03 01:02:03 UTC
Table 'Bryce' 6-max Seat #4 is the button
Seat 1: Hero ($10.00)
Seat 2: villainA ($8.50)
Seat 4: villainB ($12.00)
Hero posts the small blind $0.05
villainA posts the big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ac Ad]
villainB raises $0.25 to $0.25
Hero raises $0.90 to $0.90
villainA folds
villainB calls $0.65
*** FLOP *** [8h 4c 2d]
Hero bets $0.60
villainB folds
Uncalled bet ($0.60) returned to Hero
Hero collected $1.82 from main pot
*** SUMMARY ***
Total pot $1.90 | Rake $0.08
Board [8h 4c 2d]
`;

export const WINAMAX_CASH = `Winamax Poker - CashGame - HandId: #19876543-123-1700000000 - Holdem no limit (0.01€/0.02€) - 2023/11/14 21:13:20 UTC
Table: 'Wichita 05' 6-max (real money) Seat #2 is the button
Seat 1: Hero (2€)
Seat 2: Bobby (2.10€)
Seat 3: Carl (1.85€)
*** ANTE/BLINDS ***
Carl posts small blind 0.01€
Hero posts big blind 0.02€
Dealt to Hero [9h 9c]
*** PRE-FLOP ***
Bobby raises 0.04€ to 0.06€
Carl folds
Hero calls 0.04€
*** FLOP *** [9d 5s 2c]
Hero checks
Bobby bets 0.06€
Hero calls 0.06€
*** TURN *** [9d 5s 2c][Kh]
Hero checks
Bobby checks
*** RIVER *** [9d 5s 2c Kh][3d]
Hero bets 0.20€
Bobby folds
Hero collected 0.25€ from pot
*** SUMMARY ***
Total pot 0.25€ | Rake 0€
Board: [9d 5s 2c Kh 3d]
`;

export const IGNITION_CASH = `Ignition Hand #4290322948 TBL#26728545 HOLDEM No Limit - 2022-05-26 14:16:24
Seat 1: Big Blind [ME] ($25 in chips)
Seat 2: UTG ($24.40 in chips)
Seat 3: UTG+1 ($30 in chips)
Seat 4: UTG+2 ($33.77 in chips)
Seat 5: Dealer ($26.87 in chips)
Seat 6: Small Blind ($23.30 in chips)
Dealer : Set dealer [5]
Small Blind : Small Blind $0.10
Big Blind [ME] : Big blind $0.25
*** HOLE CARDS ***
Big Blind [ME] : Card dealt to a spot [Th Qh]
UTG : Card dealt to a spot [9s Ks]
UTG+1 : Card dealt to a spot [6h Ad]
UTG+2 : Card dealt to a spot [Jd 2s]
Dealer : Card dealt to a spot [Tc 8d]
Small Blind : Card dealt to a spot [3d 8c]
UTG : Call $0.25
UTG+1 : Call $0.25
UTG+2 : Folds
Dealer : Folds
Small Blind : Folds
Big Blind [ME] : Checks
*** FLOP *** [Qs Ts 4s]
Big Blind [ME] : Bets $0.50
UTG : Call $0.50
UTG+1 : Folds
*** TURN *** [Qs Ts 4s] [Ac]
Big Blind [ME] : Checks
UTG : Bets $1
Big Blind [ME] : Call $1
*** RIVER *** [Qs Ts 4s Ac] [5d]
Big Blind [ME] : Checks
UTG : Checks
UTG : Showdown [Ks Qd As Ac Ks] (One pair)
Big Blind [ME] : Showdown [Qh Qs Th Ts As] (Two pair)
Big Blind [ME] : Hand result $3.71
*** SUMMARY ***
Total Pot($3.85)
Board [Qs Ts 4s Ac 5d]
`;
