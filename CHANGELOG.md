# @bogdanrn/yt-embed

## 0.3.0

### Minor Changes

- 89b372b: 19 extensions, framework adapters, runtime options, docs overhaul.

  ### New runtime options on `YTEmbedOptions`

  - `privacyMode?: 'standard' | 'enhanced'` — `'enhanced'` switches the iframe origin to `youtube-nocookie.com` (no tracking cookies until playback).
  - `isolate?: boolean` — mounts the YT iframe inside a managed wrapper `<div>` so the user-supplied target stays in the DOM after `destroy()`. Adapters set this to `true` by default.
  - `pollingIntervalMs?: number` (default `250`) — base cadence for the shared polling ticker. Polling extensions snap to multiples of this value, so adding ten polling extensions costs one timer.

  ### Constructor + lifecycle

  - The constructor is now SSR-safe: DOM access is deferred to `#initialise()`. `whenReady()` rejects with the new `EnvironmentError` when no `document` is available.
  - Sync `ready: boolean` getter on the player instance, complementing the async `whenReady()`.
  - New `tick(fn, intervalMs?)` and `tickRead<T>(method)` public methods exposing the shared polling ticker. Extensions sharing a tick coalesce reads of `getCurrentTime`/`getDuration`/`getVideoLoadedFraction` — one IPC per method per tick instead of N.

  ### Errors and events

  - `YouTubeErrorCode` enum + `youTubeErrorMessageFor()` helper for the documented YT error codes (2/5/100/101/150). The `error` event detail now carries a readable `message` string instead of `"YT error N"`.
  - `autoplayblocked` is now declared on `YTEmbedEventMap` so consumers can subscribe with strict typing.
  - `playbackratechange` detail gains an optional `optimistic?: boolean` flag (set by `playbackRateOptimisticExtension`).

  ### Breaking: `awaitState` semantics

  `{ awaitState: true }` now resolves on the _matching terminal state_ for the called method (e.g. `playVideo` → `PLAYING`, `pauseVideo` → `PAUSED`, `stopVideo` → `ENDED | CUED`, `seekTo` → any non-`BUFFERING` state). Previously it resolved on the next `statechange` event regardless of state — `playVideo({awaitState:true})` would fire on `BUFFERING` before `PLAYING`. Methods without a defined terminal state (`mute`, `setVolume`, getters) retain the prior "next statechange" behaviour.

  ### 19 extensions (tree-shakable)

  Polling (share a single `setInterval` + tick read cache):

  - `timeUpdateExtension` — `timeupdate`
  - `durationChangeExtension` — `durationchange`
  - `bufferProgressExtension` — `bufferprogress`
  - `cuePointExtension` — `cuepoint`
  - `chapterChangeExtension` — `chapterchange`
  - `abLoopExtension` — `loop`
  - `scrubBarSyncExtension` — `scrubsync`
  - `persistedStateExtension` — auto-save/restore playhead (eager)

  Side-effect (eager-attach):

  - `mediaSessionExtension` — wires `navigator.mediaSession`
  - `errorRetryExtension` — retryable error → `loadVideoById` with backoff
  - `analyticsExtension` — structured event sink (play/pause/seek/quartiles/watch-time-chunk)
  - `autoplayPolicyExtension` — try with sound, fallback to muted
  - `playbackRateOptimisticExtension` — emits `playbackratechange` immediately
  - `seekRangeExtension` — clamp `seekTo` to `[min, max]`
  - `captionsLanguageExtension` — adds `setCaptionsLanguage`
  - `headlessAudioExtension` — hides the iframe for audio-only consumption
  - `fullscreenExtension` — adds `enterFullscreen`/`exitFullscreen`/`toggleFullscreen`
  - `pictureInPictureExtension` — adds the PiP trio (best-effort against cross-origin iframes)

  Lazy:

  - `visibilityChangeExtension` — IntersectionObserver-driven `visibilitychange`, optional auto-pause

  The `Extension` interface gains an optional `eager?: boolean` flag for side-effect extensions.

  ### Framework adapters (sub-exports)

  - `@bogdanrn/yt-embed/react` — `useYTEmbed(videoId, options?)` hook returning `{ containerRef, player, ready, currentTime, duration, isPlaying, state, error }`. Tracks `options` via a ref so inline-literal options do not tear the player down on every parent re-render.
  - `@bogdanrn/yt-embed/vue` — `useYTEmbed(videoId | Ref<string>)` returning Vue refs.
  - `@bogdanrn/yt-embed/svelte` — `createYTEmbed(videoId)` returning Svelte stores plus a `attach` action used as `<div use:attach />`.

  All three auto-include `timeUpdateExtension` + `durationChangeExtension` and default `isolate: true`. React, Vue, and Svelte are declared as optional peer dependencies.

  ### Documentation

  - Switched TypeDoc to `typedoc-plugin-markdown`. The auto-generated reference lives at `docs/api/README.md`.
  - New VitePress site under `docs-site/` with guide pages (quick start, options, extensions, CSP, SSR/Next.js, isolate, awaitState matrix, cleanup contract, multi-player), per-framework adapter pages, and the API reference. The GitHub Pages workflow now publishes the VitePress build.
  - README expanded with an options table, a full extensions catalogue, per-framework adapter snippets, CSP directives, the Next.js SSR pattern, the cleanup-and-rejection contract, and a multi-player example.

  ### Internals (no observable surface change)

  - New `pollAndDispatch` and `wrapInstanceMethod` helpers used internally by polling and method-wrapping extensions. The `wrapInstanceMethod` helper maintains a per-method, per-player stack so multiple extensions can wrap the same method without silent collisions (the prior pattern was last-attach-wins).
  - Extension-added methods (`enterFullscreen`, `setCaptionsLanguage`, …) are now declared as optional members on the canonical `YTEmbed` interface so consumers see them in their IDE without unsafe casts.
  - Two-project vitest configuration (`unit` jsdom, `browser` Playwright/Chromium) for tests that need real browser APIs (fullscreen, PiP, IntersectionObserver, mediaSession).

