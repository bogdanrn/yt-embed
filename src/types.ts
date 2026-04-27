import type { Extension } from './extensions/types.js';
import type { PlayerStateCode } from './playerState.js';

export type { Extension };
export type PlayerVars = YT.PlayerVars;

export interface MethodCallOptions {
  /** Resolve on the next `statechange` event instead of immediately. Default: false. */
  awaitState?: boolean;
  /** Cancels the wrapper's promise. See spec §3.3. */
  signal?: AbortSignal;
}

export interface YTEmbedOptions {
  videoId?: string;
  width?: number;
  height?: number;
  playerVars?: PlayerVars;
  signal?: AbortSignal;
  extensions?: readonly Extension[];
  /** Time (ms) to wait for `onReady` before rejecting `whenReady()`. Default: 30_000. */
  initTimeoutMs?: number;
}

export interface YTEmbedEventMap {
  ready: CustomEvent<{ player: unknown }>;
  statechange: CustomEvent<{ state: PlayerStateCode }>;
  playbackqualitychange: CustomEvent<{ quality: string }>;
  playbackratechange: CustomEvent<{ rate: number }>;
  error: CustomEvent<{ code: number; message: string }>;
  apichange: CustomEvent<void>;
  // Synthesised by volumeChangeExtension. Declared on the canonical map because
  // tsdown bundles all .d.ts into one file, making relative-path module
  // augmentation unreliable.
  volumechange: CustomEvent<{ volume: number; muted: boolean }>;
}
