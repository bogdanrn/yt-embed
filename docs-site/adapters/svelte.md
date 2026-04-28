# Svelte adapter

`@bogdanrn/yt-embed/svelte` exposes `createYTEmbed(videoId, options?)`, which returns Svelte stores plus a `attach` action used as `<div use:attach />`.

## Quick start (Svelte 5 runes)

```svelte
<script lang="ts">
  import { createYTEmbed } from '@bogdanrn/yt-embed/svelte';

  let { videoId }: { videoId: string } = $props();
  const { attach, ready, currentTime, duration, isPlaying } = createYTEmbed(videoId);
</script>

<div use:attach />
{#if $ready}
  <p>
    {$currentTime.toFixed(1)} / {$duration.toFixed(1)}
    ({$isPlaying ? 'playing' : 'paused'})
  </p>
{:else}
  <p>Loading…</p>
{/if}
```

## Quick start (Svelte 4)

```svelte
<script lang="ts">
  import { createYTEmbed } from '@bogdanrn/yt-embed/svelte';

  export let videoId: string;
  const { attach, ready, currentTime, duration, isPlaying } = createYTEmbed(videoId);
</script>

<div use:attach />
{#if $ready}
  <p>{$currentTime.toFixed(1)} / {$duration.toFixed(1)}</p>
{/if}
```

## Return shape

```ts
interface CreateYTEmbedResult {
  attach: (node: HTMLElement) => { destroy(): void };
  player: Readable<YTEmbed | null>;
  ready: Readable<boolean>;
  currentTime: Readable<number>;
  duration: Readable<number>;
  isPlaying: Readable<boolean>;
  state: Readable<PlayerStateCode>;
  error: Readable<{ code: number; message: string } | null>;
}
```

## Defaults

Auto-includes `timeUpdateExtension` + `durationChangeExtension` and defaults `isolate: true`. The `attach` action constructs the player on mount and tears it down via Svelte's action `destroy()` lifecycle.
