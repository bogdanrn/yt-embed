import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface VolumeChangeExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  interval?: number;
}

// Opaque helper type — a callable that returns a Promise of any value.
type AsyncFn = (...args: unknown[]) => Promise<unknown>;

// Minimal shape of YTEmbed methods touched by this extension, typed as AsyncFn
// so the hook wrapper is uniformly typed.
interface VolumeMethodMap {
  getVolume: AsyncFn;
  isMuted: AsyncFn;
  setVolume: AsyncFn;
  mute: AsyncFn;
  unMute: AsyncFn;
}

/**
 * Synthesises a `volumechange` event that Google's IFrame API does not natively emit.
 *
 * Strategy (hybrid — spec §4.3 S3):
 * 1. **Hook path** — monkey-patches the per-instance `setVolume`, `mute`, and `unMute`
 *    methods so that, after each call resolves, the extension reads the current volume/muted
 *    state, compares it against the shared cache, and emits `volumechange` if changed.
 * 2. **Poll path** — runs `setInterval` (at `interval` ms) to catch volume changes the user
 *    makes inside the YouTube iframe UI (volume slider), which bypass our wrappers entirely.
 * 3. **Dedupe** — both paths read/write the same `last` cache object. The hook updates the
 *    cache immediately; the next poll tick sees no diff and stays silent. No double-emit.
 * 4. **Lazy lifecycle** — the timer and monkey-patch are installed only inside `attach()`,
 *    which is called by YTEmbed only when the first `volumechange` listener is added. Both
 *    are removed in the returned `detach` function, which fires when the last listener leaves
 *    or on `destroy()`. Extensions that are never subscribed cost nothing.
 */
export function volumeChangeExtension(options: VolumeChangeExtensionOptions = {}): Extension {
  const intervalMs = options.interval ?? 250;

  return {
    events: ['volumechange'],

    attach(player: YTEmbed): () => void {
      // Shared cache — both poll and hook paths read/write this.
      let last: { volume: number; muted: boolean } | null = null;

      // Cast player to the narrow method map we need for type-safe access.
      const vm = player as unknown as VolumeMethodMap;

      async function readAndMaybeEmit(): Promise<void> {
        // getVolume / isMuted are Promise-returning wrappers installed by YTEmbed.
        const volume = (await vm.getVolume()) as number;
        const muted = (await vm.isMuted()) as boolean;
        if (last === null || last.volume !== volume || last.muted !== muted) {
          last = { volume, muted };
          player.dispatchEvent(new CustomEvent('volumechange', { detail: { ...last } }));
        }
      }

      // Poll path: catch in-iframe UI changes.
      const timer = setInterval(() => void readAndMaybeEmit(), intervalMs);

      // Hook path: wrap volume-affecting methods so we emit immediately on our own calls.
      const origSetVolume = vm.setVolume.bind(player);
      const origMute = vm.mute.bind(player);
      const origUnMute = vm.unMute.bind(player);

      const hookForMethod =
        (orig: AsyncFn): AsyncFn =>
        async (...args: unknown[]): Promise<unknown> => {
          const result = await orig(...args);
          await readAndMaybeEmit();
          return result;
        };

      vm.setVolume = hookForMethod(origSetVolume);
      vm.mute = hookForMethod(origMute);
      vm.unMute = hookForMethod(origUnMute);

      // Detach: stop the timer and restore the original methods.
      return () => {
        clearInterval(timer);
        vm.setVolume = origSetVolume;
        vm.mute = origMute;
        vm.unMute = origUnMute;
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Module augmentation — adds `volumechange` to YTEmbedEventMap so that
// importing this extension gives full TypeScript autocomplete on addEventListener.
// ---------------------------------------------------------------------------
declare module '../types.js' {
  interface YTEmbedEventMap {
    volumechange: CustomEvent<{ volume: number; muted: boolean }>;
  }
}
