# Vue adapter

`@bogdanrn/yt-embed/vue` exposes `useYTEmbed(videoId, options?)`, a Composition-API composable that mirrors player state into Vue refs.

## Quick start

```vue
<script setup lang="ts">
import { useYTEmbed } from '@bogdanrn/yt-embed/vue';

const props = defineProps<{ videoId: string }>();
const { containerRef, ready, currentTime, duration, isPlaying } = useYTEmbed(props.videoId);
</script>

<template>
  <div>
    <div ref="containerRef" />
    <p v-if="ready">
      {{ currentTime.toFixed(1) }} / {{ duration.toFixed(1) }}
      ({{ isPlaying ? 'playing' : 'paused' }})
    </p>
    <p v-else>Loading…</p>
  </div>
</template>
```

## Return shape

```ts
interface UseYTEmbedResult {
  containerRef: Ref<HTMLDivElement | null>;
  player: ShallowRef<YTEmbed | null>;
  ready: Ref<boolean>;
  currentTime: Ref<number>;
  duration: Ref<number>;
  isPlaying: Ref<boolean>;
  state: Ref<PlayerStateCode>;
  error: Ref<{ code: number; message: string } | null>;
}
```

## Reactive videoId

Pass a `Ref<string>` to switch videos reactively:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useYTEmbed } from '@bogdanrn/yt-embed/vue';

const videoId = ref('M7lc1UVf-VE');
const { containerRef, ready } = useYTEmbed(videoId);
</script>

<template>
  <button @click="videoId = 'tgbNymZ7vqY'">Switch</button>
  <div ref="containerRef" />
</template>
```

## Defaults

The composable auto-includes `timeUpdateExtension` + `durationChangeExtension` and defaults `isolate: true`. Override either via the second `options` arg.
