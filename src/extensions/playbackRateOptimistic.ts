import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

interface RateCapable {
  setPlaybackRate: (rate: number, ...rest: unknown[]) => Promise<unknown>;
}

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
      const cap = player as unknown as RateCapable;
      let pendingOptimistic: number | null = null;

      const origSetPlaybackRate = cap.setPlaybackRate.bind(player);

      const wrappedSet = async (rate: number, ...rest: unknown[]): Promise<unknown> => {
        pendingOptimistic = rate;
        player.dispatchEvent(
          new CustomEvent('playbackratechange', { detail: { rate, optimistic: true } }),
        );
        return origSetPlaybackRate(rate, ...rest);
      };

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

      (cap as unknown as { setPlaybackRate: typeof wrappedSet }).setPlaybackRate = wrappedSet;

      return () => {
        player.removeEventListener('playbackratechange', onNative, true);
        delete (cap as Partial<RateCapable>).setPlaybackRate;
      };
    },
  };
}
