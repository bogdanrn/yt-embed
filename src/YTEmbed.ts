import type * as YT from 'youtube';
import { PlayerDestroyedError, PlayerInitError } from './errors.js';
import { eventCallbackNames } from './eventCallbackNames.generated.js';
import { type FunctionName, functionNames } from './functionNames.generated.js';
import { ListenerTracker } from './listenerTracker.js';
import { loadIframeApi } from './loadIframeApi.js';
import type { PlayerStateCode } from './playerState.js';
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
    case 'error':
      return { code: data, message: `YT error ${data}` };
    case 'ready':
      return payload;
    default:
      return { data };
  }
}

type Pending = {
  run: () => void;
  reject: (e: unknown) => void;
};

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface-class merge for generated method wrappers.
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

  readonly #queue: Pending[] = [];

  readonly #listenerTracker: ListenerTracker;
  readonly #attachedExtensions = new Map<number, () => void>();
  #onCallerAbort: (() => void) | null = null;

  constructor(target: HTMLElement | string, options: YTEmbedOptions) {
    super();
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) {
      throw new TypeError('YTEmbed: target element not found');
    }
    this.#element = element;
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

  get state(): PlayerStateCode {
    return this.#state;
  }

  get iframe(): HTMLIFrameElement | null {
    return this.#element.querySelector('iframe');
  }

  whenReady(): Promise<void> {
    return this.#readyPromise;
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

    this.#player?.destroy();
    this.#player = null;
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

      let onState: (() => void) | null = null;
      const cleanup = () => {
        if (onState) this.removeEventListener('statechange', onState as EventListener);
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
            onState = () => {
              cleanup();
              resolve(result);
            };
            this.addEventListener('statechange', onState as EventListener);
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

  async #initialise(): Promise<void> {
    try {
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
      };

      // Omit undefined values to satisfy exactOptionalPropertyTypes.
      const playerOptions: YT.PlayerOptions = {
        events,
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

// Install generated method wrappers on the prototype, skipping names with incompatible signatures.
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
type WrappableName = Exclude<FunctionName, SkippedWrapper>;
// biome-ignore lint/suspicious/noExplicitAny: dynamic mapped methods from generated list.
export interface YTEmbed extends Record<WrappableName, (...args: any[]) => Promise<unknown>> {}
