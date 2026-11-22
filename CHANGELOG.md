# Changelog

## 1.1.2 (2026-11-22)

DSP's blue in place of the copper accent, and clearer setup.

- Every theme uses DSP's blue accent.
- Setup: the plan card says "Test trials" and opens with the plan editor
  expanded; side B starts as AAC 128 kbps; the source card reads "32-bit
  file".
- About: audio is never uploaded to any server.

## 1.1.1 (2026-11-22)

Less helper text in the app.

- Setup: the test plan card and the advanced panel drop their explanatory
  notes; the sample-rate setting is now called Final sample rate.
- Share dialog: one sentence for the link note and for the file-name option.
- Results: a non-significant result shows only its heading.

## 1.1.0 (2026-11-22)

Audivane ABX is browser-only from this release.

- The app is served at <https://audivane.app/abx/> and can be found by search
  engines. The previous `/abx/demo/` address redirects there.
- The desktop app (Electron with native codecs) is archived. Its `1.0.0`
  downloads stay on GitHub Releases and its source is kept at the
  `desktop-final` tag.
- Same eleven codecs in the browser, including the supplemental LC3 and LDAC
  WASM modules.
- Browser tests and the site bundle now build without Electron, native
  tooling or installer packaging.
- Documentation and licence materials describe the browser distribution only.
- Share a test setup (both codec chains and the plan) as a link or a QR code.
  The setup travels in the link's `#` part, so it never reaches a server;
  audio and results are never included.

## 1.0.0

First public release of Audivane ABX.

- Blind ABX comparisons of two codec chains prepared from one local file, in
  the browser (WebAssembly codecs) and as a desktop app for Linux and Windows
  (native codecs).
- Eleven codecs: MP3, AAC, Opus, Vorbis, FLAC, MP2, SBC, aptX, aptX HD, LC3
  and LDAC.
- Automatic alignment and loudness matching, with the delivered bytes verified
  before the first trial.
- Fixed-trial sessions with hidden answers, a one-sided binomial result and
  exports that carry the full preparation record.
- Setup, Listen and Results steps; keyboard shortcuts while listening;
  System, Light, Graphite and Midnight themes.
- Downloads: Ubuntu 24.04+ `.deb`, Arch `.pkg.tar.zst`, Windows installer and
  portable ZIP (unsigned), each with SHA-256 checksums and matching source and
  codec materials.
