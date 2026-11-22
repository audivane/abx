import path from 'node:path';
import { buildArtifacts, root } from './verification/build.mjs';
import { run } from './verification/process.mjs';
const mode = process.argv[2];
if (!['quick', 'full', 'production'].includes(mode)) throw new Error('Expected explicit verification mode: quick, full or production');
const full = mode === 'full';
const production = mode === 'production';
const node = (file, args = []) => run(process.execPath, [path.join(root, file), ...args], { cwd: root });
const typecheck = () => node('node_modules/typescript/bin/tsc', ['--noEmit']);
if (production) {
  if (process.argv.length > 3) throw new Error('verify:production does not accept filters; use the scoped production test commands');
  console.log('[verification] PRODUCTION scope: strict typecheck then the explicit TypeScript/tooling unit selection and production browser acceptance. A system FFmpeg is required for the independent loudness reference.');
  await typecheck();
  await node('tools/test-production.mjs');
} else if (!full) {
  console.log('[verification] QUICK scope: strict typecheck + unit tests only. Browser checks require verify:full or their explicit commands.');
  const results = await Promise.allSettled([typecheck(), node('tools/test-unit.mjs', process.argv.slice(3))]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
} else {
  if (process.argv.length > 3) throw new Error('verify:full does not accept filters; use the scoped test commands');
  console.log('[verification] FULL scope: client build; concurrent typecheck/unit/browser; browser profiling.');
  await buildArtifacts('client');
  const results = await Promise.allSettled([
    typecheck(), node('tools/test-unit.mjs'), node('tools/test-browser.mjs'),
  ]);
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  await node('tools/profile-browser-isolated.mjs');
}
