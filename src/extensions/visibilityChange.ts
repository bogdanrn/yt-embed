import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface VisibilityChangeExtensionOptions {
  /** IntersectionObserver threshold (0–1). Default: 0.25. */
  threshold?: number;
  /** Auto-pause the player when it scrolls out of view. Default: false. */
  autoPause?: boolean;
}

interface PauseCapable {
  pauseVideo: () => Promise<void>;
}

/**
 * Watches the iframe's parent element with IntersectionObserver and emits
 * `visibilitychange` when it enters/exits the viewport. Optional auto-pause on
 * hide. Lazy-attached on first `visibilitychange` listener.
 */
export function visibilityChangeExtension(
  options: VisibilityChangeExtensionOptions = {},
): Extension {
  const threshold = options.threshold ?? 0.25;
  const autoPause = options.autoPause ?? false;

  return {
    events: ['visibilitychange'],
    attach(player: YTEmbed): () => void {
      if (typeof IntersectionObserver === 'undefined') return () => {};
      const target = player.iframe?.parentElement ?? null;
      if (!target) return () => {};

      let lastVisible = false;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
            if (visible === lastVisible) continue;
            lastVisible = visible;
            player.dispatchEvent(
              new CustomEvent('visibilitychange', {
                detail: { visible, ratio: entry.intersectionRatio },
              }),
            );
            if (!visible && autoPause) {
              void (player as unknown as PauseCapable).pauseVideo();
            }
          }
        },
        { threshold },
      );
      observer.observe(target);
      return () => observer.disconnect();
    },
  };
}
