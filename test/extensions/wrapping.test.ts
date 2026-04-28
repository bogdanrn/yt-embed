import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  abLoopExtension,
  captionsLanguageExtension,
  chapterChangeExtension,
  errorRetryExtension,
  persistedStateExtension,
  playbackRateOptimisticExtension,
  type StorageLike,
  seekRangeExtension,
  YTEmbed,
} from '../../src/index.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

interface SetupArgs {
  player?: Record<string, ReturnType<typeof vi.fn>>;
  extensions: ReturnType<typeof abLoopExtension>[];
}

async function setup(
  yt: MockYT,
  args: SetupArgs,
): Promise<{
  player: YTEmbed;
  fakePlayer: Record<string, ReturnType<typeof vi.fn>>;
  fireStateChange: (code: number) => void;
  fireError: (code: number) => void;
}> {
  document.body.innerHTML = '<div id="host"></div>';
  const fakePlayer: Record<string, ReturnType<typeof vi.fn>> = {
    destroy: vi.fn(),
    ...args.player,
  };
  yt.Player.mockImplementation(function MockPlayer() {
    return fakePlayer;
  });
  const player = new YTEmbed('host', { videoId: 'abc', extensions: args.extensions });
  fireYTReady();
  await Promise.resolve();
  // biome-ignore lint/suspicious/noExplicitAny: accessing mock internals.
  const events = (yt.Player.mock.calls[0]?.[1] as { events: Record<string, any> }).events;
  events.onReady?.({});
  return {
    player,
    fakePlayer,
    fireStateChange: (code) => events.onStateChange?.({ data: code }),
    fireError: (code) => events.onError?.({ data: code }),
  };
}

