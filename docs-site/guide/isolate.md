# `isolate` and host element replacement

The YouTube IFrame API is a destructive mount — when you call `new YT.Player(target, ...)`, YouTube **replaces** the target node with the iframe. The original element is removed from the DOM.

That's surprising for component-based UIs that hold a ref to the original element. In React:

```tsx
// Without isolate: ref is dangling after YT mounts.
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  new YTEmbed(ref.current!, { videoId });
  // ref.current is now removed from DOM, replaced by the iframe.
}, []);
```

## With `isolate: true`

Set `isolate: true` and YTEmbed creates an internal wrapper `<div>` inside your target, mounts the YT iframe in the wrapper, and leaves your element untouched:

```ts
new YTEmbed(host, { videoId, isolate: true });
// `host` stays in the DOM. A new <div> with the iframe is appended inside it.
```

On `destroy()`, the wrapper is removed. Your `host` ref is stable across mount/unmount cycles, which is what stateful UIs want.

## Adapters set this by default

The framework adapters (React, Vue, Svelte) all set `isolate: true` by default, so you don't have to think about it:

```tsx
const { containerRef } = useYTEmbed(videoId); // isolate: true under the hood
return <div ref={containerRef} />;
```

## When to leave it off

- You don't need a stable ref across mount/unmount.
- You want zero wrapper DOM (e.g. tightest possible markup for a one-shot player).

In those cases, `isolate: false` (the default) is fine — you save a single `<div>`.
