import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface CuePoint<T = unknown> {
  /** Time in seconds at which the cue fires. */
  readonly time: number;
  /** Caller payload, passed through verbatim on the event detail. */
  readonly payload: T;
}

export interface CuePointExtensionOptions<T = unknown> {
  readonly cues: readonly CuePoint<T>[];
  /** Polling interval in ms. Default: 250. */
  readonly intervalMs?: number;
}

/**
 * Engine for chapters, ad-breaks, and mention markers. Cues fire forward-only —
 * seeking past a cue triggers it; seeking backward does not re-fire. Built atop
 * `getCurrentTime()` polling via `player.tickRead` so the read coalesces with
 * timeUpdate, abLoop, etc. on the same tick. Lazy-attached on first `cuepoint`
 * listener.
 */
export function cuePointExtension<T = unknown>(options: CuePointExtensionOptions<T>): Extension {
  const intervalMs = options.intervalMs ?? 250;
  // Sort once; firing logic walks the sorted array each tick.
  const sorted = [...options.cues].sort((a, b) => a.time - b.time);

  return {
    events: ['cuepoint'],
    attach(player: YTEmbed): () => void {
      let lastTime = Number.NaN;
      let detached = false;

      const tick = async () => {
        if (detached) return;
        try {
          const t = await player.tickRead<number>('getCurrentTime');
          if (detached) return;
          if (Number.isNaN(lastTime)) {
            lastTime = t;
            return;
          }
          if (t > lastTime) {
            for (let i = 0; i < sorted.length; i++) {
              const cue = sorted[i];
              if (!cue) continue;
              if (cue.time > lastTime && cue.time <= t) {
                player.dispatchEvent(
                  new CustomEvent('cuepoint', {
                    detail: { time: cue.time, payload: cue.payload, index: i },
                  }),
                );
              }
            }
          }
          lastTime = t;
        } catch {
          // Wrapper rejection — drop quietly.
        }
      };

      const unsubscribe = player.tick(() => void tick(), intervalMs);
      return () => {
        detached = true;
        unsubscribe();
      };
    },
  };
}
