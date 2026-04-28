import { onBeforeUnmount, type Ref, ref, type ShallowRef, shallowRef, watch } from 'vue';
import { durationChangeExtension } from '../extensions/durationChange.js';
import { timeUpdateExtension } from '../extensions/timeUpdate.js';
import type { Extension } from '../extensions/types.js';
import { PlayerState, type PlayerStateCode } from '../playerState.js';
import type { YTEmbedOptions } from '../types.js';
import { YTEmbed } from '../YTEmbed.js';

export interface UseYTEmbedOptions extends Omit<YTEmbedOptions, 'videoId' | 'extensions'> {
  extensions?: readonly Extension[];
}

export interface UseYTEmbedResult {
  containerRef: Ref<HTMLDivElement | null>;
  player: ShallowRef<YTEmbed | null>;
  ready: Ref<boolean>;
  currentTime: Ref<number>;
  duration: Ref<number>;
  isPlaying: Ref<boolean>;
  state: Ref<PlayerStateCode>;
  error: Ref<{ code: number; message: string } | null>;
}

/**
 * Vue composable for `@bogdanrn/yt-embed`. Bind `containerRef` to a template
 * `<div>` element. The composable auto-loads timeUpdate + durationChange
 * extensions and isolates the iframe in a wrapper so the consumer's ref
 * stays stable across video changes.
 */
export function useYTEmbed(
  videoId: string | Ref<string>,
  options?: UseYTEmbedOptions,
): UseYTEmbedResult {
  const containerRef: Ref<HTMLDivElement | null> = ref(null);
  const player: ShallowRef<YTEmbed | null> = shallowRef(null);
  const ready = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const state = ref<PlayerStateCode>(-1);
  const isPlaying = ref(false);
  const error = ref<{ code: number; message: string } | null>(null);

  let cleanupCurrent: (() => void) | null = null;

  const mount = (id: string) => {
    cleanupCurrent?.();
    cleanupCurrent = null;

    const node = containerRef.value;
    if (!node) return;

    const extensions = [
      timeUpdateExtension(),
      durationChangeExtension(),
      ...(options?.extensions ?? []),
    ];

    const instance = new YTEmbed(node, {
      ...options,
      videoId: id,
      isolate: options?.isolate ?? true,
      extensions,
    });
    player.value = instance;
    ready.value = false;
    currentTime.value = 0;
    duration.value = 0;
    state.value = -1;
    isPlaying.value = false;
    error.value = null;

    const onReady = () => {
      ready.value = true;
    };
    const onTime = (e: Event) => {
      currentTime.value = (e as CustomEvent<{ time: number }>).detail.time;
    };
    const onDuration = (e: Event) => {
      duration.value = (e as CustomEvent<{ duration: number }>).detail.duration;
    };
    const onState = (e: Event) => {
      const s = (e as CustomEvent<{ state: PlayerStateCode }>).detail.state;
      state.value = s;
      isPlaying.value = s === PlayerState.PLAYING;
    };
    const onError = (e: Event) => {
      error.value = (e as CustomEvent<{ code: number; message: string }>).detail;
    };

    instance.addEventListener('ready', onReady);
    instance.addEventListener('timeupdate', onTime);
    instance.addEventListener('durationchange', onDuration);
    instance.addEventListener('statechange', onState);
    instance.addEventListener('error', onError);

    cleanupCurrent = () => {
      instance.removeEventListener('ready', onReady);
      instance.removeEventListener('timeupdate', onTime);
      instance.removeEventListener('durationchange', onDuration);
      instance.removeEventListener('statechange', onState);
      instance.removeEventListener('error', onError);
      instance.destroy();
      if (player.value === instance) player.value = null;
    };
  };

  if (typeof videoId === 'string') {
    // Eager mount on next microtask so containerRef is bound by the time we
    // construct the player.
    void Promise.resolve().then(() => mount(videoId));
  } else {
    watch(
      [videoId, containerRef],
      ([nextId, node]) => {
        if (node) mount(nextId);
      },
      { immediate: true },
    );
  }

  onBeforeUnmount(() => {
    cleanupCurrent?.();
    cleanupCurrent = null;
  });

  return {
    containerRef,
    player,
    ready,
    currentTime,
    duration,
    isPlaying,
    state,
    error,
  };
}
