import type { PlayerStateCode } from '../playerState.js';
import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface ScrubBarSyncExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  intervalMs?: number;
}

/**
 * Combines `getCurrentTime` + `getDuration` + `getVideoLoadedFraction` into a
 * single throttled `scrubsync` event. Reads via `player.tickRead`, so when
 * timeUpdate / durationChange / bufferProgress are also active they share the
 * same in-flight calls — three IPCs per tick total, not nine. State is read
 * from the cached `player.state` getter (no extra IPC). Lazy-attached.
 */
export function scrubBarSyncExtension(options: ScrubBarSyncExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 250;
  return {
    events: ['scrubsync'],
    attach(player: YTEmbed): () => void {
      let detached = false;
      let lastKey = '';

      const tick = async () => {
        if (detached) return;
        try {
          const [currentTime, duration, buffered] = await Promise.all([
            player.tickRead<number>('getCurrentTime'),
            player.tickRead<number>('getDuration'),
            player.tickRead<number>('getVideoLoadedFraction'),
          ]);
          if (detached) return;
          const state: PlayerStateCode = player.state;
          // Cheap dedupe: same numbers and state ⇒ skip emission.
          const key = `${currentTime}|${duration}|${buffered}|${state}`;
          if (key === lastKey) return;
          lastKey = key;
          player.dispatchEvent(
            new CustomEvent('scrubsync', {
              detail: { currentTime, duration, buffered, state },
            }),
          );
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
