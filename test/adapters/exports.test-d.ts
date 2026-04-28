import { expectTypeOf, test } from 'vitest';
import type { UseYTEmbedResult as ReactUseYTEmbedResult } from '../../src/react/index.js';
import { useYTEmbed as useYTEmbedReact } from '../../src/react/index.js';
import type { CreateYTEmbedResult } from '../../src/svelte/index.js';
import { createYTEmbed } from '../../src/svelte/index.js';
import type { UseYTEmbedResult as VueUseYTEmbedResult } from '../../src/vue/index.js';
import { useYTEmbed as useYTEmbedVue } from '../../src/vue/index.js';

test('react adapter exports useYTEmbed with the documented result shape', () => {
  expectTypeOf(useYTEmbedReact).parameter(0).toEqualTypeOf<string>();
  expectTypeOf<ReactUseYTEmbedResult['ready']>().toEqualTypeOf<boolean>();
  expectTypeOf<ReactUseYTEmbedResult['currentTime']>().toEqualTypeOf<number>();
  expectTypeOf<ReactUseYTEmbedResult['duration']>().toEqualTypeOf<number>();
  expectTypeOf<ReactUseYTEmbedResult['isPlaying']>().toEqualTypeOf<boolean>();
});

test('vue adapter exports useYTEmbed with reactive refs', () => {
  expectTypeOf(useYTEmbedVue).toBeFunction();
  expectTypeOf<VueUseYTEmbedResult['ready']['value']>().toEqualTypeOf<boolean>();
  expectTypeOf<VueUseYTEmbedResult['currentTime']['value']>().toEqualTypeOf<number>();
});

test('svelte adapter exports createYTEmbed with subscribable stores', () => {
  expectTypeOf(createYTEmbed).toBeFunction();
  expectTypeOf<CreateYTEmbedResult['ready']['subscribe']>().toBeFunction();
  expectTypeOf<CreateYTEmbedResult['attach']>().parameter(0).toEqualTypeOf<HTMLElement>();
});
