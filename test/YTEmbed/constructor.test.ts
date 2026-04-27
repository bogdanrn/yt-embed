import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';
import { installMockYT } from '../helpers/mockYT.js';

describe('YTEmbed: constructor', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = installMockYT());
    _resetForTests();
  });
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('accepts an HTMLElement target', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const player = new YTEmbed(div, { videoId: 'abc' });
    expect(player).toBeInstanceOf(EventTarget);
    expect(player.destroyed).toBe(false);
  });

  it('accepts a string id target', () => {
    const div = document.createElement('div');
    div.id = 'yt-host';
    document.body.appendChild(div);
    const player = new YTEmbed('yt-host', { videoId: 'abc' });
    expect(player).toBeInstanceOf(EventTarget);
  });

  it('throws TypeError when string id resolves to nothing', () => {
    expect(() => new YTEmbed('does-not-exist', { videoId: 'abc' })).toThrow(TypeError);
  });
});
