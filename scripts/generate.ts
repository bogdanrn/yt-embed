#!/usr/bin/env tsx
import { writeFileSync } from 'node:fs';
import { Project } from 'ts-morph';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });

// @types/youtube declares a global `declare namespace YT { ... }`.
// ts-morph only pre-loads files matched by tsconfig "include"; we must add
// the ambient declaration file explicitly so getModules() finds it.
project.addSourceFileAtPath(
  'node_modules/@types/youtube/index.d.ts',
);

const ytNamespace = project.getSourceFiles()
  .flatMap((f) => f.getModules())
  .find((m) => m.getName() === 'YT');

if (!ytNamespace) {
  throw new Error(
    'YT global namespace not found. Is @types/youtube installed and listed in tsconfig "types"?',
  );
}

// YT.Player is a class in @types/youtube (not an interface).
const playerClass = ytNamespace.getClass('Player');
if (!playerClass) {
  throw new Error('Class YT.Player not found in @types/youtube');
}

// Deduplicate overloaded method names with Set, then sort.
const methodNames = [
  ...new Set(playerClass.getMethods().map((m) => m.getName())),
].sort();

writeFileSync(
  'src/functionNames.generated.ts',
  `// AUTO-GENERATED from @types/youtube. Do not edit.\n` +
    `// Regenerate with \`pnpm generate\`.\n\n` +
    `export const functionNames = ${JSON.stringify(methodNames, null, 2)} as const;\n\n` +
    `export type FunctionName = (typeof functionNames)[number];\n`,
);

console.log(`Wrote src/functionNames.generated.ts (${methodNames.length} methods)`);
