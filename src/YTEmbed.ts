import { loadIframeApi } from './loadIframeApi.js';
import type { YTEmbedOptions } from './types.js';
import type { PlayerStateCode } from './playerState.js';

export class YTEmbed extends EventTarget {
  readonly #element: HTMLElement;
  readonly #options: YTEmbedOptions;
  #destroyed = false;
  #state: PlayerStateCode = -1;

  constructor(target: HTMLElement | string, options: YTEmbedOptions) {
    super();
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) {
      throw new TypeError('YTEmbed: target element not found');
    }
    this.#element = element;
    this.#options = options;

    // Eagerly trigger script load so the iframe is requested ASAP.
    void loadIframeApi();
  }

  get destroyed(): boolean {
    return this.#destroyed;
  }

  get state(): PlayerStateCode {
    return this.#state;
  }

  get iframe(): HTMLIFrameElement | null {
    return this.#element.querySelector('iframe');
  }
}
