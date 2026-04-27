#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'node:fs';

function stripGenHeaders(content: string): string {
  return content
    .split('\n')
    .filter((l) => !l.startsWith('<!-- AUTO-GENERATED'))
    .filter((l) => !l.startsWith('<!-- Regenerate'))
    .join('\n')
    .trim();
}

// String-based replacement (no dynamic RegExp) so the script is ReDoS-free.
function inject(readme: string, marker: 'methods' | 'events', contentPath: string): string {
  const content = stripGenHeaders(readFileSync(contentPath, 'utf8'));
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const startIdx = readme.indexOf(start);
  const endIdx = readme.indexOf(end, startIdx + start.length);
  if (startIdx < 0 || endIdx < 0) {
    throw new Error(`README missing ${start} … ${end} markers`);
  }
  return readme.slice(0, startIdx) + start + '\n' + content + '\n' + readme.slice(endIdx);
}

let readme = readFileSync('README.md', 'utf8');
readme = inject(readme, 'methods', 'docs/methods.md');
readme = inject(readme, 'events', 'docs/events.md');
writeFileSync('README.md', readme);
console.log('README updated.');
