import type { YTEmbed } from '../YTEmbed.js';

export interface Extension {
  /** Event names this extension emits. Used by YTEmbed for lazy attach/detach. */
  readonly events: readonly string[];
  /**
   * If true, attach immediately after the player becomes ready, regardless of whether any
   * listener for `events` has been added. Use for side-effect extensions like mediaSession,
   * persistedState, or method-wrapping ones that must be active from the start. Default false
   * (lazy attach on first listener add).
   */
  readonly eager?: boolean;
  /**
   * Called by YTEmbed when the extension activates: either on first listener add for one
   * of `events` (default) or once after onReady (when `eager: true`). Returns a detach
   * function called on last-listener-remove or destroy.
   */
  attach(player: YTEmbed): () => void;
}
