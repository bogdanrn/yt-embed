import { EnvironmentError, PlayerDestroyedError, PlayerInitError } from './errors.js';
import { eventCallbackNames } from './eventCallbackNames.generated.js';
import { type FunctionName, functionNames } from './functionNames.generated.js';
import { ListenerTracker } from './listenerTracker.js';
import { loadIframeApi } from './loadIframeApi.js';
import { youTubeErrorMessageFor } from './playerErrors.js';
import { PlayerState, type PlayerStateCode } from './playerState.js';
import type { MethodCallOptions, YTEmbedEventMap, YTEmbedOptions } from './types.js';

const DEFAULT_INIT_TIMEOUT = 30_000;

const SKIPPED_WRAPPERS = ['addEventListener', 'removeEventListener', 'destroy'] as const;
type SkippedWrapper = (typeof SKIPPED_WRAPPERS)[number];

function ytCallbackToEventName(cb: string): string {
  return cb.replace(/^on/, '').toLowerCase();
}

function buildDetail(name: string, payload: unknown): unknown {
  const data = (payload as { data?: unknown })?.data;
  switch (name) {
    case 'statechange':
      return { state: data };
    case 'playbackqualitychange':
      return { quality: data };
    case 'playbackratechange':
      return { rate: data };
    case 'error': {
      const code = typeof data === 'number' ? data : Number(data);
      return { code, message: youTubeErrorMessageFor(code) };
    }
    case 'ready':
      return payload;
    default:
      return { data };
  }
}

// Typed against the generated FunctionName so a regenerated rename surfaces as a TS error here.
const METHOD_TARGET_STATES: Readonly<Partial<Record<FunctionName, readonly PlayerStateCode[]>>> = {
  playVideo: [PlayerState.PLAYING],
  pauseVideo: [PlayerState.PAUSED],
  stopVideo: [PlayerState.ENDED, PlayerState.CUED],
  seekTo: [PlayerState.PLAYING, PlayerState.PAUSED, PlayerState.CUED, PlayerState.ENDED],
  loadVideoById: [PlayerState.PLAYING],
  loadVideoByUrl: [PlayerState.PLAYING],
  cueVideoById: [PlayerState.CUED],
  cueVideoByUrl: [PlayerState.CUED],
  loadPlaylist: [PlayerState.PLAYING],
  cuePlaylist: [PlayerState.CUED],
  nextVideo: [PlayerState.PLAYING],
  previousVideo: [PlayerState.PLAYING],
  playVideoAt: [PlayerState.PLAYING],
};

type Pending = {
  run: () => void;
  reject: (e: unknown) => void;
};

const DEFAULT_POLLING_INTERVAL = 250;

interface TickSubscriber {
  readonly intervalMs: number;
  readonly fn: () => void;
  elapsed: number;
}

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface-class merge for generated method wrappers.
export class YTEmbed extends EventTarget {
  readonly #targetSpec: HTMLElement | string;
  // Resolved during #initialise() once we know we are in a browser. May be the user-supplied
  // element (default) or an internal wrapper div (when options.isolate is true).
  #element: HTMLElement | null = null;
  #wrapperElement: HTMLElement | null = null;
  readonly #options: YTEmbedOptions;
  #destroyed = false;
  #state: PlayerStateCode = -1;
  #readyResolved = false;

  readonly #readyPromise: Promise<void>;
  #resolveReady: (() => void) | null = null;
  #rejectReady: ((err: unknown) => void) | null = null;
  #player: YT.Player | null = null;

  readonly #queue: Pending[] = [];

  readonly #listenerTracker: ListenerTracker;
  readonly #attachedExtensions = new Map<number, () => void>();
  #onCallerAbort: (() => void) | null = null;

  readonly #tickSubscribers = new Set<TickSubscriber>();
  #tickTimer: ReturnType<typeof setInterval> | null = null;
  // Cleared at the start of each tick; coalesces in-flight wrapper reads
  // (getCurrentTime, getDuration, getVideoLoadedFraction, …) so multiple
  // polling extensions sharing the same tick only trigger one IPC per method.
  readonly #tickReadCache = new Map<string, Promise<unknown>>();

