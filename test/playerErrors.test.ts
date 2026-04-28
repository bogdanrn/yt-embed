import { describe, expect, it } from 'vitest';
import { YouTubeErrorCode, youTubeErrorMessageFor } from '../src/index.js';

describe('YouTubeErrorCode', () => {
  it('exposes the documented YouTube error codes', () => {
    expect(YouTubeErrorCode.InvalidParam).toBe(2);
    expect(YouTubeErrorCode.Html5Error).toBe(5);
    expect(YouTubeErrorCode.VideoNotFound).toBe(100);
    expect(YouTubeErrorCode.EmbeddingNotAllowed).toBe(101);
    expect(YouTubeErrorCode.EmbeddingNotAllowed2).toBe(150);
  });

  it('maps each code to a non-empty readable message', () => {
    for (const code of [2, 5, 100, 101, 150] as const) {
      const msg = youTubeErrorMessageFor(code);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(/^YT error/); // known codes get the readable message, not the fallback
    }
  });

  it('falls back to a "YT error N" string for unknown codes', () => {
    expect(youTubeErrorMessageFor(999)).toBe('YT error 999');
  });

  it('returns the canonical readable message for known codes', () => {
    expect(youTubeErrorMessageFor(100)).toMatch(/not found/i);
    expect(youTubeErrorMessageFor(101)).toMatch(/embedding is disabled/i);
  });
});
