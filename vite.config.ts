import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'omnibattery-cards.js' },
    target: 'es2022', sourcemap: false,
    rolldownOptions: { output: { banner: `/*! Omnibattery Cards — AGPL-3.0-or-later\nSource: https://github.com/thomasvt1/omnibattery-cards\n\nBundled Lit libraries:\n${readFileSync(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8')}\n*/` } },
  },
});
