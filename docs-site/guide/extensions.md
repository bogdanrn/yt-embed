# Extensions

Extensions add events and side-effects on top of the bare YT.Player surface. Each is a tree-shakable named export — only the ones you `import` end up in your consumer bundle.

```ts
import {
  YTEmbed,
  timeUpdateExtension,
  cuePointExtension,
  mediaSessionExtension,
  persistedStateExtension,
} from '@bogdanrn/yt-embed';

const player = new YTEmbed(el, {
  videoId,
  extensions: [
    timeUpdateExtension({ intervalMs: 250 }),
    cuePointExtension({ cues: [{ time: 30, payload: 'half-way' }] }),
    mediaSessionExtension(),
    persistedStateExtension({ key: `pos:${videoId}` }),
  ],
});
```

## Catalogue

| Extension | Event(s) | Lifecycle |
| --- | --- | --- |
| [`timeUpdateExtension`](/api/) | `timeupdate` | lazy |
| [`durationChangeExtension`](/api/) | `durationchange` | lazy |
| [`bufferProgressExtension`](/api/) | `bufferprogress` | lazy |
| [`volumeChangeExtension`](/api/) | `volumechange` | lazy |
| [`cuePointExtension`](/api/) | `cuepoint` | lazy |
| [`chapterChangeExtension`](/api/) | `chapterchange` | lazy |
| [`abLoopExtension`](/api/) | `loop` | lazy |
| [`scrubBarSyncExtension`](/api/) | `scrubsync` | lazy |
| [`visibilityChangeExtension`](/api/) | `visibilitychange` | lazy |
| [`mediaSessionExtension`](/api/) | `mediasessionupdate` | eager |
| [`persistedStateExtension`](/api/) | — | eager |
| [`errorRetryExtension`](/api/) | `retry` | eager |
| [`analyticsExtension`](/api/) | — (callback sink) | eager |
| [`captionsLanguageExtension`](/api/) | `captionschange` | eager when `defaultLanguage` set |
| [`headlessAudioExtension`](/api/) | — | eager |
| [`autoplayPolicyExtension`](/api/) | `autoplaymuted` | eager |
| [`playbackRateOptimisticExtension`](/api/) | `playbackratechange` (optimistic) | eager |
| [`seekRangeExtension`](/api/) | `seekclamped` | eager |
| [`fullscreenExtension`](/api/) | `fullscreenchange` | eager |
| [`pictureInPictureExtension`](/api/) | `pipchange` | eager |

**Lazy** extensions only attach when the first listener for one of their events is added (and detach when the last leaves). **Eager** extensions activate immediately after `whenReady()` resolves.

## Lifecycle in detail

A lazy extension attaches when `player.addEventListener(eventName, ...)` is called for one of its `events` for the first time. It detaches when the last listener for any of those events is removed (or when the player is destroyed). This is why subscribing to `timeupdate` while never adding a listener costs nothing.

An eager extension is configured with `eager: true` on the `Extension` interface. It attaches once after `onReady` and detaches on destroy. Use eager attach for side-effect extensions like `mediaSessionExtension` (which has no event-driven attach trigger) or method-wrapping extensions like `seekRangeExtension`.

## Shared polling ticker

Polling extensions (timeUpdate, durationChange, bufferProgress, cuePoint, abLoop, scrubBarSync, persistedState) all subscribe to a shared `setInterval` driven by `pollingIntervalMs` (default 250 ms). The shared timer auto-starts on first subscriber and stops when the last leaves.

Each tick also coalesces wrapper reads via a per-tick cache: if `timeUpdateExtension`, `cuePointExtension`, and `abLoopExtension` are all active, they share one `getCurrentTime()` call per tick, not three.

## Method-wrapping extensions

`autoplayPolicyExtension`, `playbackRateOptimisticExtension`, `seekRangeExtension`, and `volumeChangeExtension` wrap instance methods on the player using a shared helper that maintains a per-method stack. Multiple extensions can wrap the same method without clobbering each other; detach unwinds the stack.

## See also

- [`isolate` and host replacement](/guide/isolate) — why adapters default to `isolate: true`.
- [Cleanup contract](/guide/cleanup) — how detach interacts with `destroy()` and `AbortSignal`.
