import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { YTEmbed } from '../../src/YTEmbed.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { type MockYT, fireYTReady, installMockYT } from '../helpers/mockYT.js';

describe('YTEmbed: events', () => {
  let yt: MockYT;
  let cleanup: () => void;

  beforeEach(() => {
    ({ yt, cleanup } = installMockYT());
    _resetForTests();
    document.body.innerHTML = '<div id="host"></div>';
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  function getEvents(): Record<string, (e: unknown) => void> {
    const args = yt.Player.mock.calls[0]?.[1] as {
      events?: Record<string, (e: unknown) => void>;
    };
    return args?.events ?? {};
  }

  it('re-emits onStateChange as statechange CustomEvent', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const handler = vi.fn();
    player.addEventListener('statechange', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = getEvents();
    events.onReady?.({});
    events.onStateChange?.({ data: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    const ev = handler.mock.calls[0]?.[0] as CustomEvent<{ state: number }>;
    expect(ev.type).toBe('statechange');
    expect(ev.detail.state).toBe(1);
    expect(player.state).toBe(1);
  });

  it('AbortSignal removes the listener', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const handler = vi.fn();
    const ac = new AbortController();
    player.addEventListener('statechange', handler, { signal: ac.signal });
    ac.abort();
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = getEvents();
    events.onReady?.({});
    events.onStateChange?.({ data: 2 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('re-emits onError', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const handler = vi.fn();
    player.addEventListener('error', handler);
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    getEvents().onError?.({ data: 100 });
    const ev = handler.mock.calls[0]?.[0] as CustomEvent<{ code: number; message: string }>;
    expect(ev.detail.code).toBe(100);
  });

  it('subscribes to all event names from eventCallbackNames at runtime', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve(); // flush microtasks so #initialise() constructs YT.Player
    const events = getEvents();
    expect(Object.keys(events)).toEqual(
      expect.arrayContaining(['onReady', 'onStateChange', 'onError', 'onApiChange']),
    );
  });

  it('extension is attached on first listener add and detached on last removal', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const attach = vi.fn(() => () => undefined);
    const detach = vi.fn();
    attach.mockReturnValue(detach);

    const ext = { events: ['fancy'], attach };
    const player = new YTEmbed('host', { videoId: 'abc', extensions: [ext] });
    expect(attach).not.toHaveBeenCalled();

    const handler = () => undefined;
    player.addEventListener('fancy', handler);
    expect(attach).toHaveBeenCalledTimes(1);

    player.removeEventListener('fancy', handler);
    expect(detach).toHaveBeenCalledTimes(1);
  });
});
