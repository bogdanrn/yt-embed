import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@bogdanrn/yt-embed',
  description:
    'Promise-wrapped YouTube IFrame Player API. TypeScript-first, zero runtime dependencies.',
  base: '/yt-embed/',
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/quick-start' },
      { text: 'Adapters', link: '/adapters/react' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/bogdanrn/yt-embed' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Quick start', link: '/guide/quick-start' },
            { text: 'Options reference', link: '/guide/options' },
            { text: 'Extensions', link: '/guide/extensions' },
          ],
        },
        {
          text: 'Topics',
          items: [
            { text: 'Content Security Policy', link: '/guide/csp' },
            { text: 'SSR / Next.js', link: '/guide/ssr' },
            { text: '`isolate` and host replacement', link: '/guide/isolate' },
            { text: '`awaitState` matrix', link: '/guide/await-state' },
            { text: 'Cleanup contract', link: '/guide/cleanup' },
            { text: 'Multiple concurrent players', link: '/guide/multi-player' },
          ],
        },
      ],
      '/adapters/': [
        {
          text: 'Framework adapters',
          items: [
            { text: 'React', link: '/adapters/react' },
            { text: 'Vue', link: '/adapters/vue' },
            { text: 'Svelte', link: '/adapters/svelte' },
          ],
        },
      ],
      '/api/': [{ text: 'API Reference', link: '/api/' }],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/bogdanrn/yt-embed' }],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/bogdanrn/yt-embed/edit/main/docs-site/:path',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Bogdan Radu',
    },
  },
});