describe('extension behaviors', () => {
  let yt: MockYT;
  let cleanup: () => void;

  beforeEach(() => {
    ({ yt, cleanup } = installMockYT());
    _resetForTests();
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('abLoopExtension seeks back to start when end is crossed', async () => {
    vi.useFakeTimers();
    let now = 0;
    const getCurrentTime = vi.fn().mockImplementation(() => Promise.resolve(now));
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const { player } = await setup(yt, {
      extensions: [abLoopExtension({ start: 5, end: 10, intervalMs: 250 })],
      player: { getCurrentTime, seekTo },
    });
    const fired = vi.fn();
    player.addEventListener('loop', (e) => fired(e.detail));
    now = 11;
    await vi.advanceTimersByTimeAsync(250);
    await Promise.resolve();
    await Promise.resolve();
    expect(seekTo).toHaveBeenCalledWith(5, true);
    expect(fired).toHaveBeenCalledWith({ start: 5, end: 10 });
  });

  it('chapterChangeExtension re-emits cue events with chapter detail', async () => {
    vi.useFakeTimers();
    let now = 0;
    const getCurrentTime = vi.fn().mockImplementation(() => Promise.resolve(now));
    const { player } = await setup(yt, {
      extensions: [
        chapterChangeExtension({
          chapters: [
            { time: 0, title: 'Intro' },
            { time: 30, title: 'Body' },
          ],
          intervalMs: 250,
        }),
      ],
      player: { getCurrentTime },
    });
    const fired = vi.fn();
    player.addEventListener('chapterchange', (e) => fired(e.detail));
    await vi.advanceTimersByTimeAsync(250);
    now = 31;
    await vi.advanceTimersByTimeAsync(250);
    expect(fired).toHaveBeenCalledTimes(1);
    expect(fired).toHaveBeenCalledWith({ index: 1, title: 'Body', time: 30 });
  });

  it('persistedStateExtension restores currentTime from storage on attach', async () => {
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const getCurrentTime = vi.fn().mockResolvedValue(0);
    const sink: StorageLike = {
      getItem: vi.fn().mockReturnValue('42'),
      setItem: vi.fn(),
    };
    await setup(yt, {
      extensions: [persistedStateExtension({ key: 'pos', sink, intervalMs: 5000 })],
      player: { seekTo, getCurrentTime },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(seekTo).toHaveBeenCalledWith(42, true);
  });

  it('persistedStateExtension saves on tick and again on detach', async () => {
    vi.useFakeTimers();
    const setItem = vi.fn();
    const sink: StorageLike = { getItem: vi.fn().mockReturnValue(null), setItem };
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const getCurrentTime = vi.fn().mockResolvedValue(99);
    const { player } = await setup(yt, {
      extensions: [persistedStateExtension({ key: 'pos', sink, intervalMs: 5000 })],
      player: { getCurrentTime, seekTo },
    });
    // Advance ticker so an in-flight save fires and updates lastKnownTime.
    await vi.advanceTimersByTimeAsync(5000);
    expect(setItem).toHaveBeenCalledWith('pos', '99');
    setItem.mockClear();
    player.destroy();
    // Synchronous final save uses cached lastKnownTime.
    expect(setItem).toHaveBeenCalledWith('pos', '99');
  });

  it('seekRangeExtension clamps seekTo and emits seekclamped when adjusted', async () => {
    const seekTo = vi.fn().mockResolvedValue(undefined);
    const { player } = await setup(yt, {
      extensions: [seekRangeExtension({ min: 10, max: 60 })],
      player: { seekTo },
    });
    const clamped = vi.fn();
    player.addEventListener('seekclamped', (e) => clamped(e.detail));
    // Below min — clamp up.
    await (player as unknown as { seekTo: (t: number, a: boolean) => Promise<void> }).seekTo(
      5,
      true,
    );
    expect(seekTo).toHaveBeenLastCalledWith(10, true);
    expect(clamped).toHaveBeenLastCalledWith({ requested: 5, clamped: 10 });
    // Inside range — no event.
    clamped.mockClear();
    await (player as unknown as { seekTo: (t: number, a: boolean) => Promise<void> }).seekTo(
      30,
      true,
    );
    expect(seekTo).toHaveBeenLastCalledWith(30, true);
    expect(clamped).not.toHaveBeenCalled();
  });

  it('playbackRateOptimisticExtension emits playbackratechange immediately', async () => {
    const setPlaybackRate = vi.fn().mockResolvedValue(undefined);
    const { player } = await setup(yt, {
      extensions: [playbackRateOptimisticExtension()],
      player: { setPlaybackRate },
    });
    const fired = vi.fn();
    player.addEventListener('playbackratechange', (e) => fired(e.detail));
    await (
      player as unknown as { setPlaybackRate: (rate: number) => Promise<void> }
    ).setPlaybackRate(1.5);
    expect(fired).toHaveBeenCalledWith({ rate: 1.5, optimistic: true });
  });

  it('captionsLanguageExtension exposes setCaptionsLanguage and dispatches captionschange', async () => {
    const { player } = await setup(yt, {
      extensions: [captionsLanguageExtension()],
    });
    const captionsFired = vi.fn();
    player.addEventListener('captionschange', (e) => captionsFired(e.detail));
    expect(typeof player.setCaptionsLanguage).toBe('function');
    await player.setCaptionsLanguage?.('es');
    await Promise.resolve();
    expect(captionsFired).toHaveBeenCalledWith({ languageCode: 'es' });
  });

  it('errorRetryExtension reloads the video after a retryable error', async () => {
    vi.useFakeTimers();
    const getVideoData = vi.fn().mockResolvedValue({ video_id: 'abc' });
    const loadVideoById = vi.fn().mockResolvedValue(undefined);
    const { player, fireError } = await setup(yt, {
      extensions: [errorRetryExtension({ maxRetries: 1, initialDelayMs: 100 })],
      player: { getVideoData, loadVideoById },
    });
    const retryFired = vi.fn();
    player.addEventListener('retry', (e) => retryFired(e.detail));
    fireError(100);
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await Promise.resolve();
    expect(retryFired).toHaveBeenCalledWith({ attempt: 1, code: 100, delayMs: 100 });
    expect(loadVideoById).toHaveBeenCalledWith('abc');
  });
});
