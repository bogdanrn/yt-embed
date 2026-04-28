import type { YTEmbed } from '../YTEmbed.js';
import { wrapInstanceMethod } from './_wrapInstanceMethod.js';
import type { Extension } from './types.js';

export interface SeekRangeExtensionOptions {
  /** Lower bound (seconds). Default: -Infinity (no lower clamp). */
  min?: number;
  /** Upper bound (seconds). Default: +Infinity (no upper clamp). */
  max?: number;
}

type SeekFn = (time: number, allowSeekAhead: boolean, ...rest: unknown[]) => Promise<unknown>;

/**
 * Wraps `seekTo` to clamp the requested time to `[min, max]`. Useful for clip
 * players, preview windows, and segmented playback. Emits `seekclamped` when an
 * adjustment was actually made. Eager-attached.
 */
export function seekRangeExtension(options: SeekRangeExtensionOptions = {}): Extension {
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;

  return {
    events: ['seekclamped'],
    eager: true,
    attach(player: YTEmbed): () => void {
      return wrapInstanceMethod<SeekFn>(player, 'seekTo', (previous) => {
        return async (time: number, allowSeekAhead: boolean, ...rest: unknown[]) => {
          const clamped = Math.min(Math.max(time, min), max);
          if (clamped !== time) {
            player.dispatchEvent(
              new CustomEvent('seekclamped', { detail: { requested: time, clamped } }),
            );
          }
          return previous(clamped, allowSeekAhead, ...rest);
        };
      });
    },
  };
}
