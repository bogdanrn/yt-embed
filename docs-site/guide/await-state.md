# `awaitState` matrix

Pass `{ awaitState: true }` as the trailing options arg to a wrapper method, and the returned promise only resolves once the player reaches a terminal state for that method:

```ts
await player.playVideo({ awaitState: true });
// Resolves when the player transitions to PLAYING — past BUFFERING, not on it.
```

Without `awaitState`, methods return as soon as the underlying YT call returns synchronously (which is almost immediate but doesn't reflect playback state).

## Method → terminal state map

| Method | Resolves on |
| --- | --- |
| `playVideo` | `PLAYING` |
| `pauseVideo` | `PAUSED` |
| `stopVideo` | `ENDED` or `CUED` |
| `seekTo` | `PLAYING`, `PAUSED`, `CUED`, or `ENDED` (any non-`BUFFERING` final) |
| `loadVideoById` / `loadVideoByUrl` | `PLAYING` |
| `cueVideoById` / `cueVideoByUrl` | `CUED` |
| `loadPlaylist` | `PLAYING` |
| `cuePlaylist` | `CUED` |
| `nextVideo` / `previousVideo` / `playVideoAt` | `PLAYING` |

## Methods without a target state

Methods not listed above (`mute`, `setVolume`, getters, etc.) resolve on the next `statechange` event when `awaitState: true` is passed — there's no canonical terminal state for them, so any state change is treated as the resolution signal.

If you really need to wait for a specific state on an unmapped method, listen for it directly:

```ts
const onState = (e: CustomEvent<{ state: PlayerStateCode }>) => {
  if (e.detail.state === PlayerState.PLAYING) {
    /* … */
  }
};
player.addEventListener('statechange', onState);
```

## Composing with AbortSignal

```ts
await player.playVideo({
  awaitState: true,
  signal: AbortSignal.timeout(5000),
});
```

The promise rejects with `DOMException('Aborted', 'AbortError')` if the signal aborts before the terminal state is reached. See the [cleanup contract](/guide/cleanup) for the full rejection matrix.
