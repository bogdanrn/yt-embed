---
"@bogdanrn/yt-embed": patch
---

Tighten cleanup paths and remove duplicated types.

- Fix `awaitState` call path leaking the `statechange` listener when an `AbortSignal` fires before the next state change.
- Fix the caller-supplied `AbortSignal` listener leaking after `YTEmbed.destroy()`.
- `volumeChangeExtension`: parallelise `getVolume` + `isMuted`, add an in-flight guard against re-entrant polling, mark the extension detached so a late tick cannot dispatch on a torn-down player, and `delete` the per-instance method shadows on detach so the prototype wrappers take over again.
- `loadIframeApi`: typed `window` alias replaces ad-hoc casts; on script-load failure, restore the previous `onYouTubeIframeAPIReady` and remove the `<script>` tag.
- Collapse the duplicated `Extension` interface into a single declaration in `extensions/types.ts`.
- Single source of truth for the wrapper-skip list (`SKIPPED_WRAPPERS`) drives both the runtime install loop and the `WrappableName` type.
