// Builds the versioned, self-describing website demo bundle in abx:
//   - abx-demo-<version>.tar.zst: built apps/client bundle under base "/abx/demo/"
//     with <meta name="robots" content="noindex">
//   - /sources/browser/ payload: audivane-source.tar.gz,
//     browser-codec-materials.tar.gz, NOTICES.md, SOURCE-OFFER.md, REPORT.json,
//     SHA256SUMS.txt, release.json
//   - manifest.json: version, git commit, dirty flags, file list, sizes, sha256
//
// Provenance honesty: reports commit/dirty/appSourcesDirty honestly and
// refuses if inputs or collected sources change during the build/collection.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachedBuild, currentLockDescriptor, fingerprint, withLock } from '../verification/cache.mjs';
import { cancellation, run } from '../verification/process.mjs';
import { copyWasmAssets } from '../copy-wasm-assets.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const websiteDemoBase = '/abx/demo/';
const lockPath = path.join(root, 'build/verification.lock');
const gitSnapshotEntry = 'build/verification-demo-git.json';
const noindexMeta = '<meta name="robots" content="noindex">';

const dependencyManifests = ['vite', 'esbuild', 'react', 'react-dom', '@ffmpeg/core', '@ffmpeg/ffmpeg']
  .map(name => `node_modules/${name}/package.json`);

export function gitProvenance(repository = root) {
  const git = args => {
    try {
      return execFileSync('git', ['-C', repository, ...args], { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
    } catch { return null; }
  };
  const commit = git(['rev-parse', 'HEAD'])?.trim() ?? null;
  if (commit === null) return { commit: null, dirty: null, appSourcesDirty: null };
  const status = paths => (git(['status', '--porcelain', ...paths]) ?? '').trim() !== '';
  return {
    commit,
    dirty: status([]),
    appSourcesDirty: status(['--', 'apps/client', 'packages', 'package.json', 'package-lock.json', 'tsconfig.json']),
  };
}

export function releaseDocument({ version, base, commit, dirty, appSourcesDirty }) {
  return { schema: 'codec-abx-website-release-v1', version, commit, dirty, appSourcesDirty, base };
}

export function withNoindex(html) {
  const robots = html.match(/<meta\s[^>]*name=["']robots["'][^>]*>/i);
  if (robots) {
    if (/noindex/i.test(robots[0])) return html;
    throw new Error('The demo HTML already declares a robots meta without noindex; refusing to overwrite it');
  }
  const head = html.match(/<head[^>]*>/i);
  if (!head) throw new Error('The demo HTML has no <head> to receive the noindex meta');
  return `${html.slice(0, head.index + head[0].length)}\n    ${noindexMeta}${html.slice(head.index + head[0].length)}`;
}

function assertDistinctFromSharedArtifacts(outDir) {
  for (const shared of [path.join(root, 'apps/client/dist'), path.join(root, 'apps/desktop/dist')]) {
    for (const relative of [path.relative(outDir, shared), path.relative(shared, outDir)]) {
      if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative)))
        throw new Error(`Website demo output ${outDir} must not overlap the shared artifact ${shared}`);
    }
  }
}

async function sha256File(filename) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export async function buildDemo({
  base = websiteDemoBase,
  outDir = path.join(root, 'build/website-demo-stage/demo'),
  releasePath = path.join(root, 'build/website-demo-stage/release.json'),
  stampName = 'website-demo',
  stampDirectory = 'build/verification-cache',
  lock = lockPath,
  signal = cancellation.signal,
  lockHeld = false,
} = {}) {
  if (lockHeld && currentLockDescriptor() === undefined) throw new Error('lockHeld requires the owning verification lock');
  const absoluteOut = path.resolve(outDir);
  const absoluteRelease = path.resolve(releasePath);
  assertDistinctFromSharedArtifacts(absoluteOut);
  const outputs = [
    path.relative(root, absoluteOut),
    path.join(path.relative(root, absoluteOut), 'index.html'),
    path.relative(root, absoluteRelease),
  ];
  const inputs = [
    'package.json', 'package-lock.json', 'tsconfig.json', 'node_modules/.package-lock.json',
    ...dependencyManifests, 'apps/client', 'packages', 'tools/website-demo', 'tools/copy-wasm-assets.mjs', gitSnapshotEntry,
  ];
  const action = async () => {
    const snapshot = {
      base,
      version: JSON.parse(await fs.readFile(path.join(root, 'apps/client/package.json'), 'utf8')).version,
      ...gitProvenance(),
    };
    await fs.mkdir(path.join(root, path.dirname(gitSnapshotEntry)), { recursive: true });
    await fs.writeFile(path.join(root, gitSnapshotEntry), JSON.stringify(snapshot));
    await copyWasmAssets();
    const built = await cachedBuild({
      signal,
      root,
      name: stampName,
      stampDirectory,
      inputs,
      outputs,
      action: async () => {
        await run(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', 'apps/client/vite.config.ts'], {
          cwd: root,
          env: { ...process.env, CODEC_ABX_WEBSITE_DEMO_BASE: base, CODEC_ABX_WEBSITE_DEMO_OUT_DIR: absoluteOut },
        });
        const htmlPath = path.join(absoluteOut, 'index.html');
        await fs.writeFile(htmlPath, withNoindex(await fs.readFile(htmlPath, 'utf8')));
        await fs.mkdir(path.dirname(absoluteRelease), { recursive: true });
        await fs.writeFile(absoluteRelease, `${JSON.stringify(releaseDocument(snapshot), null, 2)}\n`);
      },
    });
    return { built, snapshot };
  };
  const result = await (lockHeld ? action() : withLock(lock, action, { signal }));
  return { ...result, outDir: absoluteOut, releasePath: absoluteRelease };
}

