import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface DurationChangeExtensionOptions {
  /** Polling interval in ms. Default: 1000. */
  intervalMs?: number;
}

interface DurationReader {
  getDuration: () => Promise<number>;
}

/**
 * Polls `getDuration()` and emits `durationchange` whenever the value changes
 * (live streams, mid-stream cuepoints, playlist transitions). Lazy-attached.
 */
export function durationChangeExtension(options: DurationChangeExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 1000;
  return {
    events: ['durationchange'],
    attach(player: YTEmbed): () => void {
      const reader = player as unknown as DurationReader;
      let last = Number.NaN;
      let detached = false;
      let inFlight = false;

      const tick = async () => {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const d = await reader.getDuration();
          if (detached) return;
          if (d === last || (Number.isNaN(d) && Number.isNaN(last))) return;
          last = d;
          player.dispatchEvent(new CustomEvent('durationchange', { detail: { duration: d } }));
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
