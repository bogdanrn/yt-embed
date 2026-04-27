import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installMockYT, fireYTReady } from './helpers/mockYT.js';
import { loadIframeApi, _resetForTests } from '../src/loadIframeApi.js';

describe('loadIframeApi: single script injection', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = installMockYT());
    _resetForTests();
  });

  afterEach(() => {
    cleanup();
  });

  it('injects exactly one <script> across N concurrent calls', async () => {
    const p1 = loadIframeApi();
    const p2 = loadIframeApi();
    const p3 = loadIframeApi();
    fireYTReady();
    await Promise.all([p1, p2, p3]);
    const scripts = document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]');
    expect(scripts).toHaveLength(1);
  });

  it('resolves with window.YT', async () => {
    const promise = loadIframeApi();
    fireYTReady();
    const yt = await promise;
    expect(yt).toBeDefined();
    expect(yt.Player).toBeDefined();
  });

  it('caches across calls (same promise)', async () => {
    const p1 = loadIframeApi();
    const p2 = loadIframeApi();
    expect(p1).toBe(p2);
    fireYTReady();
    await p1;
  });
});

describe('loadIframeApi: chaining', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = installMockYT());
    _resetForTests();
  });
  afterEach(() => cleanup());

  it('calls the pre-existing onYouTubeIframeAPIReady before resolving', async () => {
    const order: string[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: jsdom global.
    (window as any).onYouTubeIframeAPIReady = () => order.push('previous');
    const promise = loadIframeApi();
    fireYTReady();
    await promise;
    order.push('after-resolve');
    expect(order).toEqual(['previous', 'after-resolve']);
  });
});

describe('loadIframeApi: script error', () => {
  let cleanup: () => void;

  beforeEach(() => {
    ({ cleanup } = installMockYT());
    _resetForTests();
  });
  afterEach(() => cleanup());

  it('rejects with IframeApiLoadError on script error event', async () => {
    const promise = loadIframeApi();
    const script = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    ) as HTMLScriptElement;
    script.dispatchEvent(new Event('error'));
    await expect(promise).rejects.toMatchObject({
      name: 'IframeApiLoadError',
      message: /Failed to load/,
    });
  });

  it('allows retry after a failed load', async () => {
    const first = loadIframeApi().catch(() => 'rejected');
    const script1 = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    ) as HTMLScriptElement;
    script1.dispatchEvent(new Event('error'));
    expect(await first).toBe('rejected');

    const second = loadIframeApi();
    fireYTReady();
    await expect(second).resolves.toBeDefined();
  });
});
