import type { YTEmbed } from '../YTEmbed.js';

interface PollAndDispatchOptions<T> {
  /** Player to attach against. */
  player: YTEmbed;
  /** Event name to dispatch on change. */
  eventName: string;
  /** Polling cadence (ms). Snapped to the player's `pollingIntervalMs` floor. */
  intervalMs: number;
  /** Reads the current value. Use `player.tickRead` for shared coalescing. */
  read: () => Promise<T>;
  /** Build the CustomEvent detail payload from the read value. */
  toDetail: (value: T) => unknown;
  /** Compare values for equality. Default: `Object.is` (NaN===NaN). */
  isSame?: (a: T, b: T) => boolean;
}

/**
 * Internal helper for the polling-extension pattern: subscribe to the shared
 * tick, dedupe consecutive identical reads, dispatch a CustomEvent on change.
 * Returns a detach function. Callers handle their own attach gating (lazy via
 * the Extension `events` array, or eager).
 */
export function pollAndDispatch<T>({
  player,
  eventName,
  intervalMs,
  read,
  toDetail,
  isSame = Object.is,
}: PollAndDispatchOptions<T>): () => void {
  let last: T | undefined;
  let primed = false;
  let detached = false;

  const tick = async () => {
    if (detached) return;
    try {
      const value = await read();
      if (detached) return;
      if (primed && last !== undefined && isSame(value, last)) return;
      last = value;
      primed = true;
      player.dispatchEvent(new CustomEvent(eventName, { detail: toDetail(value) }));
    } catch {
      // Wrapper rejection (e.g. PlayerDestroyedError) — drop quietly.
    }
  };

  const unsubscribe = player.tick(() => void tick(), intervalMs);
  return () => {
    detached = true;
    unsubscribe();
  };
}
