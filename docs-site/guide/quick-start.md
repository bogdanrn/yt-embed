# Quick start

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

## Hello, video

```ts
import { YTEmbed } from '@bogdanrn/yt-embed';

const player = new YTEmbed(document.getElementById('host')!, {
  videoId: 'M7lc1UVf-VE',
});

await player.whenReady();
await player.playVideo();
```

That's the whole core API. The constructor returns synchronously (does not touch the DOM until ready), `whenReady()` resolves once YouTube confirms the iframe loaded, and every method on `YT.Player` is exposed as a promise-returning wrapper.

## With extensions

```ts
import {
  YTEmbed,
  timeUpdateExtension,
  cuePointExtension,
  mediaSessionExtension,
} from '@bogdanrn/yt-embed';

const player = new YTEmbed(host, {
  videoId,
  extensions: [
    timeUpdateExtension(),
    cuePointExtension({ cues: [{ time: 30, payload: 'half-way' }] }),
    mediaSessionExtension(),
  ],
});

player.addEventListener('cuepoint', (e) => console.log(e.detail));
```

Extensions are tree-shakable — only what you import ends up in your bundle. See the [extensions guide](/guide/extensions) for the full catalogue.

## Cancellation and timeouts

```ts
await player.playVideo({
  awaitState: true,
  signal: AbortSignal.timeout(3000),
});
```

`AbortSignal` rejection follows the standard `DOMException('Aborted', 'AbortError')` shape. See the [cleanup contract](/guide/cleanup) for the full rejection matrix.

## Frameworks

If you're in React, Vue, or Svelte, skip straight to the [adapter for your framework](/adapters/react). They auto-load `timeUpdateExtension` + `durationChangeExtension` and isolate the iframe in a wrapper for stable refs.
