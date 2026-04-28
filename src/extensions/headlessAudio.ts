import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

/**
 * Hides the iframe with CSS positioning so the player runs as audio-only.
 * Useful for podcast-style consumption of video-only content. Eager-attached.
 */
export function headlessAudioExtension(): Extension {
  return {
    events: [],
    eager: true,
    attach(player: YTEmbed): () => void {
      const iframe = player.iframe;
      if (!iframe) return () => {};
      const previous = iframe.getAttribute('style') ?? '';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      return () => {
        iframe.setAttribute('style', previous);
        iframe.removeAttribute('aria-hidden');
      };
    },
  };
}
