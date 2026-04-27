import {
  PlayerState,
  type PlayerStateCode,
  volumeChangeExtension,
  YTEmbed,
} from '@bogdanrn/yt-embed';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

function YouTube({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PlayerStateCode>(-1);
  const [volume, setVolume] = useState<number>(0);

  useEffect(() => {
    if (!ref.current) return;
    const ac = new AbortController();
    const player = new YTEmbed(ref.current, {
      videoId,
      signal: ac.signal,
      extensions: [volumeChangeExtension()],
    });
    player.addEventListener('statechange', (e) => setState(e.detail.state), {
      signal: ac.signal,
    });
    player.addEventListener('volumechange', (e) => setVolume(e.detail.volume), {
      signal: ac.signal,
    });
    return () => {
      ac.abort();
      player.destroy();
    };
  }, [videoId]);

  return (
    <div>
      <div ref={ref} />
      <p>
        state: {state} (PLAYING={PlayerState.PLAYING})
      </p>
      <p>volume: {volume}</p>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <YouTube videoId="M7lc1UVf-VE" />
    </StrictMode>,
  );
}
