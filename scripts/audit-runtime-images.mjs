import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['src', 'index.html', 'public/site.webmanifest'];
const optimizerUrlPattern = /\/_(?:next|vercel)\/image\b/;
const nextImageImportPattern = /from\s+['"]next\/image['"]|require\(['"]next\/image['"]\)/;
const rasterRuntimePattern = /(?:src|href|content|url|image|background|logo|frames?|idle|fun)\s*[:=]\s*[^;\n]*['"`][^'"`]*\.(?:png|jpe?g)(?:[?#][^'"`]*)?['"`]/i;

function listFiles(entry) {
  const stats = statSync(entry);
  if (stats.isFile()) return [entry];

  return readdirSync(entry)
    .filter((name) => !name.startsWith('.'))
    .flatMap((name) => listFiles(join(entry, name)));
}

const violations = [];

for (const root of roots) {
  for (const file of listFiles(root)) {
    if (!/\.(?:js|jsx|ts|tsx|html|webmanifest|json|css)$/.test(file)) continue;

    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (optimizerUrlPattern.test(line)) {
        violations.push(`${file}:${index + 1} uses a Vercel image optimizer endpoint`);
      }

      if (nextImageImportPattern.test(line)) {
        violations.push(`${file}:${index + 1} imports next/image`);
      }

      if (rasterRuntimePattern.test(line)) {
        violations.push(`${file}:${index + 1} references a PNG/JPEG runtime image`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('Runtime image audit failed:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('\nUse direct /assets/optimized WebP/AVIF assets instead.');
  process.exit(1);
}

console.log('Runtime image audit passed.');
