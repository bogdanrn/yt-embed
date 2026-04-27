import type { PlayerStateCode } from './playerState.js';

export type { PlayerStateCode };
export type PlayerVars = YT.PlayerVars;

export interface MethodCallOptions {
  /** Resolve on the next `statechange` event instead of immediately. Default: false. */
  awaitState?: boolean;
  /** Cancels the wrapper's promise. See spec §3.3. */
  signal?: AbortSignal;
}

// Extension interface is forward-declared here so YTEmbedOptions can
// reference it. The canonical declaration lives in `extensions/types.ts`
// (Phase 4) and is structurally identical, so cross-file usage stays
// compatible without explicit re-export.
export interface Extension {
  readonly events: readonly string[];
  attach(player: unknown): () => void;
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
  // Synthesised by the built-in volumeChangeExtension. Fires only when the
  // extension is registered; declared here so types are stable in the
  // published .d.ts bundle (relative-path module augmentation is unreliable
  // after tsdown rolls all source into one .d.ts file).
  volumechange: CustomEvent<{ volume: number; muted: boolean }>;
}
