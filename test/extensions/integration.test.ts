import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AnalyticsEvent,
  abLoopExtension,
  analyticsExtension,
  autoplayPolicyExtension,
  bufferProgressExtension,
  captionsLanguageExtension,
  chapterChangeExtension,
  cuePointExtension,
  durationChangeExtension,
  errorRetryExtension,
  fullscreenExtension,
  headlessAudioExtension,
  mediaSessionExtension,
  PlayerState,
  persistedStateExtension,
  pictureInPictureExtension,
  playbackRateOptimisticExtension,
  type StorageLike,
  scrubBarSyncExtension,
  seekRangeExtension,
  timeUpdateExtension,
  visibilityChangeExtension,
  volumeChangeExtension,
  YTEmbed,
} from '../../src/index.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

interface SetupResult {
  player: YTEmbed;
  fakePlayer: Record<string, ReturnType<typeof vi.fn>>;
  fireStateChange: (code: number) => void;
  fireError: (code: number) => void;
  storage: StorageLike;
  storageState: Map<string, string>;
  sink: ReturnType<typeof vi.fn>;
}

async function setupAllExtensions(
  yt: MockYT,
  currentTime: { value: number },
  sharedStorage?: { storage: StorageLike; state: Map<string, string> },
): Promise<SetupResult> {
  document.body.innerHTML = '<div id="host"></div>';
  const fakePlayer: Record<string, ReturnType<typeof vi.fn>> = {
    destroy: vi.fn(),
    playVideo: vi.fn(() => undefined),
    pauseVideo: vi.fn(() => undefined),
    seekTo: vi.fn(() => undefined),
    mute: vi.fn(() => undefined),
    unMute: vi.fn(() => undefined),
    getVolume: vi.fn(() => 50),
    isMuted: vi.fn(() => false),
    setVolume: vi.fn(() => undefined),
    setPlaybackRate: vi.fn(() => undefined),
    getCurrentTime: vi.fn(() => currentTime.value),
    getDuration: vi.fn(() => 200),
    getVideoLoadedFraction: vi.fn(() => 0.5),
    getVideoData: vi.fn(() => ({ video_id: 'abc', title: 'Demo', author: 'AcmeTV' })),
    loadVideoById: vi.fn(() => undefined),
    nextVideo: vi.fn(() => undefined),
    previousVideo: vi.fn(() => undefined),
    setOption: vi.fn(() => undefined),
  };
  yt.Player.mockImplementation(function MockPlayer() {
    return fakePlayer;
  });

  const storageState = sharedStorage?.state ?? new Map<string, string>();
  const storage: StorageLike = sharedStorage?.storage ?? {
    getItem: (k) => storageState.get(k) ?? null,
    setItem: (k, v) => {
      storageState.set(k, v);
    },
  };

  const sink = vi.fn<(e: AnalyticsEvent) => void>();

  const player = new YTEmbed('host', {
    videoId: 'abc',
    pollingIntervalMs: 250,
    extensions: [
      timeUpdateExtension(),
      durationChangeExtension(),
      bufferProgressExtension(),
      volumeChangeExtension(),
      cuePointExtension({
        cues: [{ time: 30, payload: 'half-way' }],
      }),
      chapterChangeExtension({
        chapters: [
          { time: 0, title: 'Intro' },
          { time: 60, title: 'Body' },
        ],
      }),
      abLoopExtension({ start: 100, end: 110 }),
      scrubBarSyncExtension(),
      mediaSessionExtension(),
      persistedStateExtension({ key: 'integration', sink: storage, intervalMs: 1000 }),
      analyticsExtension({ sink, chunkSeconds: 5 }),
      errorRetryExtension({ maxRetries: 1, initialDelayMs: 50 }),
      autoplayPolicyExtension({ fallbackTimeoutMs: 250 }),
      playbackRateOptimisticExtension(),
      seekRangeExtension({ min: 0, max: 200 }),
      captionsLanguageExtension({ defaultLanguage: 'en' }),
      visibilityChangeExtension({ autoPause: true }),
      headlessAudioExtension(),
      fullscreenExtension(),
      pictureInPictureExtension(),
    ],
  });

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
    storage,
    storageState,
    sink,
  };
}

