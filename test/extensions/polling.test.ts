import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bufferProgressExtension,
  cuePointExtension,
  durationChangeExtension,
  scrubBarSyncExtension,
  timeUpdateExtension,
  YTEmbed,
} from '../../src/index.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

interface SetupArgs {
  player?: Record<string, ReturnType<typeof vi.fn>>;
}

async function setup(
  yt: MockYT,
  extension: ReturnType<typeof timeUpdateExtension>,
  args: SetupArgs = {},
): Promise<{ player: YTEmbed; fakePlayer: Record<string, ReturnType<typeof vi.fn>> }> {
  document.body.innerHTML = '<div id="host"></div>';
  const fakePlayer: Record<string, ReturnType<typeof vi.fn>> = {
    destroy: vi.fn(),
    ...args.player,
  };
  yt.Player.mockImplementation(function MockPlayer() {
    return fakePlayer;
  });
  const player = new YTEmbed('host', { videoId: 'abc', extensions: [extension] });
  fireYTReady();
  await Promise.resolve();
  // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
  const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
  events.onReady?.({});
  return { player, fakePlayer };
}

describe('polling extensions', () => {
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

  it('timeUpdateExtension emits when getCurrentTime advances', async () => {
    const getCurrentTime = vi.fn().mockResolvedValue(1.5);
    const { player } = await setup(yt, timeUpdateExtension({ intervalMs: 250 }), {
      player: { getCurrentTime },
    });
    const detail = vi.fn();
    player.addEventListener('timeupdate', (e) => detail(e.detail));
    await vi.advanceTimersByTimeAsync(250);
    expect(detail).toHaveBeenLastCalledWith({ time: 1.5 });
    // No-emit on unchanged value.
    detail.mockClear();
    await vi.advanceTimersByTimeAsync(250);
    expect(detail).not.toHaveBeenCalled();
  });

  it('durationChangeExtension emits when duration changes', async () => {
    const getDuration = vi
      .fn()
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(120);
    const { player } = await setup(yt, durationChangeExtension({ intervalMs: 1000 }), {
      player: { getDuration },
    });
    const detail = vi.fn();
    player.addEventListener('durationchange', (e) => detail(e.detail));
    await vi.advanceTimersByTimeAsync(1000);
    expect(detail).toHaveBeenLastCalledWith({ duration: 60 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(detail).toHaveBeenCalledTimes(1); // unchanged → no second emit
    await vi.advanceTimersByTimeAsync(1000);
    expect(detail).toHaveBeenCalledTimes(2);
    expect(detail).toHaveBeenLastCalledWith({ duration: 120 });
  });

  it('bufferProgressExtension emits on fraction change', async () => {
    const getVideoLoadedFraction = vi.fn().mockResolvedValueOnce(0.1).mockResolvedValueOnce(0.5);
    const { player } = await setup(yt, bufferProgressExtension({ intervalMs: 500 }), {
      player: { getVideoLoadedFraction },
    });
    const detail = vi.fn();
    player.addEventListener('bufferprogress', (e) => detail(e.detail));
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(detail).toHaveBeenCalledTimes(2);
    expect(detail).toHaveBeenLastCalledWith({ fraction: 0.5 });
  });

  it('cuePointExtension fires cues forward-only', async () => {
    let now = 0;
    const getCurrentTime = vi.fn().mockImplementation(() => Promise.resolve(now));
    const { player } = await setup(
      yt,
      cuePointExtension({
        cues: [
          { time: 5, payload: 'a' },
          { time: 10, payload: 'b' },
          { time: 15, payload: 'c' },
        ],
        intervalMs: 250,
      }),
      { player: { getCurrentTime } },
    );
    const fired: unknown[] = [];
    player.addEventListener('cuepoint', (e) => fired.push(e.detail));
    // Initial baseline tick at t=0
    await vi.advanceTimersByTimeAsync(250);
    expect(fired).toHaveLength(0);
    // Advance past cue 'a' (t=5)
    now = 6;
    await vi.advanceTimersByTimeAsync(250);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ time: 5, payload: 'a', index: 0 });
    // Jump past 'b' and 'c'
    now = 16;
    await vi.advanceTimersByTimeAsync(250);
    expect(fired).toHaveLength(3);
    // Seek backward — no re-fire.
    now = 1;
    await vi.advanceTimersByTimeAsync(250);
    expect(fired).toHaveLength(3);
  });

  it('scrubBarSyncExtension emits combined detail', async () => {
    const getCurrentTime = vi.fn().mockResolvedValue(10);
    const getDuration = vi.fn().mockResolvedValue(100);
    const getVideoLoadedFraction = vi.fn().mockResolvedValue(0.4);
    const { player } = await setup(yt, scrubBarSyncExtension({ intervalMs: 250 }), {
      player: { getCurrentTime, getDuration, getVideoLoadedFraction },
    });
    const detail = vi.fn();
    player.addEventListener('scrubsync', (e) => detail(e.detail));
    await vi.advanceTimersByTimeAsync(250);
    expect(detail).toHaveBeenCalledWith({
      currentTime: 10,
      duration: 100,
      buffered: 0.4,
      state: -1, // initial state
    });
    // Idempotent: no new emit on next tick if all values same.
    detail.mockClear();
    await vi.advanceTimersByTimeAsync(250);
    expect(detail).not.toHaveBeenCalled();
  });
});
