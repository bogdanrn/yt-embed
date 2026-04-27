export interface ListenerTrackerHooks {
  onFirstAdd: (type: string) => void;
  onLastRemove: (type: string) => void;
}

export class ListenerTracker {
  readonly #counts = new Map<string, number>();
  readonly #hooks: ListenerTrackerHooks;

  constructor(hooks: ListenerTrackerHooks) {
    this.#hooks = hooks;
  }

  add(type: string): void {
    const next = (this.#counts.get(type) ?? 0) + 1;
    this.#counts.set(type, next);
    if (next === 1) this.#hooks.onFirstAdd(type);
  }

  remove(type: string): void {
    const current = this.#counts.get(type) ?? 0;
    if (current <= 0) return;
    const next = current - 1;
    if (next === 0) {
      this.#counts.delete(type);
      this.#hooks.onLastRemove(type);
    } else {
      this.#counts.set(type, next);
    }
  }

  count(type: string): number {
    return this.#counts.get(type) ?? 0;
  }
}
