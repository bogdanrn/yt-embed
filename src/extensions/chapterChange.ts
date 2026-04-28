import type { YTEmbed } from '../YTEmbed.js';
import { cuePointExtension } from './cuePoint.js';
import type { Extension } from './types.js';

export interface Chapter {
  readonly time: number;
  readonly title: string;
}

export interface ChapterChangeExtensionOptions {
  readonly chapters: readonly Chapter[];
  /** Polling interval in ms. Default: 250. */
  readonly intervalMs?: number;
}

// Branding the payload prevents collisions with consumer-registered cuePointExtension
// instances that may run alongside this one and emit their own `cuepoint` events.
const CHAPTER_MARKER = Symbol.for('@bogdanrn/yt-embed/chapterChange');

interface ChapterPayload {
  readonly [CHAPTER_MARKER]: true;
  readonly title: string;
  readonly chapterIndex: number;
}

interface CuePointDetail {
  time: number;
  payload: unknown;
  index: number;
}

function isChapterPayload(value: unknown): value is ChapterPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[CHAPTER_MARKER] === true
  );
}

/**
 * Thin shell around `cuePointExtension`: declares chapters as `{time, title}`
 * pairs, re-emits crossing as `chapterchange`. Lazy-attached. The cuepoint
 * payload carries an internal symbol marker so it does not collide with other
 * `cuePointExtension` instances active on the same player.
 */
export function chapterChangeExtension(options: ChapterChangeExtensionOptions): Extension {
  const cues = options.chapters.map((c, i) => ({
    time: c.time,
    payload: {
      [CHAPTER_MARKER]: true as const,
      title: c.title,
      chapterIndex: i,
    } satisfies ChapterPayload,
  }));
  const inner = cuePointExtension<ChapterPayload>(
    options.intervalMs !== undefined ? { cues, intervalMs: options.intervalMs } : { cues },
  );

  return {
    events: ['chapterchange'],
    attach(player: YTEmbed): () => void {
      const onCue = (e: Event) => {
        const ce = e as CustomEvent<CuePointDetail>;
        if (!isChapterPayload(ce.detail.payload)) return;
        player.dispatchEvent(
          new CustomEvent('chapterchange', {
            detail: {
              index: ce.detail.payload.chapterIndex,
              title: ce.detail.payload.title,
              time: ce.detail.time,
            },
          }),
        );
      };
      player.addEventListener('cuepoint', onCue);
      const detachInner = inner.attach(player);
      return () => {
        player.removeEventListener('cuepoint', onCue);
        detachInner();
      };
    },
  };
}
