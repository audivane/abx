import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertProductionSelection,
  productionBrowserFiles,
  productionUnitFiles,
} from '../verification/production.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const scripts = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).scripts;

function job(name) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex(line => line === `  ${name}:`);
  assert.notEqual(start, -1, `CI job ${name} is missing`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[index])) { end = index; break; }
  }
  return lines.slice(start + 1, end).filter(line => !line.trimStart().startsWith('#')).join('\n');
}

test('production selection is explicit and includes required browser evidence', () => {
  assert.doesNotThrow(() => assertProductionSelection());
  assert.ok(productionUnitFiles.includes('packages/engine-browser/test/codec-plan.test.ts'));
  assert.ok(productionUnitFiles.includes('packages/preparation-policy/test/independent-policy.test.ts'));
  assert.ok(productionUnitFiles.includes('tools/test/verification.test.mjs'));
  for (const id of [
    'tests/e2e/engine-contract.spec.ts',
    'tests/e2e/preparation-lab.spec.ts',
    'tests/e2e/preparation-policy.spec.ts',
    'tests/e2e/supplemental-codecs.spec.ts',
    'tests/e2e/validity-canary.spec.ts',
  ]) {
    assert.ok(productionBrowserFiles.includes(id), `${id} must remain in the browser selection`);
  }
});

test('production scripts reuse the managed launchers and retain the full development selections', () => {
  assert.equal(scripts['test:production:unit'], 'node tools/test-production.mjs unit');
  assert.equal(scripts['test:production:browser'], 'node tools/test-production.mjs browser');
  assert.equal(scripts['test:production'], 'node tools/test-production.mjs');
  assert.equal(scripts['verify:production'], 'node tools/verify.mjs production');
  assert.equal(scripts['build:website-demo'], 'node tools/website-demo/build.mjs');

  const runner = readFileSync(path.join(root, 'tools/test-production.mjs'), 'utf8');
  assert.match(runner, /tools\/test-unit\.mjs/);
  assert.match(runner, /tools\/test-browser\.mjs/);
  assert.match(runner, /productionEnvironment/);
  assert.doesNotMatch(runner, /--no-sandbox/);

  const unit = readFileSync(path.join(root, 'tools/test-unit.mjs'), 'utf8');
  assert.match(unit, /test-reporter=junit/);
  assert.match(unit, /production unit lane must not skip tests/);

  const verify = readFileSync(path.join(root, 'tools/verify.mjs'), 'utf8');
  assert.match(verify, /node\('tools\/test-unit\.mjs'\)/,
    'verify:full must retain the complete development unit selection');
  assert.match(verify, /node\('tools\/test-browser\.mjs'\)/,
    'verify:full must retain the complete development browser selection');
});

test('required CI jobs run browser checks without desktop or packaging steps', () => {
  const checks = job('checks');
  assert.match(checks, /npm run typecheck/);
  assert.match(checks, /npm run test:unit/);
  assert.match(checks, /npm run test:tooling/);
  assert.doesNotMatch(checks, /electron|package:desktop|dist:/i);

  const browser = job('browser-codecs');
  assert.match(browser, /tools\/build_codec_wasm\.sh/);
  assert.match(browser, /npm run test:browser/);
  assert.match(browser, /npm run build:website-demo/);
  assert.doesNotMatch(browser, /build_ffmpeg|ldac_helper|Electron|package:desktop/i);
  assert.doesNotMatch(workflow, /distribution\.yml/);
});
