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

interface SeekCapable {
  seekTo: (time: number, allowSeekAhead: boolean) => Promise<void>;
}

/**
 * A→B loop. Reads `getCurrentTime()` via the shared tick cache; when the
 * playhead crosses `end`, seeks to `start` and emits `loop`. Lazy-attached on
 * first `loop` listener.
 */
export function abLoopExtension(options: AbLoopExtensionOptions): Extension {
  const intervalMs = options.intervalMs ?? 250;
  const { start, end } = options;
  return {
    events: ['loop'],
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as SeekCapable;
      let detached = false;

      const tick = async () => {
        if (detached) return;
        try {
          const t = await player.tickRead<number>('getCurrentTime');
          if (detached) return;
          if (t >= end) {
            await cap.seekTo(start, true);
            if (detached) return;
            player.dispatchEvent(new CustomEvent('loop', { detail: { start, end } }));
          }
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
