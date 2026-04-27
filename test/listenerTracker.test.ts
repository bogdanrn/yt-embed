import { describe, expect, it, vi } from 'vitest';
import { ListenerTracker } from '../src/listenerTracker.js';

describe('ListenerTracker', () => {
  it('fires onFirstAdd when count goes 0 → 1', () => {
    const onFirstAdd = vi.fn();
    const tracker = new ListenerTracker({ onFirstAdd, onLastRemove: vi.fn() });
    tracker.add('foo');
    tracker.add('foo');
    expect(onFirstAdd).toHaveBeenCalledTimes(1);
    expect(onFirstAdd).toHaveBeenCalledWith('foo');
  });

  it('fires onLastRemove when count goes 1 → 0', () => {
    const onLastRemove = vi.fn();
    const tracker = new ListenerTracker({ onFirstAdd: vi.fn(), onLastRemove });
    tracker.add('bar');
    tracker.add('bar');
    tracker.remove('bar');
    expect(onLastRemove).not.toHaveBeenCalled();
    tracker.remove('bar');
    expect(onLastRemove).toHaveBeenCalledTimes(1);
    expect(onLastRemove).toHaveBeenCalledWith('bar');
  });

  it('remove past zero is a no-op', () => {
    const onLastRemove = vi.fn();
    const tracker = new ListenerTracker({ onFirstAdd: vi.fn(), onLastRemove });
    tracker.remove('baz');
    expect(onLastRemove).not.toHaveBeenCalled();
  });
});
