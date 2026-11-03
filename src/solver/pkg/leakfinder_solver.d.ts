/* tslint:disable */
/* eslint-disable */

export class SpotSolver {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Available actions at the current node as flat [kind, amount] pairs.
     */
    actions(): Int32Array;
    allocate(compress: boolean): void;
    /**
     * 0 = OOP, 1 = IP, -1 = terminal, -2 = chance.
     */
    current_player(): number;
    equity(player: number): Float32Array;
    /**
     * Expected value per hand (current player: per action per hand, action-major).
     */
    ev_detail(player: number): Float32Array;
    finalize(): void;
    /**
     * Private hands of `player` as flat card pairs.
     */
    hands(player: number): Uint8Array;
    iterations(): number;
    /**
     * Estimated memory in MB (uncompressed, compressed).
     */
    memory_mb(): Float64Array;
    /**
     * Moves from the root along `line` (same encoding as the constructor). For bets and
     * raises the closest available size of the same kind is used. Returns the line actually
     * taken.
     */
    navigate(line: Int32Array | number[]): Int32Array;
    /**
     * Builds the game tree. `board` has 3, 4 or 5 cards; the tree starts at that street.
     * Bet / raise sizes use the solver's syntax, e.g. "33%, 75%" and "2.5x" (empty = none).
     * `line` is the real action line from the hand; every prefix is added to the tree so
     * the exact sizes that happened can be analysed.
     */
    constructor(oop_cards: Uint8Array | number[], oop_weights: Float32Array | number[], ip_cards: Uint8Array | number[], ip_weights: Float32Array | number[], board: Uint8Array | number[], starting_pot: number, effective_stack: number, flop_bets: string, flop_raises: string, turn_bets: string, turn_raises: string, river_bets: string, river_raises: string, line: Int32Array | number[]);
    /**
     * [pot at street start, OOP street commitment, IP street commitment]
     */
    pot_info(): Int32Array;
    /**
     * Runs `n` more iterations of Discounted CFR and returns the exploitability in chips.
     */
    step(n: number): number;
    /**
     * Strategy of the acting player: `actions * hands`, action-major.
     */
    strategy(): Float32Array;
    /**
     * Normalized reach weights of `player`'s hands at the current node.
     */
    weights(player: number): Float32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_spotsolver_free: (a: number, b: number) => void;
    readonly spotsolver_actions: (a: number) => [number, number];
    readonly spotsolver_allocate: (a: number, b: number) => void;
    readonly spotsolver_current_player: (a: number) => number;
    readonly spotsolver_equity: (a: number, b: number) => [number, number];
    readonly spotsolver_ev_detail: (a: number, b: number) => [number, number];
    readonly spotsolver_finalize: (a: number) => void;
    readonly spotsolver_hands: (a: number, b: number) => [number, number];
    readonly spotsolver_iterations: (a: number) => number;
    readonly spotsolver_memory_mb: (a: number) => [number, number];
    readonly spotsolver_navigate: (a: number, b: number, c: number) => [number, number, number, number];
    readonly spotsolver_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number, u: number, v: number, w: number, x: number, y: number, z: number) => [number, number, number];
    readonly spotsolver_pot_info: (a: number) => [number, number];
    readonly spotsolver_step: (a: number, b: number) => number;
    readonly spotsolver_strategy: (a: number) => [number, number];
    readonly spotsolver_weights: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
