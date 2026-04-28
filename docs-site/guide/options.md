# Options reference

`YTEmbedOptions` is the second argument to the `YTEmbed` constructor.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `videoId` | `string` | — | Initial video. Required for autoplay. |
| `playerVars` | `YT.PlayerVars` | — | Forwarded to the YT IFrame API. |
| `width` / `height` | `number` | — | Iframe dimensions. |
| `extensions` | `Extension[]` | `[]` | Extensions to attach. See [extensions guide](/guide/extensions). |
| `signal` | `AbortSignal` | — | Aborting calls `destroy()`; in-flight wrapper calls reject with `AbortError`. |
| `initTimeoutMs` | `number` | `30000` | Reject `whenReady()` after this duration with `PlayerInitError`. |
| `pollingIntervalMs` | `number` | `250` | Base cadence for the shared polling ticker. Polling extensions snap to multiples of this value. |
| `privacyMode` | `'standard' \| 'enhanced'` | `'standard'` | `'enhanced'` switches the iframe origin to `youtube-nocookie.com` (no tracking cookies until playback). |
| `isolate` | `boolean` | `false` | When `true`, mounts the YT iframe inside a managed wrapper `<div>` so the user-supplied target stays in the DOM after `destroy()`. The framework adapters set this to `true` by default. |

## `pollingIntervalMs`

The shared ticker drives every polling extension (`timeUpdateExtension`, `cuePointExtension`, `abLoopExtension`, `persistedStateExtension`, `scrubBarSyncExtension`, `bufferProgressExtension`, `durationChangeExtension`). One `setInterval` runs across all of them, and reads of `getCurrentTime`/`getDuration`/`getVideoLoadedFraction` are coalesced per tick so adding ten polling extensions costs one timer and one IPC per method.

## `privacyMode`

When `privacyMode: 'enhanced'`, the iframe origin becomes `https://www.youtube-nocookie.com`. YouTube serves the embed without setting tracking cookies until playback starts, which is the GDPR-friendly default for many integrations.

If you set `privacyMode: 'enhanced'`, you can omit `https://www.youtube.com` from your CSP `frame-src` directive — see the [CSP guide](/guide/csp).

## `isolate`

By default, the YouTube IFrame API replaces the target node with the iframe. That's surprising for component-based UIs that hold a ref to the original element. Set `isolate: true` and YTEmbed wraps the YT iframe in a managed `<div>` appended to your target — the original stays in place across destroy and recreate.

The React, Vue, and Svelte adapters all set `isolate: true` by default.
