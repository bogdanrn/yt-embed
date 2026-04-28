import type { PlayerStateCode } from '../playerState.js';
import { PlayerState } from '../playerState.js';
import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface AutoplayPolicyExtensionOptions {
  /** Time (ms) to wait for a play state-change before falling back to muted. Default: 1500. */
  fallbackTimeoutMs?: number;
  /** Allow the muted-fallback path. Default: true. */
  allowFallback?: boolean;
}

interface PlayCapable {
  playVideo: (...args: unknown[]) => Promise<unknown>;
  mute: () => Promise<void>;
}

/**
 * Wraps `playVideo` to enforce the standard autoplay-fallback ladder: try with
 * sound; if YT's `autoplayblocked` event fires (or the player does not transition
 * within `fallbackTimeoutMs`), call `mute()` then `playVideo()` and emit
 * `autoplaymuted`. Eager-attached.
 */
export function autoplayPolicyExtension(options: AutoplayPolicyExtensionOptions = {}): Extension {
  const timeoutMs = options.fallbackTimeoutMs ?? 1500;
  const allowFallback = options.allowFallback !== false;

  return {
    events: ['autoplaymuted'],
    eager: true,
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as PlayCapable;
      let detached = false;
      let inFallbackAttempt = false;
      const activeTimers = new Set<ReturnType<typeof setTimeout>>();

      const origPlayVideo = cap.playVideo.bind(player);

      const wrappedPlay = async (...args: unknown[]): Promise<unknown> => {
        const result = await origPlayVideo(...args);
        if (!allowFallback || detached || inFallbackAttempt) return result;

        // Watch for blocking signals: either an `autoplayblocked` YT event or
        // no state transition into PLAYING within the timeout window.
        const fallbackPromise = new Promise<void>((resolve) => {
          const cleanup = () => {
            if (timer) {
              clearTimeout(timer);
              activeTimers.delete(timer);
            }
            player.removeEventListener('autoplayblocked', onBlocked);
            player.removeEventListener('statechange', onState);
          };
          const onBlocked = () => {
            cleanup();
            resolve();
          };
          const onState = (e: Event) => {
            const ce = e as CustomEvent<{ state: PlayerStateCode }>;
            if (ce.detail.state === PlayerState.PLAYING) {
              cleanup();
              resolve();
            }
          };
          player.addEventListener('autoplayblocked', onBlocked);
          player.addEventListener('statechange', onState);
          const timer = setTimeout(() => {
            activeTimers.delete(timer);
            cleanup();
            if (!detached && player.state !== PlayerState.PLAYING) resolve();
          }, timeoutMs);
          activeTimers.add(timer);
        });

        void fallbackPromise.then(async () => {
          if (detached || player.state === PlayerState.PLAYING) return;
          inFallbackAttempt = true;
          try {
            await cap.mute();
            if (detached) return;
            await origPlayVideo();
            if (detached) return;
            player.dispatchEvent(new CustomEvent('autoplaymuted'));
          } catch {
            // Best-effort fallback; surface nothing if even the muted attempt fails.
          } finally {
            inFallbackAttempt = false;
          }
        });
        return result;
      };

      // Per-instance shadow of the prototype wrapper.
      (cap as unknown as { playVideo: typeof wrappedPlay }).playVideo = wrappedPlay;

      return () => {
        detached = true;
        for (const t of activeTimers) clearTimeout(t);
        activeTimers.clear();
        delete (cap as Partial<PlayCapable>).playVideo;
      };
    },
  };
}
