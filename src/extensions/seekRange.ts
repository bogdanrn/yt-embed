import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface SeekRangeExtensionOptions {
  /** Lower bound (seconds). Default: -Infinity (no lower clamp). */
  min?: number;
  /** Upper bound (seconds). Default: +Infinity (no upper clamp). */
  max?: number;
}

interface SeekCapable {
  seekTo: (time: number, allowSeekAhead: boolean, ...rest: unknown[]) => Promise<unknown>;
}

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
      const cap = player as unknown as SeekCapable;
      const origSeekTo = cap.seekTo.bind(player);

      const wrappedSeek = async (
        time: number,
        allowSeekAhead: boolean,
        ...rest: unknown[]
      ): Promise<unknown> => {
        const clamped = Math.min(Math.max(time, min), max);
        if (clamped !== time) {
          player.dispatchEvent(
            new CustomEvent('seekclamped', { detail: { requested: time, clamped } }),
          );
        }
        return origSeekTo(clamped, allowSeekAhead, ...rest);
      };

      (cap as unknown as { seekTo: typeof wrappedSeek }).seekTo = wrappedSeek;

      return () => {
        delete (cap as Partial<SeekCapable>).seekTo;
      };
    },
  };
}
