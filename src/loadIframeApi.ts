import type * as YT from 'youtube';
import { IframeApiLoadError } from './errors.js';

const SCRIPT_URL = 'https://www.youtube.com/iframe_api';

let cachedPromise: Promise<typeof YT> | null = null;

export interface YTEmbedConfig {
  scriptUrl?: string | undefined;
}
export const config: YTEmbedConfig = {};

type YTWindow = Window & {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
};

export function loadIframeApi(): Promise<typeof YT> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = new Promise<typeof YT>((resolve, reject) => {
    const w = window as YTWindow;
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }

    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT as typeof YT);
    };

    const url = config.scriptUrl ?? SCRIPT_URL;
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.addEventListener('error', (event) => {
      cachedPromise = null; // allow retry after failure
      if (previous) w.onYouTubeIframeAPIReady = previous;
      else delete w.onYouTubeIframeAPIReady;
      script.remove();
      reject(new IframeApiLoadError('Failed to load YouTube IFrame API', { cause: event }));
    });
    document.head.appendChild(script);
  });

  return cachedPromise;
}

/** @internal — used by tests. */
export function _resetForTests(): void {
  cachedPromise = null;
}
