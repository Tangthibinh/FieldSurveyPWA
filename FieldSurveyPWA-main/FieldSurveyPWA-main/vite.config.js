import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const root = resolve(__dirname);

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    closeBundle() {
      const outputDir = resolve(root, 'dist');
      for (const file of ['questions.md', 'vku_facility_inspection_data.csv', 'sw.js', 'favicon.ico']) {
        copyFileSync(resolve(root, file), resolve(outputDir, file));
      }
      cpSync(resolve(root, 'icons'), resolve(outputDir, 'icons'), { recursive: true });
      mkdirSync(resolve(outputDir, 'icons'), { recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [copyRuntimeAssets()]
});
