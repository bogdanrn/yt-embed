import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentError } from '../../src/errors.js';
import { _resetForTests } from '../../src/loadIframeApi.js';
import { YTEmbed } from '../../src/YTEmbed.js';

describe('YTEmbed: SSR safety', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetForTests();
  });

  it('constructor does not touch document', () => {
    // Simulate Node-like environment where `document` does not exist at construction time.
    // The constructor must not throw — DOM access is deferred to #initialise().
    vi.stubGlobal('document', undefined);
    expect(() => new YTEmbed('host', { videoId: 'abc' })).not.toThrow();
  });

  it('whenReady() rejects with EnvironmentError when document is unavailable', async () => {
    vi.stubGlobal('document', undefined);
    const player = new YTEmbed('host', { videoId: 'abc' });
    await expect(player.whenReady()).rejects.toBeInstanceOf(EnvironmentError);
  });
});
