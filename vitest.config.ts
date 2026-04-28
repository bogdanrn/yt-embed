import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Two-project setup:
    //   • default (jsdom) — fast unit tests for everything that doesn't need a real browser API.
    //   • browser — real Chromium via Playwright for fullscreen, picture-in-picture,
    //     IntersectionObserver, mediaSession, and other browser-only surfaces.
    // Run jsdom only: `pnpm test`.
    // Run browser only: `pnpm test:browser`.
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: false,
          include: ['test/**/*.test.ts'],
          exclude: ['test/browser/**'],
          typecheck: {
            tsconfig: './tsconfig.json',
            include: ['test/**/*.test-d.ts'],
          },
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            // biome-ignore lint/suspicious/noExplicitAny: vitest 4 provider types are stricter than the runtime.
            provider: 'playwright' as any,
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.generated.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
