import { describe, expect, it } from 'vitest';
import {
  IframeApiLoadError,
  PlayerDestroyedError,
  PlayerInitError,
} from '../src/errors.js';

describe('errors', () => {
  it.each([
    ['IframeApiLoadError', IframeApiLoadError],
    ['PlayerInitError', PlayerInitError],
    ['PlayerDestroyedError', PlayerDestroyedError],
  ] as const)('%s extends Error and preserves name + cause', (name, Ctor) => {
    const cause = new Error('underlying');
    const err = new Ctor('boom', { cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(name);
    expect(err.message).toBe('boom');
    expect(err.cause).toBe(cause);
  });
});
