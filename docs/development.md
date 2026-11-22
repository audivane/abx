# Development

Use Node 24 (tested), or Node >=22.12. Install dependencies with `npm ci`.

## Browser

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Processing stays local in this tab. Build the
optional LC3 and LDAC modules with `tools/build_codec_wasm.sh` before starting
the client. That script downloads emsdk on first use and records the compiler
version. Missing or invalid modules leave those codecs unavailable.

`npm run build:client` writes the production client to `apps/client/dist`.
`npm run build:website-demo` builds the bundle served at
<https://audivane.app/abx/>, including its source offer. Public web
distribution also needs matching codec source and license materials; see
[browser materials](browser-materials.md) and
[licenses](distribution-licenses.md).

`npm run check:fonts` verifies the bundled renamed font subsets against
`third_party/fonts.json`; see [font licensing](font-licensing.md).

## Checks

Run checks for the changed module and its callers while editing, then one
integration run when the combined change is ready. Documentation-only edits
need local-link and diff checks.

| Command | Scope |
| --- | --- |
| `npm run typecheck` | Strict TypeScript checking |
| `npm run check:fonts` | Bundled renamed font subsets against `third_party/fonts.json` |
| `npm run test:unit -- packages/experiment/test/chain.test.ts` | Selected unit file |
| `npm run test:browser -- --project chromium-dev tests/e2e/ui-codec-chains.spec.ts` | Selected browser acceptance |
| `npm run build:website-demo` | Built site bundle and checked metadata |
| `npm run verify:quick` | Typing and unit/tooling checks |
| `npm run verify:full` | Integrated functional checks and browser profiling |
| `npm run profile:browser` | Browser workload and cleanup profiling |
| `npm run test:audio-output` | Separate live digital capture |

Install Chromium with `npx playwright install chromium`.

Some checks use a system FFmpeg as an independent reference: the
preparation-policy loudness comparison and the browser import fixtures. The
production lane (`npm run verify:production`) fails closed when it is missing.

Do not weaken codec coverage, failure reporting or numerical tolerances to make
a check pass. Validate scientific behavior using analytical fixtures,
independent evidence and exact delivered audio; existing passes are not
correctness authorities. See [methodology](methodology.md).

Rerun failing cases first after a bounded fix. Broaden testing when changes,
failures or unresolved concerns justify it. A build-cache hit is not a test
pass: requested tests must always execute. Preserve failure artifacts.

Performance checks run separately and serially. Stop competing CPU-heavy jobs
before comparing timings. Profiling validates workload, cancellation, retry,
release and worker cleanup; there are no universal host timing guarantees.

Digital capture needs `npm run setup:virtual-audio` first. It owns a private
user-mode audio server and verifies digital output, not physical listening.

## Launchers, locks and reports

Use the repository browser launcher. It owns the build, the output lock, server
cleanup and a run-specific report. Browser runs start their own loopback
servers on ephemeral ports and close them afterward.

Linux uses `flock` on `build/verification.lock` to protect shared artifacts.
Owned commands retain the lock until they exit. Browser workers are bounded by
CPU and memory: two per 2 GiB, twelve at most, and two under CI. Override
deliberately with `CODEC_ABX_BROWSER_WORKERS=4` or Playwright `--workers=1`.

Reports use unique directories under `test-results`. Retain reports you need
before cleaning ignored outputs.

## Build reuse

The build graph is assets → client. Fingerprints cover source bytes and
directory entries, public assets, locks, tool/configuration inputs, platform
versions and output bytes. Required entry files must exist. Failed or
interrupted builds cannot publish valid stamps.

Unchanged builds rehash their outputs. Source changes during a build refuse
publication. Tests and performance results are never cached. Remove
`build/verification-cache` to force fresh builds. Manual modifications inside
`node_modules` are outside the supported installation workflow.

Build success, automated functional checks and physical listening are separate
results. Rebuilt artifacts need evidence bound to their own source identity and
hashes. See the [release guide](releasing.md).

## Source map

| Directory | Purpose |
| --- | --- |
| `apps/client` | Browser UI |
| `packages` | Shared audio policy, experiment authority, playback and browser execution |
| `tools` | Builds, verification and site bundle preparation |

The [architecture decision](adr/0001-local-audio-runtime.md) records the local
processing architecture. Follow the [scientific policy](methodology.md) and use
the [documentation index](README.md) for current guides.

## Remote local preview

When exposing a local preview through a trusted reverse proxy, set
`CODEC_ABX_PREVIEW_ALLOWED_HOSTS` to its comma-separated hostnames before starting
Vite preview. The default has no extra allowed hosts. Keep private hostnames in
local environment configuration rather than tracked source.
