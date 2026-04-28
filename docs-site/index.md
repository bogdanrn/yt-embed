---
layout: home

hero:
  name: '@bogdanrn/yt-embed'
  text: Promise-wrapped YouTube IFrame Player API
  tagline: TypeScript-first, zero runtime dependencies, EventTarget-based. 19 opt-in extensions and first-class hooks for React, Vue, and Svelte.
  actions:
    - theme: brand
      text: Get started
      link: /guide/quick-start
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/bogdanrn/yt-embed

features:
  - title: Promise-wrapped
    details: Every YT.Player method returns a Promise. Calls auto-queue until the player is ready and reject deterministically on destroy.
  - title: Tree-shakable extensions
    details: 19 opt-in extensions for time updates, chapters, picture-in-picture, mediaSession, persisted state, and more. You ship only what you import.
  - title: Framework adapters
    details: useYTEmbed (React, Vue) and createYTEmbed (Svelte) sub-exports. Reactive { ready, currentTime, duration, isPlaying, error } out of the box.
  - title: SSR-safe
    details: Constructor never touches document. whenReady() rejects with EnvironmentError outside the browser, so failures are loud and early.
---

## Install

```bash
pnpm add @bogdanrn/yt-embed
# or: npm install / yarn add / bun add
```

TypeScript users should also install the optional peer dep:

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

For React/Vue/Svelte, see the [adapters](/adapters/react). For the full API surface, see the [reference](/api/).
