# React adapter

`@bogdanrn/yt-embed/react` exposes a single hook, `useYTEmbed(videoId, options?)`. It mounts a `YTEmbed` against a div ref, subscribes to canonical events, and mirrors the player state into React state.

## Quick start

```tsx
import { useYTEmbed } from '@bogdanrn/yt-embed/react';

export function Player({ videoId }: { videoId: string }) {
  const { containerRef, ready, currentTime, duration, isPlaying, error } = useYTEmbed(videoId);
  return (
    <div>
      <div ref={containerRef} />
      <p>
        {ready
          ? `${currentTime.toFixed(1)} / ${duration.toFixed(1)} (${isPlaying ? 'playing' : 'paused'})`
          : 'Loading…'}
      </p>
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
}
```

## Return shape

```ts
interface UseYTEmbedResult {
  containerRef: RefObject<HTMLDivElement | null>;
  player: YTEmbed | null;
  ready: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  state: PlayerStateCode;
  error: { code: number; message: string } | null;
}
```

`player` exposes the underlying `YTEmbed` instance once mounted — call `player?.playVideo()` etc. directly when you need imperative control.

## Defaults

The hook auto-includes `timeUpdateExtension` and `durationChangeExtension` so `currentTime` and `duration` always reflect playback. It also defaults `isolate: true` so the consumer's container ref stays stable across mount/unmount cycles (StrictMode-safe).

## Adding extensions

```tsx
import { useYTEmbed } from '@bogdanrn/yt-embed/react';
import { mediaSessionExtension, cuePointExtension } from '@bogdanrn/yt-embed';
import { useMemo } from 'react';

const extensions = [mediaSessionExtension(), cuePointExtension({ cues: [...] })];

export function Player({ videoId }: { videoId: string }) {
  // Memoize so the hook does not tear down the player on every render.
  const memoized = useMemo(() => extensions, []);
  const { containerRef } = useYTEmbed(videoId, { extensions: memoized });
  return <div ref={containerRef} />;
}
```

## Re-render safety

The hook tracks `options` via a ref so passing an inline literal (`useYTEmbed(id, { width: 640 })`) does **not** tear down the player on every parent re-render. The hook only re-mounts when `videoId` or the `extensions` array identity changes — pass a stable `useMemo` for extensions to keep the player long-lived.
