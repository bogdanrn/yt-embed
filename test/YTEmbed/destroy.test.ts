import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { YTEmbed } from '../../src/YTEmbed.js';
import { PlayerDestroyedError } from '../../src/errors.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { installMockYT } from '../helpers/mockYT.js';

describe('YTEmbed: destroy', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = installMockYT());
    _resetForTests();
    document.body.innerHTML = '<div id="host"></div>';
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('is idempotent — calling twice does not throw', () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    expect(() => {
      player.destroy();
      player.destroy();
    }).not.toThrow();
    expect(player.destroyed).toBe(true);
  });

  it('rejects pending whenReady() with PlayerDestroyedError', async () => {
    const player = new YTEmbed('host', { videoId: 'abc' });
    const ready = player.whenReady();
    player.destroy();
    await expect(ready).rejects.toBeInstanceOf(PlayerDestroyedError);
  });

  it('aborting the constructor signal triggers destroy', () => {
    const ac = new AbortController();
    const player = new YTEmbed('host', { videoId: 'abc', signal: ac.signal });
    expect(player.destroyed).toBe(false);
    ac.abort();
    expect(player.destroyed).toBe(true);
  });

  it('an already-aborted signal at construct time → destroyed immediately', () => {
    const ac = new AbortController();
    ac.abort();
    const player = new YTEmbed('host', { videoId: 'abc', signal: ac.signal });
    expect(player.destroyed).toBe(true);
  });

  it('StrictMode-style double mount + double destroy leaves no leaked iframes', () => {
    document.body.innerHTML = '<div id="host"></div>';
    const a = new YTEmbed('host', { videoId: 'abc' });
    const b = new YTEmbed('host', { videoId: 'abc' });
    a.destroy();
    b.destroy();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);
  });
});
