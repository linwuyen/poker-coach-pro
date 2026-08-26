import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

assert.equal(existsSync('src/App.tsx'), false, 'Retired legacy src/App.tsx must not return to the production repository.');

const main = readFileSync('src/main.tsx', 'utf8');
assert.match(main, /import AppV2 from ['"]\.\/app\/AppV2['"];/, 'Production entry must stay on AppV2.');

const retiredRuntimeRoutes = [
  '#hand-history',
  '#production-ops',
  '#evidence-ops',
  '#production-intelligence',
  '#tournament-context',
];
for (const route of retiredRuntimeRoutes) {
  assert.equal(main.includes(route), false, `Retired runtime route leaked back into main.tsx: ${route}`);
}

const readme = readFileSync('README.md', 'utf8');
assert.match(readme, /Hand History 匯入已退出產品 runtime/, 'README must keep the no-HH-runtime product boundary explicit.');
assert.match(readme, /Infinite Hand Generator 才是產品主入口/, 'README must keep Infinite Hand Generator as the primary product entry.');

console.log(JSON.stringify({
  productionEntry: 'src/app/AppV2.tsx',
  retiredLegacyAppPresent: false,
  retiredRuntimeRoutes,
  productBoundary: 'Infinite Hand Generator; no real-game HH runtime',
}, null, 2));
