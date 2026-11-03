#!/usr/bin/env bash
# Rebuilds the WebAssembly GTO solver (b-inary/postflop-solver, AGPL-3.0-or-later).
# Requirements: Rust with the wasm32-unknown-unknown target and wasm-bindgen-cli 0.2.130:
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-bindgen-cli --version 0.2.130 --locked
# The generated files in src/solver/pkg are committed so the site builds without Rust.
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_NET_GIT_FETCH_WITH_CLI=true
(cd solver && cargo build --release --target wasm32-unknown-unknown)
wasm-bindgen solver/target/wasm32-unknown-unknown/release/leakfinder_solver.wasm \
  --target web --out-dir src/solver/pkg
if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -O3 src/solver/pkg/leakfinder_solver_bg.wasm -o src/solver/pkg/leakfinder_solver_bg.wasm
fi
ls -la src/solver/pkg
