import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface BufferProgressExtensionOptions {
  /** Polling interval in ms. Default: 500. */
  intervalMs?: number;
}

interface BufferReader {
  getVideoLoadedFraction: () => Promise<number>;
}

/**
 * Polls `getVideoLoadedFraction()` and emits `bufferprogress` when the loaded
 * fraction changes. Drives buffer bars and load-state UI. Lazy-attached.
 */
export function bufferProgressExtension(options: BufferProgressExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 500;
  return {
    events: ['bufferprogress'],
    attach(player: YTEmbed): () => void {
      const reader = player as unknown as BufferReader;
      let last = -1;
      let detached = false;
      let inFlight = false;

      const tick = async () => {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const fraction = await reader.getVideoLoadedFraction();
          if (detached || fraction === last) return;
          last = fraction;
          player.dispatchEvent(new CustomEvent('bufferprogress', { detail: { fraction } }));
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