async function listRepositorySources(repository = root) {
  const hasGit = await fs.access(path.join(repository, '.git')).then(() => true, () => false);
  const files = (hasGit
    ? execFileSync('git', ['-C', repository, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    : execFileSync('rg', ['--files', '--hidden', '--no-require-git', '--null', '-g', '!.git/**'], { cwd: repository })
  ).toString().split('\0').filter(Boolean);
  const selected = [];
  for (const name of [...new Set(files)].sort()) {
    const info = await fs.lstat(path.join(repository, name)).catch(() => null);
    if (!info) continue;
    if (!info.isFile()) throw new Error(`Refusing non-file source entry: ${name}`);
    selected.push(name);
  }
  return selected;
}

export async function buildWebsiteDemoBundle({
  bundleDir = path.join(root, 'build/website-demo'),
  stageDir = path.join(root, 'build/website-demo-stage'),
  materialsDir = path.join(root, 'build/browser-materials'),
  lock = lockPath,
  signal = cancellation.signal,
  sourceProbeAfterCompile,
  sourceProbeAfterListing,
} = {}) {
  const absoluteBundle = path.resolve(bundleDir);
  const absoluteStage = path.resolve(stageDir);
  const absoluteMaterials = path.resolve(materialsDir);
  assertDistinctFromSharedArtifacts(absoluteBundle);
  assertDistinctFromSharedArtifacts(absoluteStage);

  return withLock(lock, async () => {
    // Capture the exact pre-compile repository sources so audivane-source.tar.gz
    // cannot diverge from what buildDemo compiles, even if an already-dirty
    // source file is edited mid-build.
    const selected = await listRepositorySources(root);
    const sourceFingerprint = await fingerprint(root, selected, { ignore: new Set() });

    const demoDir = path.join(absoluteStage, 'demo');
    const stageRelease = path.join(absoluteStage, 'release.json');
    const { built, snapshot } = await buildDemo({
      outDir: demoDir,
      releasePath: stageRelease,
      lockHeld: true,
      signal,
    });
    if (sourceProbeAfterCompile) await sourceProbeAfterCompile();

    await run(process.execPath, [
      path.join(root, 'tools/collect-browser-materials.mjs'),
      '--verify',
      '--output',
      absoluteMaterials,
    ], { cwd: root });

    const compiledSelected = await listRepositorySources(root);
    const compiledFingerprint = await fingerprint(root, compiledSelected, { ignore: new Set() });
    const beforeProvenance = gitProvenance(root);
    if (
      compiledFingerprint !== sourceFingerprint
      || beforeProvenance.commit !== snapshot.commit
      || beforeProvenance.dirty !== snapshot.dirty
      || beforeProvenance.appSourcesDirty !== snapshot.appSourcesDirty
    ) {
      throw new Error('website-demo: source changed during build; rerun for a consistent bundle');
    }

    const materialsManifestHash = await sha256File(path.join(absoluteMaterials, 'MANIFEST.json'));
    if (sourceProbeAfterListing) await sourceProbeAfterListing();

    const tempBundle = `${absoluteBundle}.tmp-${randomUUID()}`;
    await fs.mkdir(tempBundle, { recursive: true });
    try {
      const demoArchiveName = `abx-demo-${snapshot.version}.tar.zst`;
      await run('tar', ['--zstd', '-cf', path.join(tempBundle, demoArchiveName), '-C', demoDir, '.'], { cwd: root });

      const manifestListPath = path.join(absoluteStage, 'website-source-files');
      await fs.writeFile(manifestListPath, `${selected.join('\0')}\0`);
      await run('tar', ['-czf', path.join(tempBundle, 'audivane-source.tar.gz'), '--null', '-T', manifestListPath], { cwd: root });
      await run('tar', ['-czf', path.join(tempBundle, 'browser-codec-materials.tar.gz'), '-C', absoluteMaterials, '.'], { cwd: root });

      for (const name of ['NOTICES.md', 'SOURCE-OFFER.md', 'REPORT.json']) {
        await fs.copyFile(path.join(absoluteMaterials, name), path.join(tempBundle, name));
      }
      await fs.copyFile(stageRelease, path.join(tempBundle, 'release.json'));

      const sums = [];
      for (const name of ['audivane-source.tar.gz', 'browser-codec-materials.tar.gz']) {
        const digest = await sha256File(path.join(tempBundle, name));
        sums.push(`${digest}  ${name}`);
      }
      await fs.writeFile(path.join(tempBundle, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);

      // Refuse if the source tree or browser materials changed during collection.
      const afterSelected = await listRepositorySources(root);
      const afterFingerprint = await fingerprint(root, afterSelected, { ignore: new Set() });
      const afterProvenance = gitProvenance(root);
      const afterMaterialsHash = await sha256File(path.join(absoluteMaterials, 'MANIFEST.json'));
      if (
        afterFingerprint !== sourceFingerprint
        || afterMaterialsHash !== materialsManifestHash
        || afterProvenance.commit !== snapshot.commit
        || afterProvenance.dirty !== snapshot.dirty
        || afterProvenance.appSourcesDirty !== snapshot.appSourcesDirty
      ) {
        throw new Error('website-demo: source changed during collection; rerun to build a consistent bundle');
      }

      const sourceFiles = [
        'audivane-source.tar.gz',
        'browser-codec-materials.tar.gz',
        'NOTICES.md',
        'SOURCE-OFFER.md',
        'REPORT.json',
        'SHA256SUMS.txt',
        'release.json',
      ];
      const bundleEntries = [
        { file: demoArchiveName, role: 'demo' },
        ...sourceFiles.map(file => ({ file, role: file === 'release.json' ? 'release' : 'sources' })),
      ];
      const files = [];
      for (const entry of bundleEntries) {
        const filePath = path.join(tempBundle, entry.file);
        const info = await fs.stat(filePath);
        files.push({
          file: entry.file,
          role: entry.role,
          size: info.size,
          sha256: await sha256File(filePath),
        });
      }

      const manifest = {
        schema: 'abx-website-demo-bundle-v1',
        version: snapshot.version,
        base: snapshot.base,
        commit: snapshot.commit,
        dirty: snapshot.dirty,
        appSourcesDirty: snapshot.appSourcesDirty,
        demoArchive: demoArchiveName,
        releaseFile: 'release.json',
        sources: sourceFiles,
        files,
      };
      await fs.writeFile(path.join(tempBundle, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

      await fs.rm(absoluteBundle, { recursive: true, force: true });
      await fs.mkdir(path.dirname(absoluteBundle), { recursive: true });
      await fs.rename(tempBundle, absoluteBundle);

      return { built, snapshot, bundleDir: absoluteBundle, manifest };
    } finally {
      await fs.rm(tempBundle, { recursive: true, force: true }).catch(() => {});
    }
  }, { signal });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let bundleDir;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out' && args[i + 1]) {
      bundleDir = args[i + 1];
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }
  const { built, snapshot, bundleDir: out, manifest } = await buildWebsiteDemoBundle(
    bundleDir ? { bundleDir } : {},
  );
  console.log(`[website-demo] ${built ? 'built' : 'cache verified'} demo and packaged bundle at ${path.relative(root, out)}`);
  console.log(`[website-demo] version ${snapshot.version}, ${manifest.files.length} files, manifest: ${path.relative(root, path.join(out, 'manifest.json'))}`);
  if (snapshot.commit === null)
    console.error('[website-demo] warning: git provenance is unavailable; manifest.json and release.json record commit null');
  else if (snapshot.dirty)
    console.error(`[website-demo] warning: worktree is dirty (compiled app sources ${snapshot.appSourcesDirty ? 'are dirty' : 'match HEAD'}); commit the final source before releasing`);
}
