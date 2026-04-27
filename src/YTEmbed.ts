import { PlayerDestroyedError, PlayerInitError } from './errors.js';
import { loadIframeApi } from './loadIframeApi.js';
import type { PlayerStateCode } from './playerState.js';
import type { YTEmbedOptions } from './types.js';

const DEFAULT_INIT_TIMEOUT = 30_000;

export class YTEmbed extends EventTarget {
  readonly #element: HTMLElement;
  readonly #options: YTEmbedOptions;
  #destroyed = false;
  #state: PlayerStateCode = -1;
  #readyResolved = false;

  readonly #readyPromise: Promise<void>;
  #resolveReady: (() => void) | null = null;
  #rejectReady: ((err: unknown) => void) | null = null;
  #player: YT.Player | null = null;

  constructor(target: HTMLElement | string, options: YTEmbedOptions) {
    super();
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) {
      throw new TypeError('YTEmbed: target element not found');
    }
    this.#element = element;
    this.#options = options;

    // Create the ready promise eagerly so resolvers are assigned before #initialise runs.
    // The no-op .catch() prevents unhandled-rejection warnings when the instance is destroyed
    // without anyone awaiting whenReady(). Callers who do await it still see the rejection.
    this.#readyPromise = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    this.#readyPromise.catch(() => {});

    // Handle abort signal: if already aborted, short-circuit before initialise.
    if (options.signal) {
      if (options.signal.aborted) {
        this.#destroyed = true;
        // Reject the pending ready promise. #rejectReady is set above by the Promise ctor.
        // biome-ignore lint/style/noNonNullAssertion: set synchronously in Promise ctor above.
        this.#rejectReady!(new PlayerDestroyedError('Destroyed before ready'));
        return;
      }
      options.signal.addEventListener('abort', () => this.destroy(), { once: true });
    }

    void this.#initialise();
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

  whenReady(): Promise<void> {
    return this.#readyPromise;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    if (!this.#readyResolved) {
      this.#rejectReady?.(new PlayerDestroyedError('Destroyed before ready'));
    }
    this.#player?.destroy();
    this.#player = null;
    // pending method promises rejected here once Phase 4.7 lands.
  }

  async #initialise(): Promise<void> {
    try {
      const YTApi = await loadIframeApi();

      if (this.#destroyed) {
        // destroy() was called while we awaited the API; it already rejected.
        return;
      }

      const timeout = this.#options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT;
      const timer = setTimeout(() => {
        this.#rejectReady?.(new PlayerInitError(`Player did not become ready within ${timeout}ms`));
      }, timeout);

      // Build YT.Player constructor options, omitting undefined values to
      // satisfy exactOptionalPropertyTypes.
      const playerOptions: YT.PlayerOptions = {
        events: {
          onReady: () => {
            clearTimeout(timer);
            this.#readyResolved = true;
            this.#resolveReady?.();
          },
        },
        ...(this.#options.videoId !== undefined && { videoId: this.#options.videoId }),
        ...(this.#options.width !== undefined && { width: this.#options.width }),
        ...(this.#options.height !== undefined && { height: this.#options.height }),
        ...(this.#options.playerVars !== undefined && { playerVars: this.#options.playerVars }),
      };

      this.#player = new YTApi.Player(this.#element, playerOptions);
    } catch (err) {
      this.#rejectReady?.(err);
    }
  }
}
