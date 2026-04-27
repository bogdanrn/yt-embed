import type { YTEmbed } from '../YTEmbed.js';

export interface Extension {
  /** Event names this extension emits. Used by YTEmbed for lazy attach/detach. */
  readonly events: readonly string[];
  /** Called on first listener add for any of `events`. Returns a detach function. */
  attach(player: YTEmbed): () => void;
}
