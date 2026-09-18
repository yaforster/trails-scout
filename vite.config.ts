/// <reference types="vitest/config" />

import { defineConfig, type Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
// @ts-ignore
import chromeManifest from './manifest.json';
// @ts-ignore
import firefoxManifest from './manifest.firefox.json';

type CrxManifestPlugin = Plugin & {
  renderCrxManifest(manifest: { side_panel?: unknown }): { side_panel?: unknown };
};

const firefoxManifestPlugin: CrxManifestPlugin = {
  name: 'remove-firefox-side-panel',
  renderCrxManifest(manifest) {
    delete manifest.side_panel;
    return manifest;
  },
};

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';

  return {
    plugins: [
      crx({ manifest: firefox ? firefoxManifest : chromeManifest }),
      ...(firefox ? [firefoxManifestPlugin] : []),
    ],
    build: {
      outDir: firefox ? 'dist-firefox' : 'dist',
    },
    test: {
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.spec.ts', 'src/popup/types.ts'],
      },
    },
  };
});
