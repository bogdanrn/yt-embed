import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface CaptionsLanguageExtensionOptions {
  /** Apply this language as soon as the player becomes ready. */
  defaultLanguage?: string;
}

interface SetCaptionsCapable {
  call: (method: string, ...args: unknown[]) => Promise<unknown>;
}

/**
 * Convenience wrapper over the undocumented `setOption('captions', 'track', ...)`
 * call. Emits `captionschange` after a successful change. Use the player's
 * `setCaptionsLanguage` action by passing a language code as `setLanguage()`.
 * Eager-attached if `defaultLanguage` is set; otherwise lazy on `captionschange`.
 */
export function captionsLanguageExtension(
  options: CaptionsLanguageExtensionOptions = {},
): Extension {
  const eager = options.defaultLanguage !== undefined;
  return {
    events: ['captionschange'],
    ...(eager && { eager: true }),
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as SetCaptionsCapable;
      let detached = false;

      const setLanguage = async (languageCode: string | null) => {
        if (detached) return;
        try {
          await cap.call('setOption', 'captions', 'track', { languageCode });
          if (detached) return;
          player.dispatchEvent(new CustomEvent('captionschange', { detail: { languageCode } }));
        } catch {
          // setOption may reject if captions are not yet available; tolerate.
        }
      };

      // Expose the helper on the player so consumers can call it imperatively.
      (
        player as unknown as { setCaptionsLanguage?: (code: string | null) => Promise<void> }
      ).setCaptionsLanguage = setLanguage;

      if (options.defaultLanguage !== undefined) {
        void setLanguage(options.defaultLanguage);
      }

      return () => {
        detached = true;
        delete (
          player as unknown as { setCaptionsLanguage?: (code: string | null) => Promise<void> }
        ).setCaptionsLanguage;
      };
    },
  };
}
