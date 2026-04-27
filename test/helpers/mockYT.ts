import { vi } from 'vitest';

export interface MockYTPlayer {
  // Filled lazily as YTEmbed.test demands. Initially empty.
  readonly _events: Record<string, unknown>;
  destroy: ReturnType<typeof vi.fn>;
}

export interface MockYT {
  Player: ReturnType<typeof vi.fn>;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

/**
 * Installs a fake `window.YT`. Call within a test; pair with `cleanup()`.
 * Does NOT call `onYouTubeIframeAPIReady` — caller decides when.
 */
export function installMockYT(): { yt: MockYT; cleanup: () => void } {
  const yt: MockYT = {
    Player: vi.fn(() => ({
      _events: {},
      destroy: vi.fn(),
    })),
    PlayerState: {
      UNSTARTED: -1,
      ENDED: 0,
      PLAYING: 1,
      PAUSED: 2,
      BUFFERING: 3,
      CUED: 5,
    },
  };
  // biome-ignore lint/suspicious/noExplicitAny: jsdom global injection is an unavoidable any.
  (window as any).YT = yt;
  return {
    yt,
    cleanup: () => {
      // biome-ignore lint/suspicious/noExplicitAny: jsdom global teardown.
      (window as any).YT = undefined;
      // biome-ignore lint/suspicious/noExplicitAny: jsdom global teardown.
      (window as any).onYouTubeIframeAPIReady = undefined;
      for (const s of document.querySelectorAll('script[src*="youtube.com/iframe_api"]')) {
        s.remove();
      }
    },
  };
}

/** Trigger the YT-ready callback if any was registered. */
export function fireYTReady(): void {
  // biome-ignore lint/suspicious/noExplicitAny: jsdom global access.
  const cb = (window as any).onYouTubeIframeAPIReady as (() => void) | undefined;
  cb?.();
}
