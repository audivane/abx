import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildDemo, buildWebsiteDemoBundle, gitProvenance, releaseDocument, root, websiteDemoBase, withNoindex } from '../website-demo/build.mjs';

async function gitRepository(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-git-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', ['-C', directory,
      '-c', 'init.defaultBranch=main', '-c', 'user.email=test@example.invalid', '-c', 'user.name=Test', ...args],
      { encoding: 'utf8' });
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  };
  git('init', '-q');
  return { directory, git };
}

test('noindex lands after <head> only in the demo HTML, is idempotent and refuses a conflicting robots policy', () => {
  const html = '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <title>Demo</title>\n  </head>\n  <body></body>\n</html>';
  const once = withNoindex(html);
  assert.match(once, /<head>\s*<meta name="robots" content="noindex">/);
  assert.equal(withNoindex(once), once);
  assert.match(withNoindex(once.replace('<head>', '<HEAD>')), /<HEAD>\s*<meta name="robots"/);
  assert.throws(() => withNoindex(once.replace('content="noindex"', 'content="all"')), /without noindex/);
  assert.throws(() => withNoindex('<html><body></body></html>'), /no <head>/);
});

test('git provenance separates HEAD, worktree dirt and compiled app-source dirt; outside git it is unknown', async t => {
  const { directory, git } = await gitRepository(t);
  await fs.mkdir(path.join(directory, 'apps/client/src'), { recursive: true });
  await fs.writeFile(path.join(directory, 'apps/client/src/main.tsx'), 'export {};');
  git('add', '-A');
  git('commit', '-qm', 'base');
  let info = gitProvenance(directory);
  assert.match(info.commit, /^[0-9a-f]{40}$/);
  assert.equal(info.dirty, false);
  assert.equal(info.appSourcesDirty, false);
  // Concurrent non-app edits dirty the worktree but not the compiled app.
  await fs.mkdir(path.join(directory, 'docs'), { recursive: true });
  await fs.writeFile(path.join(directory, 'docs/notes.md'), 'content');
  info = gitProvenance(directory);
  assert.equal(info.dirty, true);
  assert.equal(info.appSourcesDirty, false);
  await fs.writeFile(path.join(directory, 'apps/client/src/main.tsx'), 'export const changed = true;');
  info = gitProvenance(directory);
  assert.equal(info.appSourcesDirty, true);
  // An untracked file inside the compiled app sources is app dirt too.
  await git('checkout', '--', 'apps/client/src/main.tsx');
  await fs.mkdir(path.join(directory, 'packages/experiment'), { recursive: true });
  await fs.writeFile(path.join(directory, 'packages/experiment/scratch.ts'), 'temp');
  info = gitProvenance(directory);
  assert.equal(info.appSourcesDirty, true);
  // Outside a repository the provenance is honestly unknown, not clean.
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-nogit-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const unowned = gitProvenance(outside);
  assert.equal(unowned.commit, null);
  assert.equal(unowned.dirty, null);
  assert.equal(unowned.appSourcesDirty, null);
});

test('release.json shape pins the schema, app version, commit and dirty flags consumers rely on', () => {
  const commit = 'a'.repeat(40);
  const document = releaseDocument({ version: '0.1.0', base: websiteDemoBase, commit, dirty: false, appSourcesDirty: true });
  assert.deepEqual(document, { schema: 'codec-abx-website-release-v1', version: '0.1.0', commit, dirty: false, appSourcesDirty: true, base: '/abx/demo/' });
  assert.deepEqual(JSON.parse(JSON.stringify(document)), document);
});

test('a demo output location overlapping the shared client or desktop artifacts is refused before building', async () => {
  for (const outDir of [path.join(root, 'apps/client/dist'), path.join(root, 'apps/client/dist/demo'), path.join(root, 'apps/desktop/dist/nested')])
    await assert.rejects(buildDemo({ outDir }), /must not overlap the shared artifact/);
  await assert.rejects(buildDemo({ outDir: path.dirname(root) }), /must not overlap the shared artifact/);
});

test('a caller cannot bypass the output lock without owning it', async () => {
  await assert.rejects(buildDemo({ lockHeld: true }), /requires the owning verification lock/);
});

test('bundle packaging refuses when sources change during collection', async (t) => {
  const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-bundle-'));
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-stage-'));
  t.after(() => fs.rm(bundleDir, { recursive: true, force: true }));
  t.after(() => fs.rm(stageDir, { recursive: true, force: true }));
  const materialsManifest = path.join(root, 'build/browser-materials/MANIFEST.json');
  const hasMaterials = await fs.access(materialsManifest).then(() => true, () => false);
  if (!hasMaterials) return;
  const probeFile = path.join(root, '.demo-build-test-probe');
  t.after(() => fs.rm(probeFile, { force: true }));
  await assert.rejects(
    buildWebsiteDemoBundle({
      bundleDir,
      stageDir,
      sourceProbeAfterListing: async () => {
        await fs.writeFile(probeFile, 'changed during collection\n');
      },
    }),
    /source changed during collection/,
  );
});

test('bundle packaging refuses when an already-dirty app source changes mid-build', async (t) => {
  const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-bundle-'));
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codec-demo-stage-'));
  t.after(() => fs.rm(bundleDir, { recursive: true, force: true }));
  t.after(() => fs.rm(stageDir, { recursive: true, force: true }));
  const materialsManifest = path.join(root, 'build/browser-materials/MANIFEST.json');
  const hasMaterials = await fs.access(materialsManifest).then(() => true, () => false);
  if (!hasMaterials) return;
  const dirtyAppProbe = path.join(root, 'apps/client/.demo-build-test-dirty-probe');
  await fs.writeFile(dirtyAppProbe, 'initial dirty app source\n');
  t.after(() => fs.rm(dirtyAppProbe, { force: true }));
  const before = gitProvenance(root);
  assert.equal(before.dirty, true);
  assert.equal(before.appSourcesDirty, true);
  await assert.rejects(
    buildWebsiteDemoBundle({
      bundleDir,
      stageDir,
      sourceProbeAfterCompile: async () => {
        await fs.writeFile(dirtyAppProbe, 'modified dirty app source after compile\n');
        const mid = gitProvenance(root);
        assert.equal(mid.dirty, true);
        assert.equal(mid.appSourcesDirty, true);
      },
    }),
    /source changed during build/,
  );
});

test('the default client/desktop build keeps base "/" and outDir "dist", and noindex stays out of the source app', async () => {
  const config = await fs.readFile(path.join(root, 'apps/client/vite.config.ts'), 'utf8');
  assert.match(config, /base: demoBase \?\? "\/"/);
  assert.match(config, /outDir: demoOutDir \?\? "dist"/);
  const html = await fs.readFile(path.join(root, 'apps/client/index.html'), 'utf8');
  assert.doesNotMatch(html, /name=["']robots/i);
});
