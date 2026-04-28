# @bogdanrn/yt-embed

[![Bundle size](https://img.shields.io/bundlephobia/minzip/@bogdanrn/yt-embed)](https://bundlephobia.com/package/@bogdanrn/yt-embed)
[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/bogdanrn/yt-embed?utm_source=oss&utm_medium=github&utm_campaign=bogdanrn%2Fyt-embed&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

Promise-wrapped YouTube IFrame Player API. TypeScript-first, zero runtime dependencies, `EventTarget`-based. Includes 19 opt-in extensions (timeupdate, mediaSession, cuepoint, persistedState, fullscreen, picture-in-picture, etc.) and first-class hooks for React, Vue, and Svelte.

## Install

```bash
# pnpm
pnpm add @bogdanrn/yt-embed

# npm
npm install @bogdanrn/yt-embed

# yarn
yarn add @bogdanrn/yt-embed

# bun
bun add @bogdanrn/yt-embed
```

TypeScript users should also install `@types/youtube` (optional peer dep) so the global `YT` namespace referenced by the bundled `.d.ts` resolves:

```bash
pnpm add -D @types/youtube
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

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `videoId` | `string` | — | Initial video. Required for autoplay. |
| `playerVars` | `YT.PlayerVars` | — | Forwarded to YT. |
| `extensions` | `Extension[]` | `[]` | See below. |
| `signal` | `AbortSignal` | — | Aborting calls `destroy()`. |
| `initTimeoutMs` | `number` | `30000` | Reject `whenReady()` after this. |
| `pollingIntervalMs` | `number` | `250` | Base cadence for the shared polling ticker (drives time-based extensions). |
| `privacyMode` | `'standard'` \| `'enhanced'` | `'standard'` | `'enhanced'` switches the iframe origin to `youtube-nocookie.com` (no cookies until playback). |
| `isolate` | `boolean` | `false` | Mount the iframe in an internal wrapper so the consumer's element stays stable across destroy. Adapters set this to `true` by default. |

## Extensions

Extensions are tree-shakable named exports. With `"sideEffects": false` in this package, only the extensions you import end up in your bundle.

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
    timeUpdateExtension(),
    cuePointExtension({ cues: [{ time: 30, payload: 'half-way' }] }),
    mediaSessionExtension(),
    persistedStateExtension({ key: `pos:${videoId}` }),
  ],
});

player.addEventListener('cuepoint', (e) => console.log(e.detail));
```

| Extension | Event(s) emitted | Lifecycle |
| --- | --- | --- |
| `timeUpdateExtension` | `timeupdate` | lazy |
| `durationChangeExtension` | `durationchange` | lazy |
| `bufferProgressExtension` | `bufferprogress` | lazy |
| `volumeChangeExtension` | `volumechange` | lazy |
| `cuePointExtension` | `cuepoint` | lazy |
| `chapterChangeExtension` | `chapterchange` | lazy |
| `abLoopExtension` | `loop` | lazy |
| `scrubBarSyncExtension` | `scrubsync` | lazy |
| `visibilityChangeExtension` | `visibilitychange` | lazy |
| `mediaSessionExtension` | `mediasessionupdate` | eager |
| `persistedStateExtension` | — | eager |
| `errorRetryExtension` | `retry` | eager |
| `analyticsExtension` | — (callback sink) | eager |
| `captionsLanguageExtension` | `captionschange` | eager when `defaultLanguage` set |
| `headlessAudioExtension` | — | eager |
| `autoplayPolicyExtension` | `autoplaymuted` | eager |
| `playbackRateOptimisticExtension` | `playbackratechange` (optimistic) | eager |
| `seekRangeExtension` | `seekclamped` | eager |
| `fullscreenExtension` | `fullscreenchange` | eager |
| `pictureInPictureExtension` | `pipchange` | eager |

Polling extensions share one `setInterval` driven by `pollingIntervalMs` — adding ten polling extensions costs one timer, not ten.

## Framework adapters

Each adapter is a tree-shakable sub-export. Consumers who don't import `/react`, `/vue`, or `/svelte` pay nothing.

### React

```tsx
import { useYTEmbed } from '@bogdanrn/yt-embed/react';

export function Player({ videoId }: { videoId: string }) {
  const { containerRef, ready, currentTime, duration, isPlaying, error } = useYTEmbed(videoId);
  return (
    <div>
      <div ref={containerRef} />
      <p>
        {ready ? `${currentTime.toFixed(1)} / ${duration.toFixed(1)} (${isPlaying ? 'playing' : 'paused'})` : 'Loading…'}
      </p>
      {error && <p>{error.message}</p>}
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { useYTEmbed } from '@bogdanrn/yt-embed/vue';

const props = defineProps<{ videoId: string }>();
const { containerRef, ready, currentTime, duration, isPlaying } = useYTEmbed(props.videoId);
</script>

<template>
  <div>
    <div ref="containerRef" />
    <p v-if="ready">{{ currentTime.toFixed(1) }} / {{ duration.toFixed(1) }} ({{ isPlaying ? 'playing' : 'paused' }})</p>
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import { createYTEmbed } from '@bogdanrn/yt-embed/svelte';

  let { videoId }: { videoId: string } = $props();
  const { attach, ready, currentTime, duration, isPlaying } = createYTEmbed(videoId);
</script>

<div use:attach />
{#if $ready}
  <p>{$currentTime.toFixed(1)} / {$duration.toFixed(1)} ({$isPlaying ? 'playing' : 'paused'})</p>
{/if}
```

All three adapters auto-include `timeUpdateExtension` and `durationChangeExtension` and set `isolate: true` so the consumer's container ref stays stable across re-renders.

## Content Security Policy

Add the following directives:

```
script-src https://www.youtube.com https://s.ytimg.com
frame-src  https://www.youtube.com https://www.youtube-nocookie.com
```

If you only use `privacyMode: 'enhanced'`, you may omit `https://www.youtube.com` from `frame-src`.

## SSR / Next.js

The constructor is SSR-safe — no DOM access until first call into the player. `whenReady()` rejects with `EnvironmentError` in non-browser environments, which is what you want for failure-fast diagnostics.

For the App Router, render the player in a client-only chunk:

```tsx
'use client';
import { useYTEmbed } from '@bogdanrn/yt-embed/react';

export function YouTubePlayer({ videoId }: { videoId: string }) {
  const { containerRef } = useYTEmbed(videoId);
  return <div ref={containerRef} />;
}
```

```tsx
// In the server component
import dynamic from 'next/dynamic';
const YouTubePlayer = dynamic(() => import('./player').then((m) => m.YouTubePlayer), { ssr: false });
```

## Cleanup contract

- `destroy()` is idempotent.
- After `destroy()`, every in-flight wrapper promise rejects with `PlayerDestroyedError`. Pre-ready queued calls reject with `PlayerDestroyedError('Player destroyed before call')`.
- A `signal.abort()` rejects in-flight calls with `DOMException('Aborted', 'AbortError')` and triggers `destroy()`. Calling `destroy()` afterwards is a no-op.
- `whenReady()` rejects with `PlayerDestroyedError` if destroyed before init, `PlayerInitError` on timeout, or `EnvironmentError` in SSR.

Use `e.name === 'AbortError'` for caller aborts; `instanceof PlayerInitError` for timeouts; `instanceof PlayerDestroyedError` for destroy-during-init; `instanceof EnvironmentError` for SSR mismatches.

## Multiple concurrent players

The IFrame API exposes a single `window.onYouTubeIframeAPIReady` slot. This package handles that internally — multiple `YTEmbed` instances created in the same tick share one script load and each receive `onReady` independently.

```ts
const a = new YTEmbed(elA, { videoId: 'M7lc1UVf-VE' });
const b = new YTEmbed(elB, { videoId: 'tgbNymZ7vqY' });
await Promise.all([a.whenReady(), b.whenReady()]);
```

## API Reference

The full TypeDoc-generated reference for every exported symbol lives at [`docs/api/README.md`](./docs/api/README.md). Regenerate it with `pnpm docs:build` (typedoc + `typedoc-plugin-markdown`).

## License

MIT — see [LICENSE](./LICENSE).
