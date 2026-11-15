<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/audivane-logo-dark.svg">
    <img src="assets/brand/audivane-logo.svg" alt="Audivane" height="56">
  </picture>
</p>

<h3 align="center">ABX — blind audio comparisons</h3>

<p align="center">
  Can you really hear the difference between two codecs, bitrates or encoders?<br>
  Audivane ABX prepares both versions from your own file and tests you blind.
</p>

<p align="center">
  <a href="https://github.com/audivane/abx/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/audivane/abx?label=release&color=0b1020"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0-only" src="https://img.shields.io/badge/license-AGPL--3.0--only-0b1020"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-browser%20%C2%B7%20Linux%20%C2%B7%20Windows-0b1020">
</p>

<p align="center">
  <a href="https://audivane.app/abx/demo/"><b>Try it in the browser</b></a> ·
  <a href="https://github.com/audivane/abx/releases/latest">Download</a> ·
  <a href="https://audivane.app/abx/">Website</a> ·
  <a href="docs/README.md">Docs</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/trial-dark.webp">
    <img src="docs/images/trial-light.webp" alt="An ABX trial: play A, B and the unknown X, then answer whether X is A or B" width="820">
  </picture>
</p>

## Why

- **Your music, not test clips.** Import a local file and build two codec
  chains, Side A and Side B, from the same decoded source.
- **Fair by construction.** Both sides are aligned and loudness-matched, and
  the exact bytes you hear are verified before the first trial.
- **Properly blind.** Fixed-trial ABX with the answers hidden until the run
  ends, plus a binomial result that tells you whether you beat guessing.
- **Private.** Everything runs on your machine: WebAssembly codecs in the
  browser, native codecs in the desktop app. Nothing is uploaded.
- **Auditable.** Results export with the full preparation record, so anyone
  can check what was compared.

## Install

| Platform | Get it |
| --- | --- |
| Any modern browser | [audivane.app/abx/demo](https://audivane.app/abx/demo/) — no install |
| Ubuntu 24.04+ / Debian (x64) | `.deb` from [Releases](https://github.com/audivane/abx/releases/latest) |
| Arch Linux (x86_64) | `.pkg.tar.zst` from [Releases](https://github.com/audivane/abx/releases/latest) |
| Windows 10/11 (x64) | Installer or portable `.zip` from [Releases](https://github.com/audivane/abx/releases/latest) (unsigned) |

```sh
# Ubuntu / Debian
curl -fLO https://github.com/audivane/abx/releases/download/1.0.0/audivane_1.0.0_amd64.deb
sudo apt install ./audivane_1.0.0_amd64.deb

# Arch Linux
sudo pacman -U https://github.com/audivane/abx/releases/download/1.0.0/audivane-bin-1.0.0-1-x86_64.pkg.tar.zst
```

Every release ships SHA-256 checksums and the matching source, codec build
scripts and license materials. Windows builds are not code-signed yet, so
SmartScreen will warn on first launch.

## How a test works

<img src="docs/images/listen-light.webp" alt="The Listen step with the trial progress bar" width="420" align="right">

1. **Setup** — import a track and pick the codec and bitrate for each side.
2. **Prepare** — Audivane encodes both sides, aligns and level-matches them,
   and verifies the result.
3. **Listen** — play A, B and X as often as you like, then answer
   *X is A* or *X is B*. Keys: <kbd>Space</kbd>, <kbd>A</kbd> <kbd>B</kbd> <kbd>X</kbd>, <kbd>1</kbd> <kbd>2</kbd>.
4. **Results** — score, p-value and the complete record, ready to export.

<br clear="right">

## What it supports

| | |
| --- | --- |
| **Input** | WAV, FLAC, MP3, M4A/MP4, AAC (ADTS), Ogg/Opus — up to 30 min / 512 MiB, mono or stereo |
| **Codecs** | MP3, AAC, Opus, Vorbis, FLAC, MP2, SBC, aptX, aptX HD, LC3, LDAC |
| **Rates** | 44.1, 48 and 96 kHz kept as-is; other rates converted to 48 kHz |
| **Playback** | Verified PCM16 WAV for both sides |
| **Themes** | System, Light, Graphite, Midnight |

Exact limits are in [audio import](docs/audio-import.md); the statistics and
alignment rules are in [methodology](docs/methodology.md). A passing test
shows what *you* heard on *your* setup; it is not a codec conformance test.

## Build from source

Node 24 (or ≥ 22.12):

```sh
git clone https://github.com/audivane/abx.git && cd abx
npm ci
npm run dev        # http://127.0.0.1:5173
```

Desktop builds, native codecs and the full test suite are covered in
[development](docs/development.md).

## Contributing

Bug reports and pull requests are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) first: pull requests need a one-time
[Contributor License Agreement](CLA.md), which a bot will ask you to sign.

## License

Copyright © 2026 Triet ([@Triet1402](https://github.com/Triet1402)).
Audivane ABX is free software under the
[GNU Affero General Public License v3.0 only](LICENSE).
Bundled codecs, fonts and libraries keep their own licenses — see
[third-party notices](THIRD_PARTY_NOTICES.md) and
[distribution materials](docs/distribution-licenses.md).
