import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YTEmbed } from '../../src/YTEmbed.js';
import { PlayerDestroyedError } from '../../src/errors.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { type MockYT, fireYTReady, installMockYT } from '../helpers/mockYT.js';

async function setupPlayer(yt: MockYT): Promise<{
  player: YTEmbed;
  fakePlayer: {
    playVideo: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    pauseVideo: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  fireOnReady: () => void;
  fireStateChange: (code: number) => void;
}> {
  document.body.innerHTML = '<div id="host"></div>';
  const fakePlayer = {
    playVideo: vi.fn(() => undefined),
    seekTo: vi.fn(() => undefined),
    pauseVideo: vi.fn(() => undefined),
    destroy: vi.fn(() => undefined),
  };
  yt.Player.mockImplementation(() => fakePlayer);

  const player = new YTEmbed('host', { videoId: 'abc' });
  fireYTReady();
  await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
  // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
  const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
  return {
    player,
    fakePlayer,
    fireOnReady: () => events.onReady?.({}),
    fireStateChange: (code) => events.onStateChange?.({ data: code }),
  };
}

describe('YTEmbed: methods', () => {
  let yt: MockYT;
  let cleanup: () => void;

  beforeEach(() => {
    ({ yt, cleanup } = installMockYT());
    _resetForTests();
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('queues call before ready, forwards after', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const fakePlayer = { playVideo: vi.fn(), destroy: vi.fn() };
    yt.Player.mockImplementation(() => fakePlayer);

    const player = new YTEmbed('host', { videoId: 'abc' });
    const callPromise = player.call('playVideo');
    expect(fakePlayer.playVideo).not.toHaveBeenCalled();

    fireYTReady();
    await Promise.resolve(); // flush microtasks
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});

    await callPromise;
    expect(fakePlayer.playVideo).toHaveBeenCalledTimes(1);
  });

  it('preserves call order across multiple queued calls', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const order: string[] = [];
    const fakePlayer = {
      playVideo: vi.fn(() => order.push('play')),
      seekTo: vi.fn(() => order.push('seek')),
      pauseVideo: vi.fn(() => order.push('pause')),
      destroy: vi.fn(),
    };
    yt.Player.mockImplementation(() => fakePlayer);

    const player = new YTEmbed('host', { videoId: 'abc' });
    const a = player.call('playVideo');
    const b = player.call('seekTo', 30, true);
    const c = player.call('pauseVideo');

    fireYTReady();
    await Promise.resolve(); // flush microtasks
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});
    await Promise.all([a, b, c]);
    expect(order).toEqual(['play', 'seek', 'pause']);
  });

  it('awaitState: true resolves on next statechange', async () => {
    const ctx = await setupPlayer(yt);
    ctx.fireOnReady();
    const promise = ctx.player.call('playVideo', { awaitState: true });
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    ctx.fireStateChange(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it('awaitState + AbortSignal.timeout rejects with AbortError', async () => {
    vi.useFakeTimers();
    try {
      const ctx = await setupPlayer(yt);
      ctx.fireOnReady();
      const promise = ctx.player.call('playVideo', {
        awaitState: true,
        signal: AbortSignal.timeout(100),
      });
      vi.advanceTimersByTime(150);
      await expect(promise).rejects.toMatchObject({ name: 'TimeoutError' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('destroy() rejects pending method promises with PlayerDestroyedError', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const fakePlayer = { playVideo: vi.fn(), destroy: vi.fn() };
    yt.Player.mockImplementation(() => fakePlayer);

    const player = new YTEmbed('host', { videoId: 'abc' });
    const pending = player.call('playVideo');
    player.destroy();
    await expect(pending).rejects.toBeInstanceOf(PlayerDestroyedError);
  });

  it('call() returns the underlying YT.Player return value', async () => {
    const ctx = await setupPlayer(yt);
    ctx.fakePlayer.playVideo.mockReturnValue('forwarded-result');
    ctx.fireOnReady();
    const result = await ctx.player.call('playVideo');
    expect(result).toBe('forwarded-result');
  });

  it('generated wrappers (e.g. player.playVideo()) work like call()', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const fakePlayer = { playVideo: vi.fn(), destroy: vi.fn() };
    yt.Player.mockImplementation(() => fakePlayer);
    const player = new YTEmbed('host', { videoId: 'abc' });
    const promise = (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    fireYTReady();
    await Promise.resolve(); // flush microtasks so YT.Player is constructed
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});
    await promise;
    expect(fakePlayer.playVideo).toHaveBeenCalledTimes(1);
  });
});
