import type { PlayerStateCode } from '../playerState.js';
import { PlayerState } from '../playerState.js';
import type { YTEmbed } from '../YTEmbed.js';
import type { Extension } from './types.js';

export interface MediaSessionExtensionOptions {
  /** Override metadata fields. Otherwise pulled from getVideoData(). */
  metadata?: Partial<Pick<MediaMetadataInit, 'title' | 'artist' | 'album' | 'artwork'>>;
}

interface VideoDataReader {
  getVideoData: () => Promise<{ video_id: string; title: string; author: string }>;
  playVideo: () => Promise<void>;
  pauseVideo: () => Promise<void>;
  seekTo: (time: number, allowSeekAhead: boolean) => Promise<void>;
  previousVideo: () => Promise<void>;
  nextVideo: () => Promise<void>;
}

/**
 * Wires `navigator.mediaSession` so OS media keys, lock-screen controls, and
 * the macOS Now Playing widget can drive the player. Eager-attached.
 */
export function mediaSessionExtension(options: MediaSessionExtensionOptions = {}): Extension {
  return {
    events: ['mediasessionupdate'],
    eager: true,
    attach(player: YTEmbed): () => void {
      if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
        return () => {};
      }
      const ms = navigator.mediaSession;
      const cap = player as unknown as VideoDataReader;
      let detached = false;

      const refresh = async () => {
        if (detached) return;
        try {
          const data = await cap.getVideoData();
          if (detached) return;
          ms.metadata = new MediaMetadata({
            title: options.metadata?.title ?? data.title,
            artist: options.metadata?.artist ?? data.author,
            ...(options.metadata?.album !== undefined && { album: options.metadata.album }),
            artwork: options.metadata?.artwork ?? [
              {
                src: `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`,
                sizes: '480x360',
                type: 'image/jpeg',
              },
            ],
          });
          player.dispatchEvent(
            new CustomEvent('mediasessionupdate', { detail: { metadata: ms.metadata } }),
          );
        } catch {
          // getVideoData() may throw before the player has data; ignore.
        }
      };

      const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
        ['play', () => void cap.playVideo()],
        ['pause', () => void cap.pauseVideo()],
        [
          'seekto',
          (details) => {
            if (details.seekTime !== undefined) {
              void cap.seekTo(details.seekTime, true);
            }
          },
        ],
        ['previoustrack', () => void cap.previousVideo()],
        ['nexttrack', () => void cap.nextVideo()],
      ];
      for (const [action, handler] of handlers) {
        try {
          ms.setActionHandler(action, handler);
        } catch {
          // Action unsupported on this platform — skip.
        }
      }

      const onStateChange = (e: Event) => {
        const ce = e as CustomEvent<{ state: PlayerStateCode }>;
        ms.playbackState =
          ce.detail.state === PlayerState.PLAYING
            ? 'playing'
            : ce.detail.state === PlayerState.PAUSED
              ? 'paused'
              : 'none';
      };
      player.addEventListener('statechange', onStateChange);

      void refresh();

      return () => {
        detached = true;
        player.removeEventListener('statechange', onStateChange);
        for (const [action] of handlers) {
          try {
            ms.setActionHandler(action, null);
          } catch {
            // Same compatibility quirk as above.
          }
        }
        ms.metadata = null;
        ms.playbackState = 'none';
      };
    },
  };
}
