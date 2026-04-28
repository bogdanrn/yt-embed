import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { durationChangeExtension } from '../extensions/durationChange.js';
import { timeUpdateExtension } from '../extensions/timeUpdate.js';
import type { Extension } from '../extensions/types.js';
import { PlayerState, type PlayerStateCode } from '../playerState.js';
import type { YTEmbedOptions } from '../types.js';
import { YTEmbed } from '../YTEmbed.js';

export interface UseYTEmbedOptions extends Omit<YTEmbedOptions, 'videoId' | 'extensions'> {
  /** Additional extensions. timeUpdate + durationChange are added automatically. */
  extensions?: readonly Extension[];
}

export interface UseYTEmbedResult {
  containerRef: RefObject<HTMLDivElement | null>;
  player: YTEmbed | null;
  ready: boolean;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  state: PlayerStateCode;
  error: { code: number; message: string } | null;
}

/**
 * React hook for `@bogdanrn/yt-embed`. Mounts a YTEmbed against a div ref,
 * subscribes to canonical events, and mirrors them to React state. The hook
 * always wraps the YT iframe in an isolate wrapper so the consumer's ref
 * stays stable across destroy/recreate. The user opts into the hook's
 * lifecycle by attaching `containerRef` to a `<div>`.
 *
 * The hook auto-includes `timeUpdateExtension` and `durationChangeExtension`
 * so `currentTime` and `duration` reflect playback without further setup.
 */
export function useYTEmbed(videoId: string, options?: UseYTEmbedOptions): UseYTEmbedResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [player, setPlayer] = useState<YTEmbed | null>(null);
  const [ready, setReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<PlayerStateCode>(-1);
  const [error, setError] = useState<{ code: number; message: string } | null>(null);

  // Stable extension array — defaults plus consumer overrides.
  const extensions = useMemo(
    () => [timeUpdateExtension(), durationChangeExtension(), ...(options?.extensions ?? [])],
    // The deps array intentionally re-creates on consumer-extensions identity change.
    // Most consumers pass a stable array via useMemo on their side.
    [options?.extensions],
  );

  // Snapshot non-reactive options once per (videoId, extensions, isolate) cycle.
  // Tracking the full `options` object would tear down the player on every parent
  // re-render that passes an inline literal — destroying ready/currentTime state.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const opts = optionsRef.current;

    const instance = new YTEmbed(node, {
      ...opts,
      videoId,
      isolate: opts?.isolate ?? true,
      extensions,
    });

    setPlayer(instance);
    setReady(false);
    setCurrentTime(0);
    setDuration(0);
    setState(-1);
    setError(null);

    const onReady = () => setReady(true);
    const onTime = (e: Event) => setCurrentTime((e as CustomEvent<{ time: number }>).detail.time);
    const onDuration = (e: Event) =>
      setDuration((e as CustomEvent<{ duration: number }>).detail.duration);
    const onState = (e: Event) =>
      setState((e as CustomEvent<{ state: PlayerStateCode }>).detail.state);
    const onError = (e: Event) =>
      setError((e as CustomEvent<{ code: number; message: string }>).detail);

    instance.addEventListener('ready', onReady);
    instance.addEventListener('timeupdate', onTime);
    instance.addEventListener('durationchange', onDuration);
    instance.addEventListener('statechange', onState);
    instance.addEventListener('error', onError);

    return () => {
      instance.removeEventListener('ready', onReady);
      instance.removeEventListener('timeupdate', onTime);
      instance.removeEventListener('durationchange', onDuration);
      instance.removeEventListener('statechange', onState);
      instance.removeEventListener('error', onError);
      instance.destroy();
      setPlayer((current) => (current === instance ? null : current));
    };
    // The hook restarts only when videoId or extensions change. options is read
    // from a ref so inline-literal options don't tear the player down on every
    // parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, extensions]);

  return {
    containerRef,
    player,
    ready,
    currentTime,
    duration,
    isPlaying: state === PlayerState.PLAYING,
    state,
    error,
  };
}
