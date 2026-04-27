import { IframeApiLoadError } from './errors.js';

const SCRIPT_URL = 'https://www.youtube.com/iframe_api';

let cachedPromise: Promise<typeof YT> | null = null;

export interface YTEmbedConfig {
  scriptUrl?: string | undefined;
}
export const config: YTEmbedConfig = {};

export function loadIframeApi(): Promise<typeof YT> {
  if (cachedPromise) return cachedPromise;

  cachedPromise = new Promise<typeof YT>((resolve, reject) => {
    // biome-ignore lint/suspicious/noExplicitAny: window.YT augmentation is global.
    const existingYT = (window as any).YT;
    if (existingYT?.Player) {
      resolve(existingYT);
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: window callback augmentation.
    const previous = (window as any).onYouTubeIframeAPIReady as (() => void) | undefined;
    // biome-ignore lint/suspicious/noExplicitAny: window callback augmentation.
    (window as any).onYouTubeIframeAPIReady = () => {
      previous?.();
      // biome-ignore lint/suspicious/noExplicitAny: window.YT global.
      resolve((window as any).YT as typeof YT);
    };

    const url = config.scriptUrl ?? SCRIPT_URL;
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.addEventListener('error', (event) => {
      cachedPromise = null; // allow retry after failure
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
