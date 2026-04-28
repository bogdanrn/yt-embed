import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface ErrorRetryExtensionOptions {
  /** Max retry attempts before giving up. Default: 3. */
  maxRetries?: number;
  /** Initial backoff delay in ms (doubled each retry). Default: 500. */
  initialDelayMs?: number;
  /** Error codes that trigger a retry. Default: [5, 100] (HTML5 + video-not-found). */
  codes?: readonly number[];
}

interface RetryReader {
  getVideoData: () => Promise<{ video_id: string }>;
  loadVideoById: (id: string) => Promise<void>;
}

const DEFAULT_RETRYABLE_CODES = [5, 100] as const;

/**
 * On retryable `error` events, reloads the current video with exponential
 * backoff. Emits `retry` for each attempt. Eager-attached.
 */
export function errorRetryExtension(options: ErrorRetryExtensionOptions = {}): Extension {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 500;
  const retryable = new Set(options.codes ?? DEFAULT_RETRYABLE_CODES);

  return {
    events: ['retry'],
    eager: true,
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as RetryReader;
      let attempts = 0;
      let detached = false;
      const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

      const onError = (e: Event) => {
        const ce = e as CustomEvent<{ code: number }>;
        const { code } = ce.detail;
        if (!retryable.has(code) || attempts >= maxRetries || detached) return;
        const attempt = ++attempts;
        const delayMs = initialDelay * 2 ** (attempt - 1);
        const timer = setTimeout(() => {
          pendingTimers.delete(timer);
          if (detached) return;
          void (async () => {
            try {
              const data = await cap.getVideoData();
              if (detached || !data.video_id) return;
              player.dispatchEvent(
                new CustomEvent('retry', {
                  detail: { attempt, code, delayMs },
                }),
              );
              await cap.loadVideoById(data.video_id);
            } catch {
              // If re-load itself fails, let the next error event drive any further retry.
            }
          })();
        }, delayMs);
        pendingTimers.add(timer);
      };

      player.addEventListener('error', onError);
      return () => {
        detached = true;
        player.removeEventListener('error', onError);
        for (const timer of pendingTimers) clearTimeout(timer);
        pendingTimers.clear();
      };
    },
  };
}
