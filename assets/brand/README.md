# Audivane identity

The public project name is **Audivane**. Subtitle: **Blind audio comparisons.**

The symbol is a split A: two equal vanes, two listening sides, with a continuous
open channel between them. It uses solid geometry and no effects so the same
mark works in a single color and at small icon sizes.

## Files

- [App icon](audivane-icon.svg): paper symbol on a navy tile, 256 × 256 viewBox; the source for `icons/`.
- [Navy symbol](audivane-mark.svg): transparent, 256 × 256 viewBox, for light surfaces.
- [Monochrome symbol](audivane-mark-mono.svg): `currentColor`, black by default;
  set `color` when inlining, or change the fill for a standalone white export.
- [Light-background wordmark](audivane-logo.svg): navy symbol and lettering.
- [Dark-background wordmark](audivane-logo-dark.svg): paper symbol and lettering.
- [Transparent PNG symbol](audivane-mark.png): 1024 × 1024 raster export of the navy symbol.
- [Avatar](audivane-avatar.png): 500 × 500 full-bleed navy square for GitHub and similar profile images (the host rounds the corners).
- [Preview sheet](audivane-preview.png): light/dark wordmarks and icon sizes.
- [GitHub social preview](social-preview.png): 1280 × 640 link card for the repository's Settings → Social preview
  (rendered by the website's `npm run social`).

The SVGs are the source assets. All lettering is outlined, so rendering does not
depend on installed fonts, network access, embedded bitmap data or external files.
The preview and PNG were rendered from these SVGs; they are not image-generated.

## Use

Keep the internal gap open. Preserve the square symbol viewBox and leave at
least one stem-width of clear space around the visible symbol. Use the supplied
light/dark wordmark rather than putting charcoal lettering on a dark surface.
Prefer the standalone mark below a 160 px total logo width; use the supplied
simple geometry at 16/24/32 px rather than adding fine details.

Colors are the shared Audivane surfaces: navy `#0b1020` and paper `#f5f3ee`
(the Midnight background and the Light background of the apps and website).
On paper the symbol is navy; on navy it is paper. App icons and favicons are a
navy tile (edge `#2b3756`) with the paper symbol, so they read on light and
dark backgrounds alike. Product accents (DSP blue, ABX copper) stay inside the
apps and are not used in the logo. Audivane DSP's app icon uses its own wave
glyph in the same tile style (`dsp/assets/brand/audivane-dsp-icon.svg`).
The wordmark is outlined from the project's IBM Plex Sans Medium font. Its
[SIL Open Font License and attribution](../../apps/client/public/ibm-plex-OFL.txt)
remain with the project; the logo requires no font installation.
The original symbol is covered by the project [AGPL-3.0-only license](../../LICENSE).

Raster icon exports live in `icons/` (16–512 px PNG and a Windows ICO). The
original SVG remains the source. The app header, browser favicon and site icons
use this identity. Stable scientific/export identifiers do not need to change
with the display branding.
