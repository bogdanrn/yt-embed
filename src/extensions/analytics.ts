import type { PlayerStateCode } from '../playerState.js';
import { PlayerState } from '../playerState.js';
import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export type AnalyticsEvent =
  | { type: 'play'; time: number }
  | { type: 'pause'; time: number }
  | { type: 'seek'; from: number; to: number }
  | { type: 'complete'; time: number; quartile: 25 | 50 | 75 | 100 }
  | { type: 'watch-time-chunk'; seconds: number };

export interface AnalyticsExtensionOptions {
  /** Required. Receives every analytics event. */
  sink: (event: AnalyticsEvent) => void;
  /** Watch-time aggregation window in seconds. Default: 10. */
  chunkSeconds?: number;
  /** Emit complete-25/50/75/100 quartile events. Default: true. */
  quartileEvents?: boolean;
}

interface DurationReader {
  getDuration: () => Promise<number>;
}

/**
 * Subscribes to canonical player events and emits structured analytics callbacks.
 * Quartile events fire once per video; watch-time-chunk aggregates listening time
 * since the last chunk emission. Eager-attached.
 */
export function analyticsExtension(options: AnalyticsExtensionOptions): Extension {
  const chunkSeconds = options.chunkSeconds ?? 10;
  const wantQuartiles = options.quartileEvents !== false;
  const { sink } = options;

  return {
    events: [],
    eager: true,
    attach(player: YTEmbed): () => void {
      const cap = player as unknown as DurationReader;
      let lastTime = 0;
      let watchedSinceChunk = 0;
      const firedQuartiles = new Set<25 | 50 | 75 | 100>();
      let detached = false;

      const onTime = (e: Event) => {
        const ce = e as CustomEvent<{ time: number }>;
        const t = ce.detail.time;
        const delta = t - lastTime;
        // Detect seeks: a sudden jump > 2s while playing is treated as a seek.
        if (Math.abs(delta) > 2 && player.state === PlayerState.PLAYING) {
          sink({ type: 'seek', from: lastTime, to: t });
        } else if (delta > 0 && delta <= 2 && player.state === PlayerState.PLAYING) {
          // Smooth advance — accumulate watch time.
          watchedSinceChunk += delta;
          if (watchedSinceChunk >= chunkSeconds) {
            sink({ type: 'watch-time-chunk', seconds: watchedSinceChunk });
            watchedSinceChunk = 0;
          }
        }
        lastTime = t;

        if (wantQuartiles) {
          void (async () => {
            try {
              const duration = await cap.getDuration();
              if (detached || !Number.isFinite(duration) || duration <= 0) return;
              const ratio = t / duration;
              const quartiles: ReadonlyArray<{ q: 25 | 50 | 75 | 100; threshold: number }> = [
                { q: 25, threshold: 0.25 },
                { q: 50, threshold: 0.5 },
                { q: 75, threshold: 0.75 },
                { q: 100, threshold: 0.99 },
              ];
              for (const { q, threshold } of quartiles) {
                if (ratio >= threshold && !firedQuartiles.has(q)) {
                  firedQuartiles.add(q);
                  sink({ type: 'complete', time: t, quartile: q });
                }
              }
            } catch {
              // getDuration unavailable; quartiles will retry next tick.
            }
          })();
        }
      };

      const onState = (e: Event) => {
        const ce = e as CustomEvent<{ state: PlayerStateCode }>;
        if (ce.detail.state === PlayerState.PLAYING) {
          sink({ type: 'play', time: lastTime });
        } else if (ce.detail.state === PlayerState.PAUSED) {
          sink({ type: 'pause', time: lastTime });
          if (watchedSinceChunk > 0) {
            sink({ type: 'watch-time-chunk', seconds: watchedSinceChunk });
            watchedSinceChunk = 0;
          }
        }
      };

      player.addEventListener('timeupdate', onTime);
      player.addEventListener('statechange', onState);
      return () => {
        detached = true;
        player.removeEventListener('timeupdate', onTime);
        player.removeEventListener('statechange', onState);
        if (watchedSinceChunk > 0) {
          sink({ type: 'watch-time-chunk', seconds: watchedSinceChunk });
        }
      };
    },
  };
}
