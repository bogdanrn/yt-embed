import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { volumeChangeExtension } from '../../src/extensions/volumeChange.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

// biome-ignore lint/complexity/noBannedTypes: test-only cast mirroring the YT events record shape.
type YTEventRecord = Record<string, Function>;

describe('volumeChangeExtension: hook path', () => {
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

  it('emits volumechange after our setVolume resolves', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    let volume = 50;
    let muted = false;
    const fakePlayer = {
      setVolume: vi.fn((v: number) => {
        volume = v;
      }),
      mute: vi.fn(() => {
        muted = true;
      }),
      unMute: vi.fn(() => {
        muted = false;
      }),
      getVolume: vi.fn(() => volume),
      isMuted: vi.fn(() => muted),
      destroy: vi.fn(),
    };
    yt.Player.mockImplementation(function MockPlayer() {
      return fakePlayer;
    });

    const player = new YTEmbed('host', {
      videoId: 'abc',
      extensions: [volumeChangeExtension({ intervalMs: 5_000 })],
    });
    const handler = vi.fn();
    player.addEventListener('volumechange', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = (yt.Player.mock.calls[0]?.[1] as { events: YTEventRecord }).events;
    events.onReady?.({});

    await (player as unknown as { setVolume: (v: number) => Promise<void> }).setVolume(80);
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0]?.[0] as CustomEvent<{ volume: number; muted: boolean }>;
    expect(ev.detail).toEqual({ volume: 80, muted: false });
  });
});

describe('volumeChangeExtension: polling lifecycle', () => {
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

  function makePlayer() {
    document.body.innerHTML = '<div id="host"></div>';
    let volume = 50;
    const muted = false;
    const fakePlayer = {
      setVolume: vi.fn((v: number) => {
        volume = v;
      }),
      mute: vi.fn(),
      unMute: vi.fn(),
      getVolume: vi.fn(() => volume),
      isMuted: vi.fn(() => muted),
      destroy: vi.fn(),
    };
    yt.Player.mockImplementation(function MockPlayer() {
      return fakePlayer;
    });
    return {
      fakePlayer,
      setVolumeFromUI: (v: number) => {
        volume = v;
      },
    };
  }

  it('does not poll until first listener subscribes', async () => {
    const ctx = makePlayer();
    new YTEmbed('host', {
      videoId: 'abc',
      extensions: [volumeChangeExtension({ intervalMs: 100 })],
    });
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = (yt.Player.mock.calls[0]?.[1] as { events: YTEventRecord }).events;
    events.onReady?.({});

    vi.advanceTimersByTime(500);
    expect(ctx.fakePlayer.getVolume).not.toHaveBeenCalled();
  });

  it('polling catches in-iframe UI volume changes', async () => {
    const ctx = makePlayer();
    const player = new YTEmbed('host', {
      videoId: 'abc',
      extensions: [volumeChangeExtension({ intervalMs: 100 })],
    });
    const handler = vi.fn();
    player.addEventListener('volumechange', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = (yt.Player.mock.calls[0]?.[1] as { events: YTEventRecord }).events;
    events.onReady?.({});

    await vi.advanceTimersByTimeAsync(150);
    handler.mockClear();
    ctx.setVolumeFromUI(33);
    await vi.advanceTimersByTimeAsync(150);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removing the last listener stops the poll', async () => {
    const ctx = makePlayer();
    const player = new YTEmbed('host', {
      videoId: 'abc',
      extensions: [volumeChangeExtension({ intervalMs: 100 })],
    });
    const handler = vi.fn();
    player.addEventListener('volumechange', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    (yt.Player.mock.calls[0]?.[1] as { events: YTEventRecord }).events.onReady?.({});
    await vi.advanceTimersByTimeAsync(150);

    player.removeEventListener('volumechange', handler);
    ctx.fakePlayer.getVolume.mockClear();
    await vi.advanceTimersByTimeAsync(500);
    expect(ctx.fakePlayer.getVolume).not.toHaveBeenCalled();
  });

  it('does not double-emit when our setVolume hook + poll both fire', async () => {
    const ctx = makePlayer();
    const player = new YTEmbed('host', {
      videoId: 'abc',
      extensions: [volumeChangeExtension({ intervalMs: 100 })],
    });
    const handler = vi.fn();
    player.addEventListener('volumechange', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    (yt.Player.mock.calls[0]?.[1] as { events: YTEventRecord }).events.onReady?.({});

    await (player as unknown as { setVolume: (v: number) => Promise<void> }).setVolume(80);
    await vi.advanceTimersByTimeAsync(300);
    // Hook fired once. Poll re-reads but value is unchanged → cached → no emit.
    expect(handler).toHaveBeenCalledTimes(1);

    // suppress unused variable lint warning
    void ctx;
  });
});
