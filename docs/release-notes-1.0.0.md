# Audivane ABX 1.0.0

The first public release of Audivane ABX: blind audio comparisons of two
codec chains, prepared from your own file and run entirely on your machine.

## Highlights

- **Compare what you actually listen to.** Import a WAV, FLAC, MP3, M4A/MP4,
  AAC or Ogg/Opus file (up to 30 minutes) and configure Side A and Side B with
  any of eleven codecs: MP3, AAC, Opus, Vorbis, FLAC, MP2, SBC, aptX, aptX HD,
  LC3 and LDAC.
- **Fair preparation.** Both sides start from the same decoded source, are
  aligned and loudness-matched, and the exact delivered bytes are verified
  before trial 1.
- **Blind by design.** Fixed-trial ABX with answers hidden until the run ends.
  Results show your score and a one-sided binomial p-value.
- **Evidence you can share.** One download holds the listening record and the
  full preparation diagnostics.
- **Browser or desktop.** The browser app uses WebAssembly codecs; the
  desktop app for Linux and Windows uses native codecs in a private worker.
  No audio leaves your device.

## Downloads

| File | Platform |
| --- | --- |
| `audivane_1.0.0_amd64.deb` | Ubuntu 24.04+ / Debian, x64 |
| `audivane-bin-1.0.0-1-x86_64.pkg.tar.zst` | Arch Linux, x86_64 |
| `Audivane-Setup-1.0.0-x64.exe` | Windows 10/11, x64 installer (unsigned) |
| `Audivane-1.0.0-win32-x64.zip` | Windows 10/11, x64 portable (unsigned) |

Each platform comes with a release manifest, SHA-256 checksums, the matching
application source and the codec source, build and license materials. The
browser app is at <https://audivane.app/abx/demo/>. No macOS or AppImage
package is provided.

## Verification and limits

Version consistency, TypeScript compilation, unit and distribution tests,
builds and structural/checksum verification of every package cover this
release. No complete installed-platform pass (every codec on every installed
format) or physical listening pass is claimed for these exact packages.
Windows builds are not code-signed. A passing ABX result shows what was heard
on one playback chain; it is not a codec conformance test. Codec patent and
distribution review is separate from this release.
