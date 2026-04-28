import type { YTEmbed } from '../YTEmbed.js';

// biome-ignore lint/suspicious/noExplicitAny: dynamic method-wrapping shim.
type AnyFn = (...args: any[]) => any;

interface WrapState {
  /** The original method discovered on first wrap (typically the prototype wrapper). */
  readonly original: AnyFn;
  /** Wrappers in attach order. The instance method always points at `stack[stack.length - 1]`. */
  readonly stack: AnyFn[];
}

const WRAP_STATE = new WeakMap<YTEmbed, Map<string, WrapState>>();

function getMap(player: YTEmbed): Map<string, WrapState> {
  let map = WRAP_STATE.get(player);
  if (!map) {
    map = new Map();
    WRAP_STATE.set(player, map);
  }
  return map;
}

/**
 * Wrap an instance method on the YTEmbed-shaped object so that multiple
 * extensions can compose without clobbering each other. Each call appends a
 * wrapper to a per-method stack; the corresponding detach removes its wrapper
 * and restores the next-most-recent (or, when empty, the original).
 *
 * The `wrap` callback receives the previous effective implementation (which
 * may be another extension's wrapper) and returns the new one. Bind-this
 * concerns are handled by the caller — the wrapper is invoked with whatever
 * `this` the dispatcher passes (typically the player itself).
 */
export function wrapInstanceMethod<F extends AnyFn>(
  player: YTEmbed,
  method: string,
  wrap: (previous: F) => F,
): () => void {
  const map = getMap(player);
  // biome-ignore lint/suspicious/noExplicitAny: dynamic property access on the player instance.
  const target = player as unknown as Record<string, any>;

  let state = map.get(method);
  if (!state) {
    // First wrap for this method on this player: capture whatever is currently
    // effective (instance shadow if present, else the prototype wrapper) and
    // bind to the player so wrappers can call it without worrying about `this`.
    const raw = target[method] as AnyFn;
    const original = raw.bind(player);
    state = { original, stack: [] };
    map.set(method, state);
  }
  // The "previous" the wrapper sees is the current effective method — either
  // the most recent prior wrapper (already bound) or the original.
  const previous = (state.stack[state.stack.length - 1] ?? state.original) as F;
  const wrapped = wrap(previous);
  state.stack.push(wrapped);
  target[method] = wrapped;

  return () => {
    const current = map.get(method);
    if (!current) return;
    const idx = current.stack.indexOf(wrapped);
    if (idx === -1) return;
    current.stack.splice(idx, 1);
    if (current.stack.length === 0) {
      // No more shadow wrappers — fall back to the prototype's generated wrapper.
      delete target[method];
      map.delete(method);
    } else {
      target[method] = current.stack[current.stack.length - 1] as AnyFn;
    }
  };
}
