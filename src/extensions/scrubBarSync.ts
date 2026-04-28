import type { PlayerStateCode } from '../playerState.js';
import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface ScrubBarSyncExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  intervalMs?: number;
}

interface ScrubReader {
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  getVideoLoadedFraction: () => Promise<number>;
}

/**
 * Combines `getCurrentTime` + `getDuration` + `getVideoLoadedFraction` into a
 * single throttled `scrubsync` event. Drops the "three independent polls per
 * tick" pattern that scrub-bar code usually accumulates. State is read from the
 * player's cached `state` getter (no extra IPC). Lazy-attached.
 */
export function scrubBarSyncExtension(options: ScrubBarSyncExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 250;
  return {
    events: ['scrubsync'],
    attach(player: YTEmbed): () => void {
      const reader = player as unknown as ScrubReader;
      let detached = false;
      let inFlight = false;
      let lastKey = '';

      const tick = async () => {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const [currentTime, duration, buffered] = await Promise.all([
            reader.getCurrentTime(),
            reader.getDuration(),
            reader.getVideoLoadedFraction(),
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
