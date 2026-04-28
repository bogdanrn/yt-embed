import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface AbLoopExtensionOptions {
  /** Loop start in seconds. */
  readonly start: number;
  /** Loop end in seconds. */
  readonly end: number;
  /** Polling interval in ms. Default: 250. */
  readonly intervalMs?: number;
}

interface LoopCapable {
  getCurrentTime: () => Promise<number>;
  seekTo: (time: number, allowSeekAhead: boolean) => Promise<void>;
}

/**
 * A→B loop. Polls `getCurrentTime()`; when the playhead crosses `end`, seeks to
 * `start`. Lazy-attached on first `loop` listener; consumers can also detach by
 * removing the extension. Emits `loop` after each seek.
 */
export function abLoopExtension(options: AbLoopExtensionOptions): Extension {
  const intervalMs = options.intervalMs ?? 250;
  const { start, end } = options;
  return {
    events: ['loop'],
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as LoopCapable;
      let detached = false;
      let inFlight = false;

      const tick = async () => {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const t = await cap.getCurrentTime();
          if (detached) return;
          if (t >= end) {
            await cap.seekTo(start, true);
            if (detached) return;
            player.dispatchEvent(new CustomEvent('loop', { detail: { start, end } }));
          }
        } finally {
          inFlight = false;
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