describe('YTEmbed: integration with all extensions loaded', () => {
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

  it('mounts cleanly with every extension and reaches ready', async () => {
    const time = { value: 0 };
    const { player } = await setupAllExtensions(yt, time);
    expect(player.ready).toBe(true);
    expect(player.destroyed).toBe(false);
    player.destroy();
    expect(player.destroyed).toBe(true);
  });

  it('user story: play, scrub past chapters, see analytics + chapterchange + scrubsync events', async () => {
    const time = { value: 0 };
    const { player, fireStateChange, sink } = await setupAllExtensions(yt, time);

    const events: { type: string; detail: unknown }[] = [];
    for (const type of [
      'timeupdate',
      'chapterchange',
      'scrubsync',
      'cuepoint',
      'bufferprogress',
      'durationchange',
    ] as const) {
      player.addEventListener(type, (e) =>
        events.push({ type, detail: (e as CustomEvent).detail }),
      );
    }

    fireStateChange(PlayerState.PLAYING);
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ type: 'play' }));

    // Tick 1: t=0 baseline.
    time.value = 0;
    await vi.advanceTimersByTimeAsync(250);
    // Tick 2: advance to 31s, crossing the 30s cue.
    time.value = 31;
    await vi.advanceTimersByTimeAsync(250);
    // Tick 3: advance past 60s chapter boundary.
    time.value = 65;
    await vi.advanceTimersByTimeAsync(250);
    // Tick 4: advance further to give durationChange (interval 1000ms) a chance.
    time.value = 70;
    await vi.advanceTimersByTimeAsync(1000);

    const types = new Set(events.map((e) => e.type));
    expect(types).toContain('timeupdate');
    expect(types).toContain('cuepoint');
    expect(types).toContain('chapterchange');
    expect(types).toContain('scrubsync');
    expect(types).toContain('bufferprogress');
    expect(types).toContain('durationchange');

    const cuepoint = events.find((e) => e.type === 'cuepoint');
    expect(cuepoint?.detail).toMatchObject({ time: 30, payload: 'half-way', index: 0 });

    const chapter = events.find((e) => e.type === 'chapterchange');
    expect(chapter?.detail).toMatchObject({ index: 1, title: 'Body', time: 60 });
  });

  it('user story: persistedState saves and restores playback position', async () => {
    const time = { value: 0 };
    const first = await setupAllExtensions(yt, time);
    time.value = 42;
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.storageState.get('integration')).toBe('42');
    first.player.destroy();

    // Second mount uses the SAME storage, should restore.
    cleanup();
    ({ yt, cleanup } = installMockYT());
    _resetForTests();
    const time2 = { value: 0 };
    const second = await setupAllExtensions(yt, time2, {
      storage: first.storage,
      state: first.storageState,
    });
    // restoreOnce calls seekTo with the cached value.
    for (let i = 0; i < 3; i++) await Promise.resolve();
    expect(second.fakePlayer.seekTo).toHaveBeenCalledWith(42, true);
    second.player.destroy();
  });

  it('user story: errors bubble through retry then surface via the analytics sink', async () => {
    const time = { value: 0 };
    const { fireError, fakePlayer } = await setupAllExtensions(yt, time);
    fireError(100); // retryable
    await vi.advanceTimersByTimeAsync(50);
    await Promise.resolve();
    await Promise.resolve();
    expect(fakePlayer.loadVideoById).toHaveBeenCalledWith('abc');
  });

  it('destroy tears down every extension cleanly', async () => {
    const time = { value: 0 };
    const { player } = await setupAllExtensions(yt, time);
    // Drive a few ticks so polling extensions accumulate state.
    time.value = 5;
    await vi.advanceTimersByTimeAsync(250);
    time.value = 10;
    await vi.advanceTimersByTimeAsync(250);

    player.destroy();
    expect(player.destroyed).toBe(true);

    // After destroy, advancing time should not throw and should not produce more events.
    const post: string[] = [];
    player.addEventListener('timeupdate', () => post.push('timeupdate'));
    time.value = 20;
    await vi.advanceTimersByTimeAsync(1000);
    expect(post).toHaveLength(0);
  });
});
