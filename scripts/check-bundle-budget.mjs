import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const ASSETS = join(DIST, 'assets');
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const MAX_JS_CHUNK_BYTES = 500 * 1024;

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (error) {
  throw new Error(`Bundle budget requires Vite manifest at ${MANIFEST}. Run npm run build:web first.`, { cause: error });
}

const jsFiles = readdirSync(ASSETS)
  .filter(name => name.endsWith('.js'))
  .map(name => ({ name, bytes: statSync(join(ASSETS, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const oversized = jsFiles.filter(file => file.bytes > MAX_JS_CHUNK_BYTES);
const entryFiles = new Set(
  Object.values(manifest)
    .filter(value => value && typeof value === 'object' && value.isEntry && typeof value.file === 'string')
    .map(value => value.file.split('/').pop()),
);
const entries = jsFiles.filter(file => entryFiles.has(file.name));

console.log(`Bundle budget: ${jsFiles.length} JS chunks, max ${(jsFiles[0]?.bytes || 0) / 1024 | 0} KiB.`);
entries.forEach(file => console.log(`Entry ${file.name}: ${(file.bytes / 1024).toFixed(1)} KiB`));

if (oversized.length) {
  const details = oversized.map(file => `${file.name} ${(file.bytes / 1024).toFixed(1)} KiB`).join(', ');
  throw new Error(`P11 bundle budget exceeded: every minified JS chunk must be <= 500 KiB. ${details}`);
}
