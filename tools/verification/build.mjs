import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedBuild, withLock } from './cache.mjs';
import { run, cancellation } from './process.mjs';
import { copyWasmAssets } from '../copy-wasm-assets.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const lockPath = path.join(root, 'build/verification.lock');
const common = ['package.json', 'package-lock.json', 'tsconfig.json', 'tools', 'node_modules/.package-lock.json'];
async function dependencyVersions() {
  // Include installed manifests as well as the lock: a partial/mismatched install
  // must not silently reuse artifacts from a different installed tool version.
  const names = ['vite', '@ffmpeg/core', '@ffmpeg/ffmpeg', 'react', 'react-dom', 'uqr'];
  return names.map(name => `node_modules/${name}/package.json`);
}

/**
 * Build the shared browser client. The compiled tree is also the input of the
 * website bundle, so verification lanes reuse exactly these bytes.
 */
export async function ensureArtifacts(stage = 'client') {
  if (stage !== 'client') throw new Error(`Unknown build stage ${stage}`);
  await copyWasmAssets();
  const base = [...common, ...await dependencyVersions()];
  // Host versions affect Vite/esbuild output.
  const versionPath = path.join(root, 'build/verification-versions.json');
  const { promises: fs } = await import('node:fs');
  await fs.mkdir(path.dirname(versionPath), { recursive: true });
  await fs.writeFile(versionPath, JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, versions: process.versions }));
  base.push('build/verification-versions.json');
  // Directory traversal includes new/deleted files; generated dist trees are
  // excluded. Public codec assets are actual build inputs.
  const clientInputs = [...base, 'apps/client', 'packages'];
  await cachedBuild({ signal: cancellation.signal, root, name: 'client', inputs: clientInputs, outputs: ['apps/client/dist', 'apps/client/dist/index.html'],
    action: () => run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'apps/client/vite.config.ts'], { cwd: root }) });
}
export function buildArtifacts(stage, options = {}) {
  void options;
  return withLock(lockPath, () => ensureArtifacts(stage ?? 'client'), { signal: cancellation.signal });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildArtifacts(process.argv[2] ?? 'client');
