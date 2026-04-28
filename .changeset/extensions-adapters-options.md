---
"@bogdanrn/yt-embed": minor
---

19 extensions, framework adapters, runtime options, docs overhaul.

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

`{ awaitState: true }` now resolves on the *matching terminal state* for the called method (e.g. `playVideo` → `PLAYING`, `pauseVideo` → `PAUSED`, `stopVideo` → `ENDED | CUED`, `seekTo` → any non-`BUFFERING` state). Previously it resolved on the next `statechange` event regardless of state — `playVideo({awaitState:true})` would fire on `BUFFERING` before `PLAYING`. Methods without a defined terminal state (`mute`, `setVolume`, getters) retain the prior "next statechange" behaviour.

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
