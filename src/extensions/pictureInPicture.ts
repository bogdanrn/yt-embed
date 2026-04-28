import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

/**
 * Best-effort Picture-in-Picture support. Calls `requestPictureInPicture()` on
 * any `<video>` element discoverable from the iframe parent (only works if the
 * iframe is same-origin or otherwise reachable, which is rare — most YT
 * embeds are cross-origin and PiP is gated by the inner controls). Adds three
 * imperative methods: `enterPictureInPicture()`, `exitPictureInPicture()`,
 * `togglePictureInPicture()`. Emits `pipchange`. Eager-attached.
 *
 * Note: cross-origin iframes block direct access to the inner `<video>`. In
 * that case the methods reject and `pipchange` only fires for user-initiated
 * PiP (via YouTube's own controls), which the browser exposes through
 * `enterpictureinpicture` / `leavepictureinpicture` events on the document.
 */
export function pictureInPictureExtension(): Extension {
  return {
    events: ['pipchange'],
    eager: true,
    attach(player: YTEmbed): () => void {
      if (typeof document === 'undefined') return () => {};

      const findVideo = (): HTMLVideoElement | null => {
        const iframe = player.iframe;
        if (!iframe) return null;
        try {
          return iframe.contentDocument?.querySelector('video') ?? null;
        } catch {
          // Cross-origin: inner document is opaque to us.
          return null;
        }
      };

      const onEnter = () => {
        player.dispatchEvent(new CustomEvent('pipchange', { detail: { active: true } }));
      };
      const onLeave = () => {
        player.dispatchEvent(new CustomEvent('pipchange', { detail: { active: false } }));
      };
      document.addEventListener('enterpictureinpicture', onEnter);
      document.addEventListener('leavepictureinpicture', onLeave);

      const enter = async (): Promise<void> => {
        const video = findVideo();
        if (!video) {
          throw new Error(
            'pictureInPictureExtension: cannot reach inner <video> (cross-origin iframe). ' +
              'Use the YouTube control-bar PiP button instead.',
          );
        }
        await video.requestPictureInPicture();
      };
      const exit = async (): Promise<void> => {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
      };
      const toggle = async (): Promise<void> => {
        if (document.pictureInPictureElement) await exit();
        else await enter();
      };

      const augment = player as unknown as {
        enterPictureInPicture?: () => Promise<void>;
        exitPictureInPicture?: () => Promise<void>;
        togglePictureInPicture?: () => Promise<void>;
      };
      augment.enterPictureInPicture = enter;
      augment.exitPictureInPicture = exit;
      augment.togglePictureInPicture = toggle;

      return () => {
        document.removeEventListener('enterpictureinpicture', onEnter);
        document.removeEventListener('leavepictureinpicture', onLeave);
        delete augment.enterPictureInPicture;
        delete augment.exitPictureInPicture;
        delete augment.togglePictureInPicture;
      };
    },
  };
}
