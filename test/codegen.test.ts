import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('codegen drift guard', () => {
  it('committed generated files match a fresh run', () => {
    execSync('pnpm generate', { stdio: 'pipe' });
    const status = execSync(
      'git diff --name-only -- src/functionNames.generated.ts src/eventCallbackNames.generated.ts docs/methods.md docs/events.md',
      { encoding: 'utf8' },
    ).trim();
    expect(status, 'generated files drifted; run `pnpm generate` and commit').toBe('');
  });
});
