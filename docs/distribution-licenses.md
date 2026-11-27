# Distribution licenses and source materials

Status: **browser-only distribution from 1.1.0**. The complete license,
notice, source and build payload for the served codec files is generated from
the repository by `tools/collect-browser-materials.mjs` and included in the
site bundle.

This page records what is shipped, under which license, and where the exact
material lives. It is release engineering evidence; it does not replace legal
review of the intended channels, regions or patent exposure.

## License map

| Component | License | Role in the distribution |
| --- | --- | --- |
| Audivane application code | AGPL-3.0-only, copyright 2026 Triet (@Triet1402) | Original source and bundled client JavaScript |
| liblc3 1.1.3 | Apache-2.0 | Supplemental browser LC3 WASM module |
| AOSP libldac (`eeee1a3f…`) | Apache-2.0, including AOSP `NOTICE` | Supplemental browser LDAC encoder WASM |
| hegdi/libldacdec (`7f3bd6cc…`) | MIT, copyright 2021 Dirk Helbig | Supplemental browser LDAC decoder WASM |
| React / React DOM 19.3.1 | MIT | Bundled client JavaScript |
| Audivane Mono Latin (derived from IBM Plex Mono) | SIL Open Font License 1.1 | Self-hosted font; `apps/client/public/ibm-plex-OFL.txt` |
| Geist (Latin subset of the variable font) | SIL Open Font License 1.1 | Self-hosted font; `apps/client/public/geist-OFL.txt` |
| Measurement attribution | MIT notice in `packages/measurements/NOTICE.md` | Translated loudness implementation and retained comparison code |
| `@ffmpeg/ffmpeg` 0.12.15 | MIT | Browser wrapper |
| `@ffmpeg/core` 0.12.10 | GPL-2.0-or-later | Browser WASM core |

Do not replace any dependency license with the project's AGPL-3.0-only
license. The AGPL applies to Audivane's own code only.

## Generate the browser materials

The collector verifies the exact distributed bytes, downloads the source
archives for the inferred build provenance, extracts the complete license
texts and the build scripts, and writes a hashed inventory:

```bash
node tools/collect-browser-materials.mjs
# -> build/browser-materials/
```

```text
build/browser-materials/
  distributed/...               exact npm tarball, package files and served
                                supplemental modules with their hashes
  sources/...                   exact upstream source archives (verified)
  toolchain/...                 optional Emscripten/emsdk source archives
  licenses/<component>/...      complete upstream license/notice files
  build/...                     build scripts, glue sources and extracted
                                ffmpeg.wasm Dockerfile/build files
  provenance/...                source-ref evidence, reproduction record,
                                toolchain pins and evidence bounds
  NOTICES.md                    human-readable notice inventory
  SOURCE-OFFER.md               source URLs, build and reproduction notes
  REPORT.json                   machine-readable source completeness and
                                evidence bounds
  MANIFEST.json                 every material file with its SHA-256
```

Useful variants:

```bash
# no network; fail if an archive is missing
node tools/collect-browser-materials.mjs --offline

# verify an existing materials tree against MANIFEST.json
node tools/collect-browser-materials.mjs --verify

# fail when a required source archive is missing
node tools/collect-browser-materials.mjs --require-complete
```

`npm run build:website-demo` runs the collector and packages its output with
the site bundle, so the source offer served at `/sources/` is tied to the exact
compiled page.

## Corresponding source

The served files are `@ffmpeg/core` 0.12.10 plus the local LC3/LDAC WASM builds.
The material set provides:

- the exact npm core tarball, every served file hash and the inferred release
  commit;
- the pinned liblc3 source archive (SHA-256 verified);
- the pinned AOSP libldac and hegdi/libldacdec commits and their source
  archives;
- the build scripts (`tools/build_codec_wasm.sh`), the Emscripten identity and
  the C glue sources (`tools/lc3_wasm.c`, `tools/ldac_wasm.c`);
- the complete upstream license and notice texts.

A public release should place `NOTICES.md`, the license tree and the source
offer beside the deployed page (or provide a durable equivalent download offer
for the same exact sources). Retain the material for as long as the served
files remain published.

## Preserved notices

Keep these with the release:

- `apps/client/public/ibm-plex-OFL.txt` and `geist-OFL.txt` beside the font
  assets.
- `packages/measurements/NOTICE.md` (the client bundle copies it as
  `measurements-NOTICE.md`).
- The project `LICENSE` and the current `THIRD_PARTY_NOTICES.md`.

## Remaining gates

- [x] Pin exact browser codec sources and build commands.
- [x] Collect complete browser license/notice texts and matching source archives.
- [x] Provide a machine-checkable material manifest.
- [ ] Legal review of the intended channels and codec patent exposure.
- [ ] Review the final deployed bundle contents, not only the checkout.

See [browser materials](browser-materials.md) and the
[third-party inventory](../THIRD_PARTY_NOTICES.md) for the short release-facing
table.
