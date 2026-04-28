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
  /**
   * Base cadence (ms) for the shared polling ticker that drives time-based extensions
   * (timeUpdate, durationChange, bufferProgress, cuePoint, abLoop, scrubBarSync,
   * persistedState). One `setInterval` runs across all of them; each subscriber is
   * invoked every `intervalMs / pollingIntervalMs` ticks. Default: 250.
   */
  pollingIntervalMs?: number;
  /**
   * `'enhanced'` switches the iframe origin to `https://www.youtube-nocookie.com`,
   * which YouTube serves without setting tracking cookies until playback starts.
   * Default `'standard'`.
   */
  privacyMode?: 'standard' | 'enhanced';
  /**
   * When `true`, YTEmbed mounts the YouTube iframe inside a managed wrapper element
   * appended to the user-supplied target. The user's element stays in the DOM after
   * `destroy()` and is never replaced by the YouTube iframe. Default `false`.
   */
  isolate?: boolean;
}

export interface YTEmbedEventMap {
  ready: CustomEvent<{ player: unknown }>;
  statechange: CustomEvent<{ state: PlayerStateCode }>;
  playbackqualitychange: CustomEvent<{ quality: string }>;
  playbackratechange: CustomEvent<{ rate: number; optimistic?: boolean }>;
  error: CustomEvent<{ code: number; message: string }>;
  apichange: CustomEvent<void>;
  autoplayblocked: CustomEvent<void>;
  // Extension-synthesised events. Declared on the canonical map because tsdown
  // bundles all .d.ts into one file, making relative-path module augmentation
  // unreliable. Importing the corresponding extension does not "extend" the map
  // at the type layer — it is already declared here for every supported event.
  volumechange: CustomEvent<{ volume: number; muted: boolean }>;
  timeupdate: CustomEvent<{ time: number }>;
  durationchange: CustomEvent<{ duration: number }>;
  bufferprogress: CustomEvent<{ fraction: number }>;
  cuepoint: CustomEvent<{ time: number; payload: unknown; index: number }>;
  chapterchange: CustomEvent<{ index: number; title: string; time: number }>;
  visibilitychange: CustomEvent<{ visible: boolean; ratio: number }>;
  mediasessionupdate: CustomEvent<{ metadata: MediaMetadata | null }>;
  captionschange: CustomEvent<{ languageCode: string | null }>;
  retry: CustomEvent<{ attempt: number; code: number; delayMs: number }>;
  loop: CustomEvent<{ start: number; end: number }>;
  seekclamped: CustomEvent<{ requested: number; clamped: number }>;
  autoplaymuted: CustomEvent<void>;
  scrubsync: CustomEvent<{
    currentTime: number;
    duration: number;
    buffered: number;
    state: PlayerStateCode;
  }>;
  fullscreenchange: CustomEvent<{ fullscreen: boolean; element: Element | null }>;
  pipchange: CustomEvent<{ active: boolean }>;
}
