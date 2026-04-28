import type { YTEmbed } from '../YTEmbed.js';
import { pollAndDispatch } from './_pollAndDispatch.js';
import type { Extension } from './types.js';

export interface BufferProgressExtensionOptions {
  /** Polling interval in ms. Default: 500. */
  intervalMs?: number;
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
      return pollAndDispatch({
        player,
        eventName: 'bufferprogress',
        intervalMs,
        read: () => player.tickRead<number>('getVideoLoadedFraction'),
        toDetail: (fraction) => ({ fraction }),
      });
    },
  };
}
