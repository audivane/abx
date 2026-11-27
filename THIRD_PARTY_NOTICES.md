# Third-party software and release inventory

The project's original code is licensed under [AGPL-3.0-only](LICENSE),
copyright 2026 Triet (@Triet1402). Dependencies, fonts and codec binaries retain
their own licenses and attribution. The AGPL does not relicense the shipped
dependencies.

Audivane ABX ships one browser application. Its WebAssembly codecs and
supplemental LC3/LDAC modules are served from the site, so their matching
source, build scripts and full notices are part of web distribution. See
[browser materials](docs/browser-materials.md).

## Application and browser assets

| Component | Evidence and license | Distribution work |
| --- | --- | --- |
| React / React DOM 19.3.1 | Installed package licenses: MIT. | Bundled client JavaScript. |
| `uqr` 0.1.3 (QR code encoder) | Installed package license: MIT, Copyright (c) Project Nayuki and (c) 2023 Anthony Fu (`node_modules/uqr/LICENSE`). | Bundled client JavaScript (share dialog QR codes). |
| `@ffmpeg/ffmpeg` 0.12.15 | MIT wrapper; see the [upstream FAQ](https://ffmpegwasm.netlify.app/docs/faq/#what-is-the-license-of-ffmpegwasm). | Browser only; the wrapper ships inside the client bundle. |
| `@ffmpeg/core` 0.12.10 | Installed `package.json` declares `GPL-2.0-or-later`; [release package metadata](https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/packages/core/package.json). | Matching source archives, build scripts and notices are collected by `tools/collect-browser-materials.mjs` and offered with the browser app at `/sources/`. The npm tarball alone is not a source bundle. |
| Supplemental LC3 WASM | Google liblc3 1.1.3, Apache-2.0, built by `tools/build_codec_wasm.sh`. | Source archive, license text and build script are included in the browser materials. |
| Supplemental LDAC WASM | Pinned AOSP libldac, Apache-2.0, and hegdi/libldacdec, MIT. | Source archives and licenses, including the AOSP `NOTICE`, are included in the browser materials. |
| Audivane Mono Latin (client), derived from IBM Plex Mono | [Bundled SIL Open Font License and copyright](apps/client/public/ibm-plex-OFL.txt). | Keep this file with the font assets; the material collector also includes it. See [font modification provenance](docs/font-licensing.md). |
| Geist 1.9.2 Latin subset (variable, weights 400 to 600, made with fonttools from the `geist` package) | [Bundled SIL Open Font License and copyright](apps/client/public/geist-OFL.txt). | Keep this file with the font assets; the material collector also includes it. |
| Measurement implementation attribution | [pyloudnorm notice and full MIT text](packages/measurements/NOTICE.md). | Preserve this attribution in the browser bundle (`measurements-NOTICE.md`). |

Build tools such as Node.js, Vite, TypeScript and Playwright are development
dependencies only; they are not part of the distributed site.
