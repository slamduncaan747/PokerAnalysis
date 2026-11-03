//! WebAssembly bindings for b-inary's postflop-solver (AGPL-3.0-or-later).
//!
//! Cards use the solver's encoding: `4 * rank + suit` with rank 2 = 0 … A = 12 and
//! suit club = 0, diamond = 1, heart = 2, spade = 3.
//!
//! Action lines are passed as flat `[kind, amount, kind, amount, ...]` arrays where
//! kind is 0 = fold, 1 = check, 2 = call, 3 = bet, 4 = raise, 5 = all-in and amounts are the
//! player's total commitment on the current street ("bet/raise to").

use postflop_solver::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SpotSolver {
    game: PostFlopGame,
    iteration: u32,
    finalized: bool,
}

fn decode_action(kind: i32, amount: i32) -> Result<Action, String> {
    Ok(match kind {
        0 => Action::Fold,
        1 => Action::Check,
        2 => Action::Call,
        3 => Action::Bet(amount),
        4 => Action::Raise(amount),
        5 => Action::AllIn(amount),
        _ => return Err(format!("unknown action kind {kind}")),
    })
}

fn encode_action(a: &Action) -> (i32, i32) {
    match *a {
        Action::Fold => (0, 0),
        Action::Check => (1, 0),
        Action::Call => (2, 0),
        Action::Bet(x) => (3, x),
        Action::Raise(x) => (4, x),
        Action::AllIn(x) => (5, x),
        Action::Chance(c) => (6, c as i32),
        Action::None => (-1, 0),
    }
}

fn decode_line(line: &[i32]) -> Result<Vec<Action>, String> {
    if line.len() % 2 != 0 {
        return Err("line must be [kind, amount] pairs".into());
    }
    line.chunks(2).map(|p| decode_action(p[0], p[1])).collect()
}

fn range_from(cards: &[u8], weights: &[f32]) -> Result<Range, String> {
    if cards.len() != weights.len() * 2 {
        return Err("cards/weights length mismatch".into());
    }
    let hands: Vec<(Card, Card)> = cards.chunks(2).map(|c| (c[0], c[1])).collect();
    Range::from_hands_weights(&hands, weights)
}

fn err(s: String) -> JsValue {
    JsValue::from_str(&s)
}

