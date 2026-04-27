import type * as YT from 'youtube';
import { PlayerDestroyedError, PlayerInitError } from './errors.js';
import { eventCallbackNames } from './eventCallbackNames.generated.js';
import { type FunctionName, functionNames } from './functionNames.generated.js';
import { ListenerTracker } from './listenerTracker.js';
import { loadIframeApi } from './loadIframeApi.js';
import type { PlayerStateCode } from './playerState.js';
import type { MethodCallOptions, YTEmbedEventMap, YTEmbedOptions } from './types.js';

const DEFAULT_INIT_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Module-private helpers for event re-emission (Task 4.6)
// ---------------------------------------------------------------------------

function ytCallbackToEventName(cb: string): string {
  // onStateChange → statechange
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
      // Ready is special — caller passes the player reference.
      return payload;
    default:
      return { data };
  }
}

// ---------------------------------------------------------------------------
// Pending queue entry (Task 4.7)
// ---------------------------------------------------------------------------

type Pending = {
  run: () => void;
  reject: (e: unknown) => void;
};

// ---------------------------------------------------------------------------
// Main class
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: intentional interface-class merge for generated method wrappers (Task 4.8).
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

  // Task 4.7: exec queue
  readonly #queue: Pending[] = [];

  // Task 4.9: extension tracking
  readonly #listenerTracker: ListenerTracker;
  readonly #attachedExtensions = new Map<number, () => void>();

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

    // Task 4.9: set up listener tracker for extension lazy attach/detach
    this.#listenerTracker = new ListenerTracker({
      onFirstAdd: (type) => this.#maybeAttachExtensionsFor(type),
      onLastRemove: (type) => this.#maybeDetachExtensionsFor(type),
    });

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

  // Typed overload — autocomplete for YTEmbedEventMap event names.
  override addEventListener<K extends keyof YTEmbedEventMap>(
    type: K,
    listener: (ev: YTEmbedEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  // Fallback — accepts arbitrary string for events not yet listed in the map.
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
    if (!this.#readyResolved) {
      this.#rejectReady?.(new PlayerDestroyedError('Destroyed before ready'));
    }
    // Task 4.7: reject all pending queued calls
    while (this.#queue.length) {
      this.#queue.shift()?.reject(new PlayerDestroyedError('Player destroyed'));
    }
    // Task 4.9: detach all attached extensions
    for (const detach of this.#attachedExtensions.values()) detach();
    this.#attachedExtensions.clear();

    this.#player?.destroy();
    this.#player = null;
  }

  // Task 4.7: public call() method — the generic escape hatch (spec §3.7)
  call<K extends FunctionName>(method: K, ...args: unknown[]): Promise<unknown> {
    return this.#exec(method as string, args);
  }

  // Task 4.7: internal exec with queuing, awaitState, signal support
  #exec(method: string, rawArgs: unknown[]): Promise<unknown> {
    // Detect trailing MethodCallOptions: last arg is a non-array object with awaitState or signal
    const lastArg = rawArgs[rawArgs.length - 1];
    const hasOptions =
      lastArg !== null &&
      lastArg !== undefined &&
      typeof lastArg === 'object' &&
      !Array.isArray(lastArg) &&
      ('awaitState' in (lastArg as object) || 'signal' in (lastArg as object));

    const options = hasOptions ? (rawArgs.pop() as MethodCallOptions) : undefined;

    return new Promise((resolve, reject) => {
      // Throw immediately if signal is already aborted
      if (options?.signal?.aborted) {
        reject(options.signal.reason ?? new DOMException('Aborted', 'AbortError'));
        return;
      }

      const onAbort = () => {
        reject(options?.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      options?.signal?.addEventListener('abort', onAbort, { once: true });

      const run = () => {
        if (this.#destroyed) {
          options?.signal?.removeEventListener('abort', onAbort);
          reject(new PlayerDestroyedError('Player destroyed before call'));
          return;
        }
        try {
          // biome-ignore lint/suspicious/noExplicitAny: dynamic YT.Player method dispatch.
          const player = this.#player as any;
          const result = player[method]?.(...rawArgs);
          if (options?.awaitState) {
            const onState = () => {
              this.removeEventListener('statechange', onState as EventListener);
              options.signal?.removeEventListener('abort', onAbort);
              resolve(result);
            };
            this.addEventListener('statechange', onState as EventListener);
          } else {
            options?.signal?.removeEventListener('abort', onAbort);
            resolve(result);
          }
        } catch (err) {
          options?.signal?.removeEventListener('abort', onAbort);
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

  // Task 4.9: extension lazy attach/detach
  #maybeAttachExtensionsFor(type: string): void {
    const exts = this.#options.extensions ?? [];
    exts.forEach((ext, i) => {
      if (this.#attachedExtensions.has(i)) return;
      if (!ext.events.includes(type)) return;
      // biome-ignore lint/suspicious/noExplicitAny: Extension.attach takes YTEmbed but types.ts forward-declares it as unknown.
      const detach = (ext as any).attach(this) as () => void;
      this.#attachedExtensions.set(i, detach);
    });
  }

  #maybeDetachExtensionsFor(type: string): void {
    const exts = this.#options.extensions ?? [];
    exts.forEach((ext, i) => {
      if (!this.#attachedExtensions.has(i)) return;
      if (!ext.events.includes(type)) return;
      // Only detach if no other event from this extension still has listeners
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

      if (this.#destroyed) {
        // destroy() was called while we awaited the API; it already rejected.
        return;
      }

      const timeout = this.#options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT;
      const timer = setTimeout(() => {
        this.#rejectReady?.(new PlayerInitError(`Player did not become ready within ${timeout}ms`));
      }, timeout);

      // Task 4.6: build events object for all YT callbacks
      const events: Record<string, (e: unknown) => void> = {};
      for (const cb of eventCallbackNames) {
        const eventName = ytCallbackToEventName(cb);
        if (eventName === 'ready') continue; // handled separately below
        events[cb] = (payload) => {
          if (eventName === 'statechange') {
            const data = (payload as { data?: number }).data;
            if (typeof data === 'number') this.#state = data as PlayerStateCode;
          }
          const detail = buildDetail(eventName, payload);
          this.dispatchEvent(new CustomEvent(eventName, { detail }));
        };
      }

      // onReady is special: sets readyResolved, clears timer, dispatches ready, flushes queue
      events.onReady = () => {
        clearTimeout(timer);
        this.#readyResolved = true;
        this.dispatchEvent(new CustomEvent('ready', { detail: { player: this } }));
        this.#resolveReady?.();
        this.#flushQueue();
      };

      // Build YT.Player constructor options, omitting undefined values to
      // satisfy exactOptionalPropertyTypes.
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

// Task 4.8: install generated method wrappers on the prototype.
// Skip names that are already defined on the class or EventTarget with incompatible signatures.
const SKIP_WRAPPER_NAMES = new Set(['addEventListener', 'removeEventListener', 'destroy']);
for (const name of functionNames) {
  if (SKIP_WRAPPER_NAMES.has(name)) continue;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic prototype install.
  (YTEmbed.prototype as any)[name] = function (this: YTEmbed, ...args: unknown[]) {
    return (this as unknown as { call: (m: string, ...a: unknown[]) => Promise<unknown> }).call(
      name,
      ...args,
    );
  };
}

// Task 4.8: declaration merging so player.playVideo() etc. typecheck.
// Exclude names that are already defined on the class or EventTarget with incompatible signatures.
type WrappableName = Exclude<FunctionName, 'addEventListener' | 'removeEventListener' | 'destroy'>;
// biome-ignore lint/suspicious/noExplicitAny: dynamic mapped methods from generated list.
export interface YTEmbed extends Record<WrappableName, (...args: any[]) => Promise<unknown>> {}
