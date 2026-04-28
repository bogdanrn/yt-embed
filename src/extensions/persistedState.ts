import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PersistedStateExtensionOptions {
  /** Storage key. Required. */
  key: string;
  /** Storage backend. Default: 'localStorage'. */
  sink?: 'localStorage' | 'sessionStorage' | StorageLike;
  /** Save interval in ms. Default: 5000. */
  intervalMs?: number;
  /** Restore on attach. Default: true. */
  restore?: boolean;
}

interface SeekCapable {
  seekTo: (time: number, allowSeekAhead: boolean) => Promise<void>;
}

function resolveStorage(sink: PersistedStateExtensionOptions['sink']): StorageLike | null {
  if (sink && typeof sink !== 'string') return sink;
  if (typeof window === 'undefined') return null;
  if (sink === 'sessionStorage') return window.sessionStorage;
  return window.localStorage;
}

/**
 * Auto-saves the playhead position to a persistent storage and restores it on
 * attach. Eager-attached so consumers don't need to subscribe to anything for
 * the resume-where-left-off behavior to take effect.
 */
export function persistedStateExtension(options: PersistedStateExtensionOptions): Extension {
  const intervalMs = options.intervalMs ?? 5000;
  const restore = options.restore !== false;

  return {
    events: [],
    eager: true,
    attach(player: YTEmbed): () => void {
      const storage = resolveStorage(options.sink);
      if (!storage) return () => {};

      const cap = player as unknown as SeekCapable;
      let detached = false;
      // Cache the most recent currentTime so the destroy-time save can write
      // synchronously — by the time `detach` runs, the player is already
      // `#destroyed` and wrapper calls reject with PlayerDestroyedError.
      let lastKnownTime = 0;

      const tickSave = async () => {
        if (detached) return;
        try {
          const t = await player.tickRead<number>('getCurrentTime');
          if (detached) return;
          lastKnownTime = t;
          storage.setItem(options.key, String(t));
        } catch {
          // Persisting is best-effort; never let a save error throw.
        }
      };

      const restoreOnce = async () => {
        if (!restore) return;
        const raw = storage.getItem(options.key);
        if (raw === null) return;
        const t = Number(raw);
        if (!Number.isFinite(t) || t <= 0) return;
        try {
          await cap.seekTo(t, true);
        } catch {
          // Seek may fail before the player accepts calls; tolerate it.
        }
      };

      void restoreOnce();
      const unsubscribe = player.tick(() => void tickSave(), intervalMs);

      return () => {
        detached = true;
        unsubscribe();
        // Synchronous final save using the cached time. Avoids the
        // PlayerDestroyedError that a fresh getCurrentTime() would raise
        // because destroy() has already set #destroyed.
        try {
          storage.setItem(options.key, String(lastKnownTime));
        } catch {
          // Best-effort; ignore storage write errors.
        }
      };
    },
  };
}
