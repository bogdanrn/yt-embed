import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';
import { fireYTReady, installMockYT, type MockYT } from '../helpers/mockYT.js';

describe('YTEmbed: constructor', () => {
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

  it('whenReady() rejects with TypeError when string id resolves to nothing', async () => {
    const player = new YTEmbed('does-not-exist', { videoId: 'abc' });
    await expect(player.whenReady()).rejects.toBeInstanceOf(TypeError);
  });

  it('does not throw synchronously in the constructor (SSR-safe boundary)', () => {
    // The constructor must not touch the DOM, so missing targets surface via whenReady().
    expect(() => new YTEmbed('does-not-exist', { videoId: 'abc' })).not.toThrow();
  });

  it('privacyMode: enhanced sets the youtube-nocookie host', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    new YTEmbed('host', { videoId: 'abc', privacyMode: 'enhanced' });
    fireYTReady();
    await Promise.resolve();
    const passedOptions = yt.Player.mock.calls[0]?.[1] as { host?: string };
    expect(passedOptions.host).toBe('https://www.youtube-nocookie.com');
  });

  it('privacyMode: standard (default) does not set host', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve();
    const passedOptions = yt.Player.mock.calls[0]?.[1] as { host?: string };
    expect(passedOptions.host).toBeUndefined();
  });

  it('isolate: true mounts inside a wrapper, leaving the user element untouched', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const userEl = document.getElementById('host')!;
    expect(userEl.children).toHaveLength(0);

    const player = new YTEmbed('host', { videoId: 'abc', isolate: true });
    fireYTReady();
    await Promise.resolve();

    expect(userEl.parentNode).toBe(document.body); // user element still in DOM
    expect(userEl.children.length).toBe(1); // wrapper created inside it
    const wrapper = userEl.firstChild as HTMLElement;

    // YT.Player was called against the wrapper, not the user element.
    expect(yt.Player.mock.calls[0]?.[0]).toBe(wrapper);

    player.destroy();
    expect(userEl.parentNode).toBe(document.body); // still in DOM after destroy
    expect(userEl.children.length).toBe(0); // wrapper removed
  });

  it('isolate: false (default) passes the user element directly to YT.Player', async () => {
    document.body.innerHTML = '<div id="host"></div>';
    const userEl = document.getElementById('host')!;
    new YTEmbed('host', { videoId: 'abc' });
    fireYTReady();
    await Promise.resolve();
    expect(yt.Player.mock.calls[0]?.[0]).toBe(userEl);
  });
});
