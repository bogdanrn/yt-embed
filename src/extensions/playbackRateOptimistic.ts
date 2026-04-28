import type { YTEmbed } from '../YTEmbed.js';
import { wrapInstanceMethod } from './_wrapInstanceMethod.js';
import type { Extension } from './types.js';

type SetRateFn = (rate: number, ...rest: unknown[]) => Promise<unknown>;

/**
 * Emits `playbackratechange` immediately on `setPlaybackRate` calls instead of
 * waiting for YT's confirmation event. The native event still fires later; the
 * optimistic emit dedupes by tracking the most-recently-requested rate and
 * suppressing the next native emit if it matches. Eager-attached.
 */
export function playbackRateOptimisticExtension(): Extension {
  return {
    events: [],
    eager: true,
    attach(player: YTEmbed): () => void {
      let pendingOptimistic: number | null = null;

      const onNative = (e: Event) => {
        const ce = e as CustomEvent<{ rate: number; optimistic?: boolean }>;
        if (ce.detail.optimistic) return; // our own emit
        if (pendingOptimistic !== null && pendingOptimistic === ce.detail.rate) {
          // Suppress the native confirmation; consumers already saw the optimistic emit.
          pendingOptimistic = null;
          ce.stopImmediatePropagation();
        }
      };
      player.addEventListener('playbackratechange', onNative, true);

      const restore = wrapInstanceMethod<SetRateFn>(player, 'setPlaybackRate', (previous) => {
        return async (rate, ...rest) => {
          pendingOptimistic = rate;
          player.dispatchEvent(
            new CustomEvent('playbackratechange', { detail: { rate, optimistic: true } }),
          );
          return previous(rate, ...rest);
        };
      });

      return () => {
        player.removeEventListener('playbackratechange', onNative, true);
        restore();
      };
    },
  };
}
