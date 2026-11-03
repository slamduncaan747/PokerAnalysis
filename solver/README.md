# Leakfinder solver (WebAssembly)

Thin [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) bindings around
[b-inary/postflop-solver](https://github.com/b-inary/postflop-solver) (pinned at
`9d1509fe5077d019825f833eed04b16d342dfda1`), an open-source Discounted-CFR postflop solver for
No-Limit Hold'em by Wataru Inariba, licensed **AGPL-3.0-or-later**. This crate and the
Leakfinder app are distributed under the same license (see `../LICENSE`).

Build notes:

- Single-threaded (no rayon) so it runs on any static host — threads would need COOP/COEP headers.
- Compiled with WebAssembly SIMD (`.cargo/config.toml`).
- The generated package lives in `src/solver/pkg/` and is committed, so the site builds without Rust.

Rebuild:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
npm run build:solver
```

The JS API (`SpotSolver`) builds a tree from both players' ranges (exact combos + weights), the
board, pot, effective stack and bet sizes, adds the real action line from the hand, runs CFR in
steps (`step(n)` returns exploitability) and exposes strategy / EV / equity for any node via
`navigate(line)`. See `src/lib/solver/run.ts` for how the app drives it.
