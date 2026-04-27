import { expectTypeOf, test } from 'vitest';
import type { MethodCallOptions, PlayerStateCode, YTEmbed, YTEmbedEventMap } from '../src/index.js';
import { volumeChangeExtension } from '../src/index.js';

test('statechange event detail is typed', () => {
  expectTypeOf<YTEmbedEventMap['statechange']['detail']>().toEqualTypeOf<{
    state: PlayerStateCode;
  }>();
});

test('volumechange is added to YTEmbedEventMap by importing volumeChangeExtension', () => {
  // Importing volumeChangeExtension at the top causes its module-augmentation
  // block to apply. Reference it once so tree-shaking does not drop the
  // import in type-only mode.
  void volumeChangeExtension;

  expectTypeOf<YTEmbedEventMap['volumechange']['detail']>().toEqualTypeOf<{
    volume: number;
    muted: boolean;
  }>();
});

test('MethodCallOptions accepts awaitState and signal', () => {
  const opts: MethodCallOptions = {
    awaitState: true,
    signal: new AbortController().signal,
  };
  void opts;
});

test('addEventListener typed via YTEmbedEventMap', () => {
  const player = {} as YTEmbed;
  player.addEventListener('statechange', (e) => {
    expectTypeOf(e.detail.state).toEqualTypeOf<PlayerStateCode>();
  });
});
