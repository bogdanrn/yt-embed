import type { YTEmbed } from '../YTEmbed.js';
import { pollAndDispatch } from './_pollAndDispatch.js';
import type { Extension } from './types.js';

export interface TimeUpdateExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  intervalMs?: number;
}

/**
 * Polls `getCurrentTime()` and emits `timeupdate` whenever the playhead moves.
 * Lazy-attached on first `timeupdate` listener. Reads via `player.tickRead` so
 * cuePoint, abLoop, persistedState sharing the same tick reuse one in-flight call.
 */
export function timeUpdateExtension(options: TimeUpdateExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 250;
  return {
    events: ['timeupdate'],
    attach(player: YTEmbed): () => void {
      return pollAndDispatch({
        player,
        eventName: 'timeupdate',
        intervalMs,
        read: () => player.tickRead<number>('getCurrentTime'),
        toDetail: (time) => ({ time }),
      });
    },
  };
}
