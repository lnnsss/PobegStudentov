import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

function copyPublicWithoutPng() {
  return {
    name: 'copy-public-without-png',
    closeBundle() {
      const publicDir = 'public';
      const outputDir = 'dist';

      function copyDirectory(sourceDir) {
        for (const entry of readdirSync(sourceDir)) {
          if (entry === '.DS_Store') continue;

          const sourcePath = join(sourceDir, entry);
          const targetPath = join(outputDir, relative(publicDir, sourcePath));
          const stats = statSync(sourcePath);

          if (stats.isDirectory()) {
            mkdirSync(targetPath, { recursive: true });
            copyDirectory(sourcePath);
            continue;
          }

          if (sourcePath.toLowerCase().endsWith('.png')) continue;

          mkdirSync(dirname(targetPath), { recursive: true });
          cpSync(sourcePath, targetPath);
        }
      }

      if (existsSync(publicDir)) copyDirectory(publicDir);
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [react(), copyPublicWithoutPng()],
});
