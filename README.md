# @bogdanrn/yt-embed

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/bogdanrn/yt-embed?utm_source=oss&utm_medium=github&utm_campaign=bogdanrn%2Fyt-embed&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

Promise-wrapped YouTube IFrame Player API. TypeScript-first, dependency-free, `EventTarget`-based.

## Install

```bash
pnpm add @bogdanrn/yt-embed
```

## Quick start

```ts
import { YTEmbed } from '@bogdanrn/yt-embed';

const player = new YTEmbed(document.getElementById('host')!, {
  videoId: 'M7lc1UVf-VE',
});

await player.whenReady();
await player.playVideo();
```

## Cancellation and timeouts

```ts
// User-controlled timeout via AbortSignal
await player.playVideo({
  awaitState: true,
  signal: AbortSignal.timeout(3000),
});
// Throws on abort.

// User-controlled abort + a timeout, composed
const ac = new AbortController();
await player.seekTo(120, true, {
  awaitState: true,
  signal: AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]),
});
```

## Methods

<!-- methods:start -->
# Methods

All methods return `Promise`. They auto-queue until the player is ready.

| Method | Source |
| --- | --- |
| `addEventListener` | YT.Player.addEventListener |
| `cuePlaylist` | YT.Player.cuePlaylist |
| `cueVideoById` | YT.Player.cueVideoById |
| `cueVideoByUrl` | YT.Player.cueVideoByUrl |
| `destroy` | YT.Player.destroy |
| `getAvailablePlaybackRates` | YT.Player.getAvailablePlaybackRates |
| `getAvailableQualityLevels` | YT.Player.getAvailableQualityLevels |
| `getCurrentTime` | YT.Player.getCurrentTime |
| `getDuration` | YT.Player.getDuration |
| `getIframe` | YT.Player.getIframe |
| `getPlaybackQuality` | YT.Player.getPlaybackQuality |
| `getPlaybackRate` | YT.Player.getPlaybackRate |
| `getPlayerState` | YT.Player.getPlayerState |
| `getPlaylist` | YT.Player.getPlaylist |
| `getPlaylistIndex` | YT.Player.getPlaylistIndex |
| `getSphericalProperties` | YT.Player.getSphericalProperties |
| `getVideoData` | YT.Player.getVideoData |
| `getVideoEmbedCode` | YT.Player.getVideoEmbedCode |
| `getVideoLoadedFraction` | YT.Player.getVideoLoadedFraction |
| `getVideoUrl` | YT.Player.getVideoUrl |
| `getVolume` | YT.Player.getVolume |
| `isMuted` | YT.Player.isMuted |
| `loadPlaylist` | YT.Player.loadPlaylist |
| `loadVideoById` | YT.Player.loadVideoById |
| `loadVideoByUrl` | YT.Player.loadVideoByUrl |
| `mute` | YT.Player.mute |
| `nextVideo` | YT.Player.nextVideo |
| `pauseVideo` | YT.Player.pauseVideo |
| `playVideo` | YT.Player.playVideo |
| `playVideoAt` | YT.Player.playVideoAt |
| `previousVideo` | YT.Player.previousVideo |
| `removeEventListener` | YT.Player.removeEventListener |
| `seekTo` | YT.Player.seekTo |
| `setLoop` | YT.Player.setLoop |
| `setPlaybackQuality` | YT.Player.setPlaybackQuality |
| `setPlaybackRate` | YT.Player.setPlaybackRate |
| `setShuffle` | YT.Player.setShuffle |
| `setSize` | YT.Player.setSize |
| `setSphericalProperties` | YT.Player.setSphericalProperties |
| `setVolume` | YT.Player.setVolume |
| `stopVideo` | YT.Player.stopVideo |
| `unMute` | YT.Player.unMute |
<!-- methods:end -->

## Events

Subscribe via the standard `addEventListener` API. Listeners support `AbortSignal` for clean removal.

```ts
const ac = new AbortController();
player.addEventListener('statechange', (e) => {
  console.log('state:', e.detail.state);
}, { signal: ac.signal });
ac.abort(); // listener removed
```

<!-- events:start -->
# Events

Subscribe via `player.addEventListener(name, handler)`. Names are derived from `YT.Events` callbacks: strip the `on` prefix and lowercase the rest.

| Event name | YT callback |
| --- | --- |
| `apichange` | `onApiChange` |
| `autoplayblocked` | `onAutoplayBlocked` |
| `error` | `onError` |
| `playbackqualitychange` | `onPlaybackQualityChange` |
| `playbackratechange` | `onPlaybackRateChange` |
| `ready` | `onReady` |
| `statechange` | `onStateChange` |
<!-- events:end -->

## Extensions

Extensions add events on top of Google's API. They attach lazily — costs nothing until you subscribe.

```ts
import { YTEmbed, volumeChangeExtension } from '@bogdanrn/yt-embed';

const player = new YTEmbed(el, {
  videoId,
  extensions: [volumeChangeExtension({ interval: 250 })],
});

player.addEventListener('volumechange', (e) => {
  console.log(e.detail.volume, e.detail.muted);
});
```

The built-in `volumeChangeExtension` synthesises a `volumechange` event by hooking `setVolume`/`mute`/`unMute` and polling `getVolume()`/`isMuted()` (default 250 ms). The poll only runs while you have a `volumechange` listener.

## Frameworks

### React (StrictMode-safe)

```tsx
import { useEffect, useRef } from 'react';
import { YTEmbed } from '@bogdanrn/yt-embed';

export function YouTube({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ac = new AbortController();
    const player = new YTEmbed(ref.current, { videoId, signal: ac.signal });
    return () => {
      ac.abort();
      player.destroy();
    };
  }, [videoId]);
  return <div ref={ref} />;
}
```

### Svelte 5 (runes)

```svelte
<script lang="ts">
  import { YTEmbed } from '@bogdanrn/yt-embed';

  let { videoId }: { videoId: string } = $props();
  let el: HTMLDivElement;

  $effect(() => {
    if (!el) return;
    const player = new YTEmbed(el, { videoId });
    return () => player.destroy();
  });
</script>

<div bind:this={el}></div>
```

## License

MIT — see [LICENSE](./LICENSE).
