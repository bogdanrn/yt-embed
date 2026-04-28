import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface VolumeChangeExtensionOptions {
  /** Polling interval in ms. Default: 250. */
  intervalMs?: number;
}

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

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
 *    cache immediately; the next poll tick sees no diff and stays silent.
 * 4. **Lazy lifecycle** — installed only inside `attach()`, called by YTEmbed on first
 *    `volumechange` listener. Removed in `detach`, which fires on last-listener-leave or destroy.
 */
export function volumeChangeExtension(options: VolumeChangeExtensionOptions = {}): Extension {
  const intervalMs = options.intervalMs ?? 250;

  return {
    events: ['volumechange'],

    attach(player: YTEmbed): () => void {
      let last: { volume: number; muted: boolean } | null = null;
      let inFlight = false;
      let detached = false;

      const vm = player as unknown as VolumeMethodMap;

      async function readAndMaybeEmit(): Promise<void> {
        if (inFlight || detached) return;
        inFlight = true;
        try {
          const [volume, muted] = (await Promise.all([vm.getVolume(), vm.isMuted()])) as [
            number,
            boolean,
          ];
          if (detached) return;
          if (last === null || last.volume !== volume || last.muted !== muted) {
            last = { volume, muted };
            player.dispatchEvent(new CustomEvent('volumechange', { detail: { ...last } }));
          }
        } finally {
          inFlight = false;
        }
      }

      const timer = setInterval(() => void readAndMaybeEmit(), intervalMs);

      // Hook path: wrap volume-affecting methods to emit immediately on our own calls.
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

      return () => {
        detached = true;
        clearInterval(timer);
        // Delete the instance-level shadow so the prototype wrapper takes over again.
        delete (vm as Partial<VolumeMethodMap>).setVolume;
        delete (vm as Partial<VolumeMethodMap>).mute;
        delete (vm as Partial<VolumeMethodMap>).unMute;
      };
    },
  };
}
