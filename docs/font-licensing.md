# Bundled font licensing

The client uses three type families, all licensed under SIL OFL 1.1,
separately from Audivane's AGPL-3.0-only code:

| Family (CSS name) | Upstream | Files | Notice |
| --- | --- | --- | --- |
| Inter | Inter 4 via `@fontsource/inter` 5.3.0, unmodified Latin subsets | `apps/client/src/assets/fonts/inter-latin-{400,500,600}.woff2` | `OFL-Inter.txt`, `apps/client/public/inter-OFL.txt` |
| Instrument Serif | `@fontsource/instrument-serif` 5.3.0, unmodified Latin subset | `apps/client/src/assets/fonts/instrument-serif-latin-400.woff2` | `OFL-Instrument-Serif.txt`, `apps/client/public/instrument-serif-OFL.txt` |
| Audivane Mono Latin | IBM Plex Mono 500 Latin subset, renamed | `apps/client/src/assets/fonts/ibm-plex-mono-latin-500.woff2` | `OFL.txt`, `apps/client/public/ibm-plex-OFL.txt` |

IBM Plex Sans is no longer bundled.

## Policies

Inter and Instrument Serif declare no Reserved Font Name. They ship as the
exact upstream fontsource subsets: the bytes on disk equal the recorded
upstream original (`sha256 == originalSha256`), and the manifest pins the
package version and the file inside it (`source`, `upstreamFile`).

IBM Plex declares the Reserved Font Name "Plex". Its Mono subset uses the
primary name **Audivane Mono Latin**, including internal
family, unique, full and PostScript names and CSS aliases. Glyphs, outlines,
metrics and character coverage are unchanged. Existing asset filenames
identify their origin and remain stable. These are project derivatives, not
new IBM releases. Copyright and license fields are unchanged. The wordmark's
outlined artwork is unaffected. A CSS-only alias such as `IBM Plex Mono`
would still use the reserved name and leave internal names unchanged, so the
approach follows the OFL guidance for modified webfont subsets:
https://openfontlicense.org/webfonts-and-reserved-font-names/

## Verification

`third_party/fonts.json` records each family's policy (upstream,
`copyrightHolder`, `reservedFontNames`, the notice file name and, for
unmodified families, the pinned `@fontsource` package) and, for every file:
the input, output and content SHA-256 and the family it belongs to.
`npm run check:fonts` (`tools/check-subset-fonts.mjs`, also part of the unit
and production lanes) decodes each bundled WOFF2 with no third-party
dependencies and verifies:

- the manifest inventory matches the bundled files exactly — fonts on disk
  missing from the manifest, manifest entries without a bundled file,
  duplicate paths and families without files all fail — and the manifest's
  license, family policies and pinned fonttools version remain intact;
- the recorded file hashes match the bytes on disk; renamed copies differ
  from their original and unmodified copies are byte-identical to it;
- renamed name records name the Audivane Latin family and carry no reserved
  name, with the IBM copyright (nameID 0), OFL license URL (nameID 14), license
  text and PostScript records intact; unmodified records carry the upstream
  copyright and family name and never an Audivane name;
- every font directory keeps the OFL notice of each family it bundles, and a
  notice for a family with a Reserved Font Name declares it; and
- a content fingerprint over every stored table except the name table and the
  head table's checkSumAdjustment, which the format requires to change with
  any file edit, matches the manifest's `contentSha256`, which must equal the
  `originalContentSha256` recorded from the upstream subset, so the glyph
  and metric data are proven identical to the originals and the evidence is
  not self-attesting.

Anyone can reproduce a recorded original fingerprint from the upstream file
with `node tools/check-subset-fonts.mjs --fingerprint <file>`; for Inter and
Instrument Serif the upstream files are in the pinned fontsource tarballs.
To reproduce the IBM Plex metadata change, use the original WOFF2 files,
install `fonttools[woff]==4.61.1` in a Python virtual environment and run
`tools/rename-subset-fonts.py`; it renames only `ibm-plex-*` files,
fingerprints the originals, keeps the other manifest entries and then invokes
`node tools/check-subset-fonts.mjs --update` to record the renamed content
hashes and verify the result. Both tools read the font directories and the
rewritten name-record IDs from `tools/check-subset-fonts.mjs`, the shared
source of truth. Do not run it on renamed outputs. Preserve the OFL notices
with redistributed fonts and include this modification record in release
materials.

This addresses font naming and notice handling. Codec release gates remain
documented in `docs/distribution-licenses.md` and `docs/browser-materials.md`;
generating notices alone does not certify a published build or settle codec
patent rights.
