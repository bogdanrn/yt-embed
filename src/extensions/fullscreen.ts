import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface FullscreenExtensionOptions {
  /** Element to fullscreen. Default: the YTEmbed iframe. */
  target?: HTMLElement | (() => HTMLElement | null);
}

/**
 * Drives the browser Fullscreen API for the player iframe. Emits
 * `fullscreenchange` on enter/exit (works for both programmatic toggles and
 * user-initiated ones via the YT control bar). Adds three imperative methods
 * to the player instance: `enterFullscreen()`, `exitFullscreen()`,
 * `toggleFullscreen()`. Eager-attached.
 */
export function fullscreenExtension(options: FullscreenExtensionOptions = {}): Extension {
  return {
    events: ['fullscreenchange'],
    eager: true,
    attach(player: YTEmbed): () => void {
      if (typeof document === 'undefined') return () => {};

      const resolveTarget = (): HTMLElement | null => {
        if (typeof options.target === 'function') return options.target();
        return options.target ?? player.iframe;
      };

      const isFullscreen = (): boolean => document.fullscreenElement !== null;

      const onChange = () => {
        player.dispatchEvent(
          new CustomEvent('fullscreenchange', {
            detail: { fullscreen: isFullscreen(), element: document.fullscreenElement },
          }),
        );
      };
      document.addEventListener('fullscreenchange', onChange);

      const enter = async (): Promise<void> => {
        const el = resolveTarget();
        if (!el || isFullscreen()) return;
        await el.requestFullscreen();
      };
      const exit = async (): Promise<void> => {
        if (!isFullscreen()) return;
        await document.exitFullscreen();
      };
      const toggle = async (): Promise<void> => {
        if (isFullscreen()) await exit();
        else await enter();
      };

      const augment = player as unknown as {
        enterFullscreen?: () => Promise<void>;
        exitFullscreen?: () => Promise<void>;
        toggleFullscreen?: () => Promise<void>;
      };
      augment.enterFullscreen = enter;
      augment.exitFullscreen = exit;
      augment.toggleFullscreen = toggle;

      return () => {
        document.removeEventListener('fullscreenchange', onChange);
        delete augment.enterFullscreen;
        delete augment.exitFullscreen;
        delete augment.toggleFullscreen;
      };
    },
  };
}
