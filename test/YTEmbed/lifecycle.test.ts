import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { YTEmbed } from '../../src/YTEmbed.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { type MockYT, fireYTReady, installMockYT } from '../helpers/mockYT.js';

function setup(): { yt: MockYT; cleanup: () => void } {
  const { yt, cleanup } = installMockYT();
  _resetForTests();
  return { yt, cleanup };
}

function captureCtorArgs(yt: MockYT): { events: Record<string, (e: unknown) => void> } {
  const args = yt.Player.mock.calls[0]?.[1] as { events?: Record<string, (e: unknown) => void> };
  return { events: args?.events ?? {} };
}

describe('YTEmbed: whenReady', () => {
  let yt: MockYT;
  let cleanup: () => void;

  beforeEach(() => {
    ({ yt, cleanup } = setup());
    document.body.innerHTML = '<div id="host"></div>';
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('resolves after YT onReady fires', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const ready = player.whenReady();
    fireYTReady();
    // Flush microtasks so #initialise() proceeds past the awaited loadIframeApi().
    await Promise.resolve();
    expect(yt.Player).toHaveBeenCalledTimes(1);
    const { events } = captureCtorArgs(yt);
    events.onReady?.({});
    await expect(ready).resolves.toBeUndefined();
  });

  it('multi-call shares one promise', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const a = player.whenReady();
    const b = player.whenReady();
    expect(a).toBe(b);
    fireYTReady();
    await Promise.resolve();
    captureCtorArgs(yt).events.onReady?.({});
    await Promise.all([a, b]);
  });
});
