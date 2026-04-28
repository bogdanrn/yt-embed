# Cleanup contract

`destroy()` is idempotent. After `destroy()`, every in-flight wrapper promise rejects deterministically. Pre-ready queued calls reject with `PlayerDestroyedError('Player destroyed before call')`.

## Rejection matrix

| Trigger | What rejects | Error class | `e.name` |
| --- | --- | --- | --- |
| `player.destroy()` mid-call | The pending wrapper promise | `PlayerDestroyedError` | `'PlayerDestroyedError'` |
| `player.destroy()` before `whenReady()` | `whenReady()` and any queued calls | `PlayerDestroyedError` | `'PlayerDestroyedError'` |
| `signal.abort()` mid-call | The pending wrapper promise | `DOMException` | `'AbortError'` |
| `signal.abort()` (passed to constructor) | Triggers `destroy()` cascade | as above | as above |
| `whenReady()` timeout (`initTimeoutMs`) | `whenReady()` only | `PlayerInitError` | `'PlayerInitError'` |
| SSR (no `document`) | `whenReady()` | `EnvironmentError` | `'EnvironmentError'` |
| YT script fails to load | `whenReady()` | `IframeApiLoadError` | `'IframeApiLoadError'` |

## Catching specific failures

```ts
try {
  await player.playVideo({ signal: AbortSignal.timeout(5000) });
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // Caller aborted (or signal timed out).
  } else if (err instanceof PlayerDestroyedError) {
    // Player was destroyed mid-call.
  } else {
    throw err;
  }
}
```

For init failures:

```ts
try {
  await player.whenReady();
} catch (err) {
  if (err instanceof PlayerInitError) {
    // Timeout — YT never fired onReady.
  } else if (err instanceof EnvironmentError) {
    // Not a browser — render a fallback.
  } else if (err instanceof IframeApiLoadError) {
    // YT script blocked (CSP, network).
  } else if (err instanceof PlayerDestroyedError) {
    // Destroyed before init completed (e.g. caller aborted).
  }
}
```

## Cleanup ordering

If you pass a `signal` to the constructor and later call `signal.abort()`:
1. The signal listener triggers `destroy()`.
2. In-flight wrapper promises reject with `DOMException('Aborted', 'AbortError')`.
3. Calling `destroy()` afterwards is a no-op (idempotent).

If you `signal.abort()` before `whenReady()` resolves, `whenReady()` rejects with `PlayerDestroyedError('Destroyed before ready')` — the signal abort is the cause, but the surface error reflects "destroyed mid-init."
