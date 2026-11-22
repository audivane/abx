import path from 'node:path';
import { run } from './verification/process.mjs';
import {
  assertProductionSelection,
  productionBrowserFiles,
  productionEnvironment,
  root,
} from './verification/production.mjs';

const requested = process.argv[2] ?? 'all';
const modes = new Set(['all', 'unit', 'browser']);
if (requested === '--help' || requested === '-h') {
  console.log('Usage: node tools/test-production.mjs [all|unit|browser]');
  console.log('Runs the selected production checks through the existing launchers.');
  process.exit(0);
}
if (!modes.has(requested)) throw new Error(`Expected production scope all, unit or browser; got ${requested}`);
const all = requested === 'all';

// The production lane must not turn a missing independent reference tool into
// a skip.
assertProductionSelection();
console.log(`[production] scope: ${all ? 'TypeScript/tooling unit and production browser acceptance' : requested}. The full development commands run the complete unit and browser selections.`);

if (all || requested === 'unit') {
  await run(process.execPath, [path.join(root, 'tools/test-unit.mjs'), '--production'], {
    cwd: root, env: productionEnvironment(),
  });
}
if (all || requested === 'browser') {
  await run(process.execPath, [path.join(root, 'tools/test-browser.mjs'), ...productionBrowserFiles], {
    cwd: root, env: productionEnvironment(),
  });
}
