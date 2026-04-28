# Multiple concurrent players

The YouTube IFrame API exposes a single `window.onYouTubeIframeAPIReady` slot. Naïve integrations fail when more than one player constructs in the same tick — the second registration overwrites the first.

`@bogdanrn/yt-embed` handles that internally. The `loadIframeApi()` helper caches the script promise and chains successive `onYouTubeIframeAPIReady` callbacks via the `previous` pattern, so multiple `YTEmbed` instances created concurrently each receive `onReady` independently.

## Example

```ts
import { YTEmbed } from '@bogdanrn/yt-embed';

const a = new YTEmbed(document.getElementById('player-a')!, {
  videoId: 'M7lc1UVf-VE',
});
const b = new YTEmbed(document.getElementById('player-b')!, {
  videoId: 'tgbNymZ7vqY',
});

await Promise.all([a.whenReady(), b.whenReady()]);
// Both ready, both independent.

await Promise.all([a.playVideo(), b.pauseVideo()]);
```

## Notes

- The YT script loads once, regardless of how many YTEmbed instances exist.
- Each player has its own state, ready promise, and event listeners.
- Destroying one player does not affect the others.

## With React

```tsx
import { useYTEmbed } from '@bogdanrn/yt-embed/react';

function Wall({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <Player key={id} videoId={id} />
      ))}
    </>
  );
}

function Player({ videoId }: { videoId: string }) {
  const { containerRef, ready } = useYTEmbed(videoId);
  return <div ref={containerRef} aria-busy={!ready} />;
}
```
