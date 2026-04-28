import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface TimeUpdateExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  intervalMs?: number;
}

interface TimeReader {
  getCurrentTime: () => Promise<number>;
}

/**
 * Polls `getCurrentTime()` and emits `timeupdate` whenever the playhead moves.
 * Lazy-attached on first `timeupdate` listener; detached when the last leaves.
 */
export function timeUpdateExtension(options: TimeUpdateExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 250;
  return {
    events: ['timeupdate'],
    attach(player: YTEmbed): () => void {
      const reader = player as unknown as TimeReader;
      let last = -1;
      let detached = false;
      let inFlight = false;

      const tick = async () => {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const t = await reader.getCurrentTime();
          if (detached || t === last) return;
          last = t;
          player.dispatchEvent(new CustomEvent('timeupdate', { detail: { time: t } }));
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
