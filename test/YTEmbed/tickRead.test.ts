import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

describe('YTEmbed.tickRead', () => {
  let yt: MockYT;
  let cleanup: () => void;

  beforeEach(() => {
    ({ yt, cleanup } = installMockYT());
    _resetForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    document.body.innerHTML = '';
  });

  it('coalesces concurrent reads of the same wrapper method within one tick', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const getCurrentTime = vi.fn().mockResolvedValue(7);
    yt.Player.mockImplementation(function MockPlayer() {
      return {
        destroy: vi.fn(),
        getCurrentTime,
      };
    });
    const player = new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve();
    // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
    const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
    events.onReady?.({});

    // Two subscribers both call tickRead('getCurrentTime') within the same tick.
    // Only one underlying call should run.
    const seen: number[] = [];
    const unsubA = player.tick(async () => {
      seen.push(await player.tickRead<number>('getCurrentTime'));
    }, 250);
    const unsubB = player.tick(async () => {
      seen.push(await player.tickRead<number>('getCurrentTime'));
    }, 250);

    await vi.advanceTimersByTimeAsync(250);
    expect(seen).toEqual([7, 7]);
    expect(getCurrentTime).toHaveBeenCalledTimes(1);

    // Next tick: cache cleared, fresh call.
    await vi.advanceTimersByTimeAsync(250);
    expect(getCurrentTime).toHaveBeenCalledTimes(2);

    unsubA();
    unsubB();
    player.destroy();
  });
});
