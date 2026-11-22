import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Tests that exercise the production browser TypeScript/tooling paths. The
 * full development commands run the complete unit/browser sets.
 */
export const productionUnitFiles = Object.freeze([
  'packages/contracts/test/request.test.ts',
  'packages/contracts/test/audio-limits.test.ts',
  'packages/contracts/test/catalog.test.ts',
  'packages/engine-browser/test/codec-plan.test.ts',
  'packages/engine-browser/test/result-validation.test.ts',
  'packages/engine-browser/test/wav.test.ts',
  'packages/engine-browser/test/source-import.test.ts',
  'packages/measurements/test/wav.test.ts',
  'packages/measurements/test/relation.test.ts',
  'packages/measurements/test/loudness-streaming.test.ts',
  'packages/experiment-browser/test/client.test.ts',
  'packages/experiment-browser/test/protocol.test.ts',
  'packages/experiment-browser/test/worker.test.ts',
  'packages/experiment/test/chain.test.ts',
  'packages/experiment/test/commitment.test.ts',
  'packages/experiment/test/preparation-validity.test.ts',
  'packages/experiment/test/service.test.ts',
  'packages/experiment/test/statistics.test.ts',
  'packages/playback/test/listening-controller.test.ts',
  'packages/playback/test/output.test.ts',
  'packages/playback/test/player.test.ts',
  'packages/playback/test/timeline.test.ts',
  'packages/playback/test/wav.test.ts',
  'packages/measurements/test/measurements.test.ts',
  'packages/preparation-policy/test/independent-policy.test.ts',
  'packages/preparation-policy/test/independent-loudness.test.ts',
  'packages/preparation-policy/test/preparation-validity.test.ts',
  'packages/preparation-policy/test/preparation-policy.test.ts',
  'packages/preparation-policy/test/canary-excerpt.test.ts',
  'packages/preparation-policy/test/validity-canary.test.ts',
  'apps/client/test/preparation-lifecycle.test.ts',
  'apps/client/test/listening-eligibility.test.ts',
  'apps/client/test/listening-fast-start.test.ts',
  'apps/client/test/ambiguity.test.ts',
  'tools/test/audio-output-analysis.test.mjs',
  'tools/test/font-subsets.test.mjs',
  'tools/test/production-contract.test.mjs',
  'tools/test/unit-args.test.mjs',
  'tools/test/verification.test.mjs',
]);

/**
 * Browser acceptance that runs against the standard client build, including
 * the eleven-codec supplemental LC3/LDAC lane.
 */
export const productionBrowserFiles = Object.freeze([
  'tests/e2e/audio-import.spec.ts',
  'tests/e2e/codec-chains.spec.ts',
  'tests/e2e/engine-contract.spec.ts',
  'tests/e2e/experiment-service.spec.ts',
  'tests/e2e/experiment-transport.spec.ts',
  'tests/e2e/listening-flow.spec.ts',
  'tests/e2e/listening-fast-start.spec.ts',
  'tests/e2e/output-devices.spec.ts',
  'tests/e2e/playback.spec.ts',
  'tests/e2e/preparation-lab.spec.ts',
  'tests/e2e/preparation-policy.spec.ts',
  'tests/e2e/supplemental-codecs.spec.ts',
  'tests/e2e/ui-codec-chains.spec.ts',
  'tests/e2e/validity-canary.spec.ts',
  'tests/e2e/workspace.spec.ts',
]);

function source(relative) {
  return readFileSync(path.join(root, relative), 'utf8');
}

/**
 * Fail before a production run when a required file disappeared, or the
 * independent evidence gate was weakened.
 */
export function assertProductionSelection() {
  const lists = [
    ['unit', productionUnitFiles],
    ['browser', productionBrowserFiles],
  ];
  const seen = new Set();
  for (const [label, files] of lists) {
    assert.ok(files.length > 0, `production ${label} selection is empty`);
    for (const relative of files) {
      assert.ok(!seen.has(relative), `${relative} is selected by more than one production lane`);
      seen.add(relative);
      assert.ok(existsSync(path.join(root, relative)), `required production test is missing: ${relative}`);
      assert.ok(statSync(path.join(root, relative)).isFile(), `required production test is not a file: ${relative}`);
      const text = source(relative);
      assert.match(text, /\btest\s*\(/, `${relative} contains no Node/Playwright test case`);
    }
  }
  const independent = source('packages/preparation-policy/test/independent-policy.test.ts');
  assert.match(independent, /ebur128=peak=true/, 'independent loudness check must use FFmpeg ebur128');
  assert.match(independent, /CODEC_ABX_REQUIRE_INDEPENDENT_LOUDNESS/,
    'independent loudness check must fail closed when the production lane requires it');

  for (const required of [
    'packages/engine-browser/test/codec-plan.test.ts',
    'packages/preparation-policy/test/independent-policy.test.ts',
    'tools/test/verification.test.mjs',
  ]) {
    assert.ok(productionUnitFiles.includes(required), `production unit coverage is missing ${required}`);
  }
  for (const required of ['codec-chains', 'listening-flow', 'supplemental-codecs', 'ui-codec-chains']) {
    assert.ok(productionBrowserFiles.some(file => file.includes(required)),
      `production browser coverage is missing ${required}`);
  }
  return true;
}

export function productionEnvironment(environment = process.env) {
  return {
    ...environment,
    // Missing FFmpeg must fail this lane rather than silently omitting the
    // separately implemented ebur128 corroboration.
    CODEC_ABX_REQUIRE_INDEPENDENT_LOUDNESS: '1',
  };
}
