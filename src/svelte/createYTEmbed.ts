import { type Readable, writable } from 'svelte/store';
import { durationChangeExtension } from '../extensions/durationChange.js';
import { timeUpdateExtension } from '../extensions/timeUpdate.js';
import type { Extension } from '../extensions/types.js';
import { PlayerState, type PlayerStateCode } from '../playerState.js';
import type { YTEmbedOptions } from '../types.js';
import { YTEmbed } from '../YTEmbed.js';

export interface CreateYTEmbedOptions extends Omit<YTEmbedOptions, 'videoId' | 'extensions'> {
  extensions?: readonly Extension[];
}

export interface CreateYTEmbedResult {
  /** Svelte action — `<div use:attach />` mounts the player on the node. */
  attach: (node: HTMLElement) => { destroy(): void };
  player: Readable<YTEmbed | null>;
  ready: Readable<boolean>;
  currentTime: Readable<number>;
  duration: Readable<number>;
  isPlaying: Readable<boolean>;
  state: Readable<PlayerStateCode>;
  error: Readable<{ code: number; message: string } | null>;
}

/**
 * Svelte adapter for `@bogdanrn/yt-embed`. Returns reactive stores plus an
 * `attach` action used as `<div use:attach />`. Auto-includes timeUpdate +
 * durationChange extensions and isolates the iframe in a wrapper so the
 * action can re-attach safely across re-renders.
 */
export function createYTEmbed(
  videoId: string,
  options?: CreateYTEmbedOptions,
): CreateYTEmbedResult {
  const player = writable<YTEmbed | null>(null);
  const ready = writable(false);
  const currentTime = writable(0);
  const duration = writable(0);
  const state = writable<PlayerStateCode>(-1);
  const isPlaying = writable(false);
  const error = writable<{ code: number; message: string } | null>(null);

  const attach = (node: HTMLElement): { destroy(): void } => {
    const extensions = [
      timeUpdateExtension(),
      durationChangeExtension(),
      ...(options?.extensions ?? []),
    ];
    const instance = new YTEmbed(node, {
      ...options,
      videoId,
      isolate: options?.isolate ?? true,
      extensions,
    });
    player.set(instance);

    const onReady = () => ready.set(true);
    const onTime = (e: Event) => currentTime.set((e as CustomEvent<{ time: number }>).detail.time);
    const onDuration = (e: Event) =>
      duration.set((e as CustomEvent<{ duration: number }>).detail.duration);
    const onState = (e: Event) => {
      const s = (e as CustomEvent<{ state: PlayerStateCode }>).detail.state;
      state.set(s);
      isPlaying.set(s === PlayerState.PLAYING);
    };
    const onError = (e: Event) =>
      error.set((e as CustomEvent<{ code: number; message: string }>).detail);

    instance.addEventListener('ready', onReady);
    instance.addEventListener('timeupdate', onTime);
    instance.addEventListener('durationchange', onDuration);
    instance.addEventListener('statechange', onState);
    instance.addEventListener('error', onError);

    return {
      destroy() {
        instance.removeEventListener('ready', onReady);
        instance.removeEventListener('timeupdate', onTime);
        instance.removeEventListener('durationchange', onDuration);
        instance.removeEventListener('statechange', onState);
        instance.removeEventListener('error', onError);
        instance.destroy();
        player.set(null);
        ready.set(false);
      },
    };
  };

  return {
    attach,
    player: { subscribe: player.subscribe },
    ready: { subscribe: ready.subscribe },
    currentTime: { subscribe: currentTime.subscribe },
    duration: { subscribe: duration.subscribe },
    isPlaying: { subscribe: isPlaying.subscribe },
    state: { subscribe: state.subscribe },
    error: { subscribe: error.subscribe },
  };
}
