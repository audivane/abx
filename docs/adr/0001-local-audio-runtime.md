# Local browser audio runtime

Use shared TypeScript policy, measurements, experiment authority and playback
in a single browser application. Dedicated module Workers execute local WASM
codecs and the experiment service. There is no desktop or server processing
adapter.

Keep file access behind the browser File API and process ownership inside
workers. Preserve cancellation, cleanup and exact delivered-byte authority.
Processing stays local; no audio, preparation record or answer is uploaded.

The browser FFmpeg core and the supplemental LC3/LDAC modules come from pinned
sources. Shared policy does not promise codec equality between implementations.
Validate intended semantics with analytical fixtures, independent evidence and
exact delivered audio. Scientific changes require explicit policy/schema
versioning.

The Electron application that used native codec executables was archived after
1.0.0. Its downloads stay on GitHub Releases and its source at the
`desktop-final` tag.
