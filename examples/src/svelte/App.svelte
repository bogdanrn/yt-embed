<script lang="ts">
  import { YTEmbed, volumeChangeExtension, type PlayerStateCode } from '@bogdanrn/yt-embed';

  let el: HTMLDivElement;
  let state = $state<PlayerStateCode>(-1);
  let volume = $state(0);

  $effect(() => {
    if (!el) return;
    const player = new YTEmbed(el, {
      videoId: 'M7lc1UVf-VE',
      extensions: [volumeChangeExtension()],
    });
    player.addEventListener('statechange', (e) => (state = e.detail.state));
    player.addEventListener('volumechange', (e) => (volume = e.detail.volume));
    return () => player.destroy();
  });
</script>

<div bind:this={el}></div>
<p>state: {state}</p>
<p>volume: {volume}</p>
