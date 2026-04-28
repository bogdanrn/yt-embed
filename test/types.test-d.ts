import { expectTypeOf, test } from 'vitest';
import type { MethodCallOptions, PlayerStateCode, YTEmbed, YTEmbedEventMap } from '../src/index.js';
import { volumeChangeExtension, YouTubeErrorCode } from '../src/index.js';

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

// Regression guard for the v0.2.0 typedef bug (commit 3f3213f). When `YT.Player` was
// substituted with `undefined` by the d.ts bundler, `keyof undefined === never` collapsed
// every wrapper signature to `never`. Pin the public method shapes so a future regression
// fails the type-test suite loudly.
test('WrappedPlayer wrappers are typed, not never', () => {
  expectTypeOf<ReturnType<YTEmbed['getCurrentTime']>>().toEqualTypeOf<Promise<number>>();
  expectTypeOf<ReturnType<YTEmbed['getDuration']>>().toEqualTypeOf<Promise<number>>();
  expectTypeOf<ReturnType<YTEmbed['getVolume']>>().toEqualTypeOf<Promise<number>>();
  expectTypeOf<ReturnType<YTEmbed['isMuted']>>().toEqualTypeOf<Promise<boolean>>();
  expectTypeOf<ReturnType<YTEmbed['getVideoUrl']>>().toEqualTypeOf<Promise<string>>();
  expectTypeOf<ReturnType<YTEmbed['getPlaybackRate']>>().toEqualTypeOf<Promise<number>>();

  // Wrappers must NOT be `never` — that's the regression marker.
  expectTypeOf<YTEmbed['playVideo']>().not.toBeNever();
  expectTypeOf<YTEmbed['setVolume']>().not.toBeNever();

  // The trailing MethodCallOptions argument is supported on every wrapper.
  expectTypeOf<Parameters<YTEmbed['playVideo']>[0]>().toEqualTypeOf<
    MethodCallOptions | undefined
  >();
  expectTypeOf<Parameters<YTEmbed['setVolume']>[0]>().toEqualTypeOf<number>();
});

test('YouTubeErrorCode is an enum-shaped value', () => {
  expectTypeOf(YouTubeErrorCode).toBeObject();
  // Confirm membership at the type level — YouTubeErrorCode is both a value and a type.
  type _members =
    | YouTubeErrorCode.InvalidParam
    | YouTubeErrorCode.Html5Error
    | YouTubeErrorCode.VideoNotFound
    | YouTubeErrorCode.EmbeddingNotAllowed
    | YouTubeErrorCode.EmbeddingNotAllowed2;
  expectTypeOf<_members>().toExtend<number>();
});

test('error event detail carries readable message string', () => {
  expectTypeOf<YTEmbedEventMap['error']['detail']>().toEqualTypeOf<{
    code: number;
    message: string;
  }>();
});