#[wasm_bindgen]
impl SpotSolver {
    /// Builds the game tree. `board` has 3, 4 or 5 cards; the tree starts at that street.
    /// Bet / raise sizes use the solver's syntax, e.g. "33%, 75%" and "2.5x" (empty = none).
    /// `line` is the real action line from the hand; every prefix is added to the tree so
    /// the exact sizes that happened can be analysed.
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        oop_cards: &[u8],
        oop_weights: &[f32],
        ip_cards: &[u8],
        ip_weights: &[f32],
        board: &[u8],
        starting_pot: i32,
        effective_stack: i32,
        flop_bets: &str,
        flop_raises: &str,
        turn_bets: &str,
        turn_raises: &str,
        river_bets: &str,
        river_raises: &str,
        line: &[i32],
    ) -> Result<SpotSolver, JsValue> {
        if board.len() < 3 || board.len() > 5 {
            return Err(err("board must have 3-5 cards".into()));
        }
        let card_config = CardConfig {
            range: [range_from(oop_cards, oop_weights).map_err(err)?, range_from(ip_cards, ip_weights).map_err(err)?],
            flop: [board[0], board[1], board[2]],
            turn: if board.len() >= 4 { board[3] } else { NOT_DEALT },
            river: if board.len() == 5 { board[4] } else { NOT_DEALT },
        };
        let initial_state = match board.len() {
            3 => BoardState::Flop,
            4 => BoardState::Turn,
            _ => BoardState::River,
        };
        let mk = |b: &str, r: &str| BetSizeOptions::try_from((b, r)).map_err(err);
        let flop = mk(flop_bets, flop_raises)?;
        let turn = mk(turn_bets, turn_raises)?;
        let river = mk(river_bets, river_raises)?;
        let tree_config = TreeConfig {
            initial_state,
            starting_pot,
            effective_stack,
            rake_rate: 0.0,
            rake_cap: 0.0,
            flop_bet_sizes: [flop.clone(), flop],
            turn_bet_sizes: [turn.clone(), turn],
            river_bet_sizes: [river.clone(), river],
            turn_donk_sizes: None,
            river_donk_sizes: None,
            add_allin_threshold: 1.5,
            force_allin_threshold: 0.15,
            merging_threshold: 0.1,
        };
        let mut tree = ActionTree::new(tree_config).map_err(err)?;
        let actions = decode_line(line).map_err(err)?;
        for i in 1..=actions.len() {
            match tree.add_line(&actions[..i]) {
                Ok(()) => {}
                Err(e) if e.starts_with("Action already exists") => {}
                Err(e) => return Err(err(format!("cannot add line action #{i}: {e}"))),
            }
        }
        let game = PostFlopGame::with_config(card_config, tree).map_err(err)?;
        Ok(SpotSolver { game, iteration: 0, finalized: false })
    }

    /// Estimated memory in MB (uncompressed, compressed).
    pub fn memory_mb(&self) -> Vec<f64> {
        let (a, b) = self.game.memory_usage();
        vec![a as f64 / 1048576.0, b as f64 / 1048576.0]
    }

    pub fn allocate(&mut self, compress: bool) {
        self.game.allocate_memory(compress);
    }

    /// Runs `n` more iterations of Discounted CFR and returns the exploitability in chips.
    pub fn step(&mut self, n: u32) -> f32 {
        for _ in 0..n {
            solve_step(&self.game, self.iteration);
            self.iteration += 1;
        }
        compute_exploitability(&self.game)
    }

    pub fn iterations(&self) -> u32 {
        self.iteration
    }

    pub fn finalize(&mut self) {
        if !self.finalized {
            finalize(&mut self.game);
            self.finalized = true;
        }
    }

    /// Moves from the root along `line` (same encoding as the constructor). For bets and
    /// raises the closest available size of the same kind is used. Returns the line actually
    /// taken.
    pub fn navigate(&mut self, line: &[i32]) -> Result<Vec<i32>, JsValue> {
        self.game.back_to_root();
        let mut taken = Vec::new();
        for a in decode_line(line).map_err(err)? {
            if self.game.is_terminal_node() {
                return Err(err("reached a terminal node".into()));
            }
            if self.game.is_chance_node() {
                return Err(err("chance node inside the line".into()));
            }
            let avail = self.game.available_actions();
            let target = encode_action(&a);
            let mut best: Option<(usize, i64)> = None;
            for (i, b) in avail.iter().enumerate() {
                let (k, x) = encode_action(b);
                let same_kind = k == target.0 || (target.0 >= 3 && k >= 3 && (target.0 == 5 || k == 5 || k == target.0));
                if !same_kind {
                    continue;
                }
                let d = (x as i64 - target.1 as i64).abs() + if k == target.0 { 0 } else { 1 };
                if best.map_or(true, |(_, bd)| d < bd) {
                    best = Some((i, d));
                }
            }
            let (idx, _) = best.ok_or_else(|| err(format!("action {a:?} not available")))?;
            let (k, x) = encode_action(&avail[idx]);
            taken.push(k);
            taken.push(x);
            self.game.play(idx);
        }
        self.game.cache_normalized_weights();
        Ok(taken)
    }

    /// 0 = OOP, 1 = IP, -1 = terminal, -2 = chance.
    pub fn current_player(&self) -> i32 {
        if self.game.is_terminal_node() {
            -1
        } else if self.game.is_chance_node() {
            -2
        } else {
            self.game.current_player() as i32
        }
    }

    /// Available actions at the current node as flat [kind, amount] pairs.
    pub fn actions(&self) -> Vec<i32> {
        let mut out = Vec::new();
        for a in self.game.available_actions() {
            let (k, x) = encode_action(&a);
            out.push(k);
            out.push(x);
        }
        out
    }

    /// Private hands of `player` as flat card pairs.
    pub fn hands(&self, player: usize) -> Vec<u8> {
        self.game.private_cards(player).iter().flat_map(|&(a, b)| [a, b]).collect()
    }

    /// Normalized reach weights of `player`'s hands at the current node.
    pub fn weights(&self, player: usize) -> Vec<f32> {
        self.game.normalized_weights(player).to_vec()
    }

    /// Strategy of the acting player: `actions * hands`, action-major.
    pub fn strategy(&self) -> Vec<f32> {
        self.game.strategy()
    }

    /// Expected value per hand (current player: per action per hand, action-major).
    pub fn ev_detail(&self, player: usize) -> Vec<f32> {
        self.game.expected_values_detail(player)
    }

    pub fn equity(&self, player: usize) -> Vec<f32> {
        self.game.equity(player)
    }

    /// [pot at street start, OOP street commitment, IP street commitment]
    pub fn pot_info(&self) -> Vec<i32> {
        let b = self.game.total_bet_amount();
        vec![self.game.tree_config().starting_pot, b[0], b[1]]
    }
}