  constructor(target: HTMLElement | string, options: YTEmbedOptions) {
    super();
    this.#targetSpec = target;
    this.#options = options;

    // The no-op .catch() prevents unhandled-rejection warnings when the instance is destroyed
    // without anyone awaiting whenReady(). Callers who do await it still see the rejection.
    this.#readyPromise = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    this.#readyPromise.catch(() => {});

    this.#listenerTracker = new ListenerTracker({
      onFirstAdd: (type) => this.#maybeAttachExtensionsFor(type),
      onLastRemove: (type) => this.#maybeDetachExtensionsFor(type),
    });

    if (options.signal) {
      if (options.signal.aborted) {
        this.#destroyed = true;
        // biome-ignore lint/style/noNonNullAssertion: set synchronously in Promise ctor above.
        this.#rejectReady!(new PlayerDestroyedError('Destroyed before ready'));
        return;
      }
      this.#onCallerAbort = () => this.destroy();
      options.signal.addEventListener('abort', this.#onCallerAbort, { once: true });
    }

    void this.#initialise();
  }

  get destroyed(): boolean {
    return this.#destroyed;
  }

  get ready(): boolean {
    return this.#readyResolved;
  }

  get state(): PlayerStateCode {
    return this.#state;
  }

  get iframe(): HTMLIFrameElement | null {
    return this.#element?.querySelector('iframe') ?? null;
  }

  whenReady(): Promise<void> {
    return this.#readyPromise;
  }

  /**
   * Subscribe to the shared polling ticker. The fn runs roughly every `intervalMs` ms,
   * snapped to the player's `pollingIntervalMs` base cadence. Returns an unsubscribe
   * function. The shared timer auto-starts on first subscriber and stops when the last
   * one leaves. `intervalMs` is rounded up to a multiple of the base; values smaller
   * than the base fire every base tick.
   */
  tick(fn: () => void, intervalMs?: number): () => void {
    const base = this.#options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL;
    const sub: TickSubscriber = {
      intervalMs: Math.max(intervalMs ?? base, base),
      fn,
      elapsed: 0,
    };
    this.#tickSubscribers.add(sub);
    this.#ensureTickRunning();
    return () => {
      this.#tickSubscribers.delete(sub);
      if (this.#tickSubscribers.size === 0 && this.#tickTimer) {
        clearInterval(this.#tickTimer);
        this.#tickTimer = null;
      }
    };
  }

  #ensureTickRunning(): void {
    if (this.#tickTimer) return;
    if (this.#destroyed) return;
    const base = this.#options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL;
    this.#tickTimer = setInterval(() => {
      // Reset the per-tick read cache so the first `tickRead(method)` of this
      // tick triggers a fresh wrapper call; subsequent calls share the same
      // promise.
      this.#tickReadCache.clear();
      // Snapshot the iteration so a subscriber unsubscribing inside its own fn
      // doesn't perturb the loop.
      for (const sub of [...this.#tickSubscribers]) {
        sub.elapsed += base;
        if (sub.elapsed >= sub.intervalMs) {
          sub.elapsed = 0;
          try {
            sub.fn();
          } catch {
            // Swallow to keep the shared loop alive; subscribers are expected to handle their own errors.
          }
        }
      }
    }, base);
  }

  /**
   * Read a wrapper method through a per-tick cache. Multiple subscribers can
   * call `tickRead('getCurrentTime')` in the same tick and share one in-flight
   * promise. Useful for polling extensions that all need `getCurrentTime`,
   * `getDuration`, etc. — one IPC per method per tick instead of N.
   */
  tickRead<T = unknown>(method: string): Promise<T> {
    const cached = this.#tickReadCache.get(method);
    if (cached) return cached as Promise<T>;
    const promise = (this as unknown as { call: (m: string) => Promise<unknown> }).call(method);
    this.#tickReadCache.set(method, promise);
    return promise as Promise<T>;
  }

  #stopTick(): void {
    if (this.#tickTimer) {
      clearInterval(this.#tickTimer);
      this.#tickTimer = null;
    }
    this.#tickSubscribers.clear();
  }

  override addEventListener<K extends keyof YTEmbedEventMap>(
    type: K,
    listener: (ev: YTEmbedEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void;
  override addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((ev: Event) => void) | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
    if (listener != null) this.#listenerTracker.add(type);
  }

  override removeEventListener<K extends keyof YTEmbedEventMap>(
    type: K,
    listener: (ev: YTEmbedEventMap[K]) => void,
    options?: EventListenerOptions | boolean,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void;
  override removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | ((ev: Event) => void) | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type, listener as EventListenerOrEventListenerObject | null, options);
    if (listener != null) this.#listenerTracker.remove(type);
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    if (this.#onCallerAbort && this.#options.signal) {
      this.#options.signal.removeEventListener('abort', this.#onCallerAbort);
      this.#onCallerAbort = null;
    }
    if (!this.#readyResolved) {
      this.#rejectReady?.(new PlayerDestroyedError('Destroyed before ready'));
    }
    while (this.#queue.length) {
      this.#queue.shift()?.reject(new PlayerDestroyedError('Player destroyed'));
    }
    for (const detach of this.#attachedExtensions.values()) detach();
    this.#attachedExtensions.clear();
    this.#stopTick();

    this.#player?.destroy();
    this.#player = null;

    if (this.#wrapperElement?.parentNode) {
      this.#wrapperElement.parentNode.removeChild(this.#wrapperElement);
    }
    this.#wrapperElement = null;
    this.#element = null;
  }

  call<K extends FunctionName>(method: K, ...args: unknown[]): Promise<unknown> {
    return this.#exec(method as string, args);
  }

  #exec(method: string, rawArgs: unknown[]): Promise<unknown> {
    // Detect trailing MethodCallOptions: last arg is a non-array object with awaitState or signal.
    const lastArg = rawArgs[rawArgs.length - 1];
    const hasOptions =
      lastArg !== null &&
      lastArg !== undefined &&
      typeof lastArg === 'object' &&
      !Array.isArray(lastArg) &&
      ('awaitState' in (lastArg as object) || 'signal' in (lastArg as object));

    const options = hasOptions ? (rawArgs.pop() as MethodCallOptions) : undefined;

    return new Promise((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(options.signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
      }

      let onState: ((event: Event) => void) | null = null;
      const cleanup = () => {
        if (onState) this.removeEventListener('statechange', onState);
        if (options?.signal && onAbort) options.signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(options?.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      options?.signal?.addEventListener('abort', onAbort, { once: true });

      const run = () => {
        if (this.#destroyed) {
          cleanup();
          reject(new PlayerDestroyedError('Player destroyed before call'));
          return;
        }
        try {
          // biome-ignore lint/suspicious/noExplicitAny: dynamic YT.Player method dispatch.
          const player = this.#player as any;
          const result = player[method]?.(...rawArgs);
          if (options?.awaitState) {
            const targets = METHOD_TARGET_STATES[method as FunctionName];
            onState = targets
              ? (event: Event) => {
                  const ce = event as CustomEvent<{ state: PlayerStateCode }>;
                  if (!targets.includes(ce.detail.state)) return;
                  cleanup();
                  resolve(result);
                }
              : () => {
                  cleanup();
                  resolve(result);
                };
            this.addEventListener('statechange', onState);
          } else {
            cleanup();
            resolve(result);
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      if (this.#readyResolved) {
        run();
      } else {
        this.#queue.push({ run, reject });
      }
    });
  }

  #flushQueue(): void {
    while (this.#queue.length) {
      const next = this.#queue.shift();
      next?.run();
    }
  }

  #attachEagerExtensions(): void {
    const exts = this.#options.extensions ?? [];
    exts.forEach((ext, i) => {
      if (!ext.eager) return;
      if (this.#attachedExtensions.has(i)) return;
      const detach = ext.attach(this);
      this.#attachedExtensions.set(i, detach);
    });
  }

  #maybeAttachExtensionsFor(type: string): void {
    const exts = this.#options.extensions ?? [];
    exts.forEach((ext, i) => {
      if (this.#attachedExtensions.has(i)) return;
      if (!ext.events.includes(type)) return;
      const detach = ext.attach(this);
      this.#attachedExtensions.set(i, detach);
    });
  }

  #maybeDetachExtensionsFor(type: string): void {
    const exts = this.#options.extensions ?? [];
    exts.forEach((ext, i) => {
      if (!this.#attachedExtensions.has(i)) return;
      if (!ext.events.includes(type)) return;
      // Keep the extension attached if any of its other events still has listeners.
      const stillSubscribed = ext.events.some((e) => this.#listenerTracker.count(e) > 0);
      if (stillSubscribed) return;
      const detach = this.#attachedExtensions.get(i);
      detach?.();
      this.#attachedExtensions.delete(i);
    });
  }

  #resolveTarget(): HTMLElement {
    if (typeof document === 'undefined') {
      throw new EnvironmentError(
        'YTEmbed requires a browser environment with `document` available.',
      );
    }
    const userElement =
      typeof this.#targetSpec === 'string'
        ? document.getElementById(this.#targetSpec)
        : this.#targetSpec;
    if (!userElement) {
      const id = typeof this.#targetSpec === 'string' ? `'${this.#targetSpec}'` : 'reference';
      throw new TypeError(`YTEmbed: target element ${id} not found`);
    }

    if (this.#options.isolate) {
      const wrapper = document.createElement('div');
      userElement.appendChild(wrapper);
      this.#wrapperElement = wrapper;
      return wrapper;
    }
    return userElement;
  }

  async #initialise(): Promise<void> {
    try {
      this.#element = this.#resolveTarget();

      const YTApi = await loadIframeApi();

      if (this.#destroyed) return;

      const timeout = this.#options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT;
      const timer = setTimeout(() => {
        this.#rejectReady?.(new PlayerInitError(`Player did not become ready within ${timeout}ms`));
      }, timeout);

      const events: Record<string, (e: unknown) => void> = {};
      for (const cb of eventCallbackNames) {
        const eventName = ytCallbackToEventName(cb);
        if (eventName === 'ready') continue;
        events[cb] = (payload) => {
          if (eventName === 'statechange') {
            const data = (payload as { data?: number }).data;
            if (typeof data === 'number') this.#state = data as PlayerStateCode;
          }
          const detail = buildDetail(eventName, payload);
          this.dispatchEvent(new CustomEvent(eventName, { detail }));
        };
      }

      events.onReady = () => {
        clearTimeout(timer);
        this.#readyResolved = true;
        this.dispatchEvent(new CustomEvent('ready', { detail: { player: this } }));
        this.#resolveReady?.();
        this.#flushQueue();
        this.#attachEagerExtensions();
      };

      // Omit undefined values to satisfy exactOptionalPropertyTypes.
      const playerOptions: YT.PlayerOptions = {
        events,
        ...(this.#options.videoId !== undefined && { videoId: this.#options.videoId }),
        ...(this.#options.width !== undefined && { width: this.#options.width }),
        ...(this.#options.height !== undefined && { height: this.#options.height }),
        ...(this.#options.playerVars !== undefined && { playerVars: this.#options.playerVars }),
        ...(this.#options.privacyMode === 'enhanced' && {
          host: 'https://www.youtube-nocookie.com',
        }),
      };

      this.#player = new YTApi.Player(this.#element, playerOptions);
    } catch (err) {
      this.#rejectReady?.(err);
    }
  }
}

// Install generated method wrappers on the prototype, skipping names handled directly on the class.
for (const name of functionNames) {
  if ((SKIPPED_WRAPPERS as readonly string[]).includes(name)) continue;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic prototype install.
  (YTEmbed.prototype as any)[name] = function (this: YTEmbed, ...args: unknown[]) {
    return (this as unknown as { call: (m: string, ...a: unknown[]) => Promise<unknown> }).call(
      name,
      ...args,
    );
  };
}

// Declaration merging so player.playVideo() etc. typecheck.
// Each wrapper inherits the underlying YT.Player method signature, returns a
// Promise of its result, and accepts an optional trailing MethodCallOptions arg.
// Overloaded methods (e.g. seekTo, loadVideoById) collapse to the last overload —
// a known TS limitation when inferring through a generic Promisify.
type WrappableName = Exclude<FunctionName, SkippedWrapper>;

type Promisify<T> = T extends (...args: infer A) => infer R
  ? (...args: [...A, MethodCallOptions?]) => Promise<Awaited<R>>
  : never;

type WrappedPlayer = {
  [K in WrappableName]: K extends keyof YT.Player ? Promisify<YT.Player[K]> : never;
};

// Optional methods installed on the player by side-effect extensions. They are
// declared optional because the extension that owns each method may not be
// loaded in a given consumer's bundle. Extensions add these only after attach
// and `delete` them on detach.
//
// Declared on the canonical interface (rather than via per-extension module
// augmentation) because tsdown bundles all .d.ts into a single file, which
// makes relative-path module augmentation unreliable — the same pattern used
// for `YTEmbedEventMap` entries in `src/types.ts`.
interface ExtensionAugmentedMethods {
  // fullscreenExtension
  enterFullscreen?: () => Promise<void>;
  exitFullscreen?: () => Promise<void>;
  toggleFullscreen?: () => Promise<void>;
  // pictureInPictureExtension
  enterPictureInPicture?: () => Promise<void>;
  exitPictureInPicture?: () => Promise<void>;
  togglePictureInPicture?: () => Promise<void>;
  // captionsLanguageExtension
  setCaptionsLanguage?: (languageCode: string | null) => Promise<void>;
}

export interface YTEmbed extends WrappedPlayer, ExtensionAugmentedMethods {}