## 0.2.0

### Minor Changes

- 4d53c88: Generated method wrappers are now fully typed.

  The declaration-merged interface no longer falls back to `(...args: any[]) => Promise<unknown>` for every method. Each wrapper's signature is now derived from the underlying `YT.Player` method via a mapped type, so `player.setVolume(50)` accepts only `number`, `player.getDuration()` returns `Promise<number>`, etc. The optional trailing `MethodCallOptions` argument (`awaitState`, `signal`) remains supported on every wrapper.

  Note: overloaded `YT.Player` methods (e.g. `seekTo`, `loadVideoById`) collapse to their last overload — a known TypeScript limitation when inferring through a generic `Promisify`. Callers needing a non-last overload can use the `call()` escape hatch.

## 0.1.2

### Patch Changes

- 8a96bba: Tighten cleanup paths and remove duplicated types.

  - Fix `awaitState` call path leaking the `statechange` listener when an `AbortSignal` fires before the next state change.
  - Fix the caller-supplied `AbortSignal` listener leaking after `YTEmbed.destroy()`.
  - `volumeChangeExtension`: parallelise `getVolume` + `isMuted`, add an in-flight guard against re-entrant polling, mark the extension detached so a late tick cannot dispatch on a torn-down player, and `delete` the per-instance method shadows on detach so the prototype wrappers take over again.
  - `loadIframeApi`: typed `window` alias replaces ad-hoc casts; on script-load failure, restore the previous `onYouTubeIframeAPIReady` and remove the `<script>` tag.
  - Collapse the duplicated `Extension` interface into a single declaration in `extensions/types.ts`.
  - Single source of truth for the wrapper-skip list (`SKIPPED_WRAPPERS`) drives both the runtime install loop and the `WrappableName` type.

## 0.1.1

### Patch Changes

- 1582e16: ci: verify trusted-publisher flow

## 0.1.0

### Minor Changes

- 5342376: Initial release of `@bogdanrn/yt-embed`: Promise-wrapped YouTube IFrame Player API with `EventTarget` events, lazy extensions, and code-generated method/event surface.

  - `YTEmbed` class extending `EventTarget`, sync constructor, SSR-safe import
  - 1:1 method names from Google's `YT.Player` (autogenerated from `@types/youtube`)
  - DOM-style event names (`statechange`, `playbackqualitychange`, …) via `addEventListener`
  - Per-call `awaitState` and `signal` options; native `AbortSignal.timeout()` composition
  - Built-in `volumeChangeExtension` synthesising `volumechange` (hook + poll, lazy attach)
  - Module-augmentation-friendly: user-authored extensions can extend `YTEmbedEventMap`
  - Strict TypeScript types re-exported from `@types/youtube`
  - Zero runtime dependencies
