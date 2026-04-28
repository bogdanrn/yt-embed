# SSR / Next.js

The `YTEmbed` constructor is SSR-safe — no DOM access until `#initialise()` runs. That means you can `import { YTEmbed }` at module top in a server component without crashing the build.

`whenReady()` rejects with `EnvironmentError` if `document` is not available, which is what you want for failure-fast diagnostics.

## Next.js (App Router)

Render the player in a client-only chunk using `dynamic` with `ssr: false`:

```tsx
// app/components/YouTubePlayer.tsx
'use client';
import { useYTEmbed } from '@bogdanrn/yt-embed/react';

export function YouTubePlayer({ videoId }: { videoId: string }) {
  const { containerRef, ready, currentTime } = useYTEmbed(videoId);
  return (
    <div>
      <div ref={containerRef} />
      <p>{ready ? `${currentTime.toFixed(1)}s` : 'Loading…'}</p>
    </div>
  );
}
```

```tsx
// app/page.tsx (server component)
import dynamic from 'next/dynamic';

const YouTubePlayer = dynamic(
  () => import('./components/YouTubePlayer').then((m) => m.YouTubePlayer),
  { ssr: false },
);

export default function Page() {
  return <YouTubePlayer videoId="M7lc1UVf-VE" />;
}
```

## Other frameworks

- **Vue / Nuxt**: wrap the composable in a `<ClientOnly>` component, or use Nuxt's `useNuxtApp` to gate the call.
- **SvelteKit**: import the action inside an `if (browser)` check, or use the `+page.svelte` lifecycle (`onMount`) — the action only runs when mounted.
- **Astro**: mark the island as `client:only="react"` (or `vue`/`svelte`) so the framework skips SSR.

## Detecting SSR rejections

```ts
import { EnvironmentError, YTEmbed } from '@bogdanrn/yt-embed';

const player = new YTEmbed(host, { videoId });
try {
  await player.whenReady();
} catch (err) {
  if (err instanceof EnvironmentError) {
    // Not in a browser. Render a fallback.
  }
  throw err;
}
```
