import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const ENTRY = path.join(ROOT, 'main.tsx');
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : SOURCE_EXTENSIONS.includes(path.extname(full)) ? [full] : [];
  });
}

function importSpecifiers(source: string): string[] {
  const specs = new Set<string>();
  const staticPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicPattern = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs];
}

function resolveRelative(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map(extension => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map(extension => path.join(base, `index${extension}`)),
  ];
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
}

const reachable = new Set<string>();
const queue = [ENTRY];
while (queue.length) {
  const file = queue.shift()!;
  const normalized = path.resolve(file);
  if (reachable.has(normalized)) continue;
  reachable.add(normalized);
  const source = readFileSync(normalized, 'utf8');
  for (const specifier of importSpecifiers(source)) {
    const resolved = resolveRelative(normalized, specifier);
    if (resolved && resolved.startsWith(ROOT)) queue.push(resolved);
  }
}

const all = sourceFiles(ROOT).map(file => path.resolve(file));
const ignored = new Set([path.resolve(ROOT, 'vite-env.d.ts')]);
const unreachable = all
  .filter(file => !reachable.has(file) && !ignored.has(file))
  .map(file => path.relative(process.cwd(), file).replaceAll('\\', '/'))
  .sort();

console.log(JSON.stringify({
  entry: path.relative(process.cwd(), ENTRY).replaceAll('\\', '/'),
  sourceFiles: all.length,
  productionReachableFiles: reachable.size,
  unreachableFiles: unreachable.length,
  unreachable,
  evidenceBoundary: 'Static relative-import reachability only. An unreachable file may still be intentionally test/tool-only; deletion requires a separate review plus full CI/E2E.',
}, null, 2));
