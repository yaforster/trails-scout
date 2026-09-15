/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
// @ts-ignore
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/popup/types.ts'],
    },
  },
});
