---
"@bogdanrn/yt-embed": minor
---

Generated method wrappers are now fully typed.

The declaration-merged interface no longer falls back to `(...args: any[]) => Promise<unknown>` for every method. Each wrapper's signature is now derived from the underlying `YT.Player` method via a mapped type, so `player.setVolume(50)` accepts only `number`, `player.getDuration()` returns `Promise<number>`, etc. The optional trailing `MethodCallOptions` argument (`awaitState`, `signal`) remains supported on every wrapper.

Note: overloaded `YT.Player` methods (e.g. `seekTo`, `loadVideoById`) collapse to their last overload — a known TypeScript limitation when inferring through a generic `Promisify`. Callers needing a non-last overload can use the `call()` escape hatch.
