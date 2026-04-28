import type { YTEmbed } from '../YTEmbed.js';
import { pollAndDispatch } from './_pollAndDispatch.js';
import type { Extension } from './types.js';

export interface DurationChangeExtensionOptions {
  /** Polling interval in ms. Default: 1000. */
  intervalMs?: number;
}

/**
 * Polls `getDuration()` and emits `durationchange` whenever the value changes
 * (live streams, mid-stream cuepoints, playlist transitions). Lazy-attached.
 */
export function durationChangeExtension(options: DurationChangeExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 1000;
  return {
    events: ['durationchange'],
    attach(player: YTEmbed): () => void {
      return pollAndDispatch({
        player,
        eventName: 'durationchange',
        intervalMs,
        read: () => player.tickRead<number>('getDuration'),
        toDetail: (duration) => ({ duration }),
      });
    },
  };
}
