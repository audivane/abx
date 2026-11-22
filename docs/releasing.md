# Audivane release preparation

Status: **1.1.1, browser-only.** The version is assigned across workspace
manifests, internal dependencies, lockfiles and application metadata. Read the
[changelog](../CHANGELOG.md) for the current notes.

## Release route

Publish from [audivane/abx](https://github.com/audivane/abx) and deploy the
matching site bundle to <https://audivane.app/abx/>. Prepare the reviewed source
commit, build the site bundle, verify its metadata and materials, then stage a
GitHub draft release. Keep public links on the latest published release until
the draft is published. Never relabel earlier packages under a new version.

Checks cover version consistency, TypeScript compilation, unit and tooling
tests, the built site bundle, and browser acceptance in development and
production builds.

## Site bundle

```sh
npm ci
npm run typecheck
npm run test:unit
npm run test:tooling
npm run build:website-demo
npm run test:browser
```

`npm run build:website-demo` writes `build/website-demo/` with:

- `abx-demo-<version>.tar.zst` — the client built under `/abx/`;
- `audivane-source.tar.gz` — matching application source;
- `browser-codec-materials.tar.gz`, `NOTICES.md`, `SOURCE-OFFER.md` and
  `REPORT.json` — exact codec source, build and notice materials;
- `SHA256SUMS.txt`, `release.json` and `manifest.json`.

The build refuses source that changes while it compiles or collects materials.
It also checks that the built `index.html` keeps its title, meta description,
`https://audivane.app/abx/` canonical URL and Open Graph/Twitter tags. The page
must stay indexable: no `robots` meta is injected.

Deploy the unpacked contents of the demo archive so the app is served at
`/abx/` and the source offer at `/sources/`. The site repository owns DNS,
caching and any redirects from the old `/abx/demo/` path. Keep the SHA-256
files and the exact materials beside the deployed page or on a durable download
offer for the same bytes.

Build the optional LC3 and LDAC modules first
(`tools/build_codec_wasm.sh`) when releasing an eleven-codec site. A partial
asset set makes those codecs unavailable; it must be recorded, not implied.

## Exact notices and matching source

AGPL-3.0-only covers the [project-owned code](../LICENSE), copyright
`2026 Triet (@Triet1402)`. Each dependency retains its own license. The
[third-party inventory](../THIRD_PARTY_NOTICES.md) and
[browser materials](browser-materials.md) describe the full license texts,
source archives, exact pins, build scripts and binary provenance.

`@ffmpeg/core` declares GPL-2.0-or-later. The supplemental LC3/LDAC WASM is
built from pinned liblc3, AOSP libldac and hegdi/libldacdec sources. Web
publication needs the complete corresponding source and build materials for the
exact served files; the npm tarball alone is not enough.

`npm run check:fonts` verifies every bundled renamed font subset against
`third_party/fonts.json`; the verified properties are listed in
[font licensing](font-licensing.md).

## Acceptance and publication gates

- [x] Version bump across workspace manifests and lockfile.
- [x] TypeScript, unit, tooling and browser checks.
- [x] Site bundle with checked indexable metadata.
- [x] Browser codec source/build/notice materials collected and verified.
- [ ] Review the final bundle and source offer against the deployed bytes.
- [ ] Legal review of the intended channels and codec patent exposure.

Build success, automated browser checks and physical listening are separate
results. Do not promote a candidate until its required checks pass, and do not
work around a failing browser test.
