import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrapInstanceMethod } from '../../src/extensions/_wrapInstanceMethod.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

describe('wrapInstanceMethod', () => {
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

  it('composes multiple wrappers and unwinds LIFO back to the prototype', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const playVideo = vi.fn(() => 'orig');
    yt.Player.mockImplementation(function MockPlayer() {
      return { destroy: vi.fn(), playVideo };
    });
    const player = new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve();
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});

    const calls: string[] = [];
    const restoreA = wrapInstanceMethod<() => Promise<unknown>>(
      player,
      'playVideo',
      (previous) => async () => {
        calls.push('A-before');
        const r = await previous();
        calls.push('A-after');
        return r;
      },
    );
    const restoreB = wrapInstanceMethod<() => Promise<unknown>>(
      player,
      'playVideo',
      (previous) => async () => {
        calls.push('B-before');
        const r = await previous();
        calls.push('B-after');
        return r;
      },
    );

    // B is most recent, so its before/after wrap A's, which wrap orig.
    await (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    expect(calls).toEqual(['B-before', 'A-before', 'A-after', 'B-after']);
    expect(playVideo).toHaveBeenCalledTimes(1);

    // Detach in LIFO order: B first, then A.
    calls.length = 0;
    restoreB();
    await (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    expect(calls).toEqual(['A-before', 'A-after']);

    calls.length = 0;
    restoreA();
    await (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    expect(calls).toEqual([]);
    expect(playVideo).toHaveBeenCalledTimes(3);

    player.destroy();
  });

  it('still calls all wrappers when detached out of order (LIFO is preferred but non-LIFO is safe)', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const playVideo = vi.fn(() => 'orig');
    yt.Player.mockImplementation(function MockPlayer() {
      return { destroy: vi.fn(), playVideo };
    });
    const player = new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve();
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});

    const calls: string[] = [];
    const restoreA = wrapInstanceMethod<() => Promise<unknown>>(
      player,
      'playVideo',
      (previous) => async () => {
        calls.push('A');
        return previous();
      },
    );
    const restoreB = wrapInstanceMethod<() => Promise<unknown>>(
      player,
      'playVideo',
      (previous) => async () => {
        calls.push('B');
        return previous();
      },
    );

    // Detach A out of order. B is still on top of the stack; it still calls
    // A's closure (which is harmless — just an extra hop). The stack just
    // updates to [B] so the eventual full unwind still restores the prototype.
    restoreA();
    await (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    expect(calls).toEqual(['B', 'A']); // B's closed-over `previous` is still A
    expect(playVideo).toHaveBeenCalledTimes(1);

    restoreB();
    calls.length = 0;
    await (player as unknown as { playVideo: () => Promise<unknown> }).playVideo();
    expect(calls).toEqual([]);
    expect(playVideo).toHaveBeenCalledTimes(2);

    player.destroy();
  });
});
