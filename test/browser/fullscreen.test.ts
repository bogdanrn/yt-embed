import { afterEach, describe, expect, it, vi } from 'vitest';
import { fullscreenExtension, YTEmbed } from '../../src/index.js';
import { _resetForTests } from '../../src/loadIframeApi.js';

// Browser-mode test exercising the real Fullscreen API. Skipped in jsdom
// (no fullscreen support); run via `pnpm test:browser` against Chromium.

declare global {
  interface Window {
    YT?: unknown;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function installFakeYT(): { fakePlayer: Record<string, unknown> } {
  const fakePlayer: Record<string, unknown> = {
    destroy: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
  };
  // biome-ignore lint/suspicious/noExplicitAny: install YT global for tests.
  (window as any).YT = {
    Player: vi.fn(function MockPlayer(
      _el: HTMLElement,
      options: { events: Record<string, unknown> },
    ) {
      // Capture events so we can fire onReady.
      // biome-ignore lint/suspicious/noExplicitAny: dynamic event store.
      (fakePlayer as any)._events = options.events;
      return fakePlayer;
    }),
  };
  return { fakePlayer };
}

describe('fullscreenExtension (browser mode)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    _resetForTests();
    // biome-ignore lint/suspicious/noExplicitAny: clean up window.YT.
    (window as any).YT = undefined;
  });

  it('exposes enterFullscreen / exitFullscreen / toggleFullscreen on the player', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const { fakePlayer } = installFakeYT();
    const player = new YTEmbed('host', {
      videoId: 'abc',
      extensions: [fullscreenExtension()],
    });

    // Trigger onReady so the eager fullscreen extension attaches.
    if (typeof window.onYouTubeIframeAPIReady === 'function') window.onYouTubeIframeAPIReady();
    await Promise.resolve();
    // biome-ignore lint/suspicious/noExplicitAny: read the captured events store.
    (fakePlayer as any)._events.onReady?.({});

    expect(typeof player.enterFullscreen).toBe('function');
    expect(typeof player.exitFullscreen).toBe('function');
    expect(typeof player.toggleFullscreen).toBe('function');

    player.destroy();
    expect(player.enterFullscreen).toBeUndefined();
  });
});
