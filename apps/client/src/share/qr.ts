import { encode } from "uqr";

/** The Audivane split-A mark (assets/brand/audivane-mark.svg), 256 × 256 viewBox. */
export const BRAND_MARK_PATHS = Object.freeze([
  "M120 40c-9 0-15 7-19 17L36 201c-2 4 0 7 5 7h36l18-40h27v-24h-16l16-40V40z",
  "M136 40c9 0 15 7 19 17l65 144c2 4 0 7-5 7h-36l-18-40h-27v-24h16l-16-40V40z",
]);
const MARK_VIEWBOX = 256;
const DARK = "#0b1020";
const LIGHT = "#ffffff";
const QUIET_ZONE = 4;
/**
 * Share of the symbol width the logo plate may cover. Level H restores 30% of
 * codewords; a plate of 22% width covers under 5% of the modules, which leaves
 * a wide margin for print and camera noise.
 */
const LOGO_WIDTH_RATIO = 0.22;

export interface QrModel {
  /** Modules per side, including the quiet zone. */
  readonly size: number;
  /** `dark[y][x]`, with the modules under the logo plate cleared. */
  readonly dark: readonly (readonly boolean[])[];
  /** Logo plate in module units (square, centred). */
  readonly plate: { readonly x: number; readonly width: number };
}

export function qrModel(text: string): QrModel {
  const qr = encode(text, { ecc: "H", border: QUIET_ZONE });
  const symbol = qr.size - 2 * QUIET_ZONE;
  // Odd plate widths keep it centred on whole modules.
  let width = Math.max(3, Math.floor(symbol * LOGO_WIDTH_RATIO));
  if (width % 2 === 0) width -= 1;
  const x = Math.floor((qr.size - width) / 2);
  const dark = qr.data.map((row, y) =>
    row.map((on, column) =>
      on && !(column >= x && column < x + width && y >= x && y < x + width),
    ),
  );
  return { size: qr.size, dark, plate: { x, width } };
}

function modulePath(model: QrModel): string {
  const parts: string[] = [];
  model.dark.forEach((row, y) => {
    let run = -1;
    for (let x = 0; x <= row.length; x += 1) {
      const on = x < row.length && row[x];
      if (on && run < 0) run = x;
      if (!on && run >= 0) {
        parts.push(`M${run} ${y}h${x - run}v1h${run - x}z`);
        run = -1;
      }
    }
  });
  return parts.join("");
}

/** Mark placement inside the plate, in module units. */
function markBox(model: QrModel): { x: number; size: number } {
  const inset = model.plate.width * 0.12;
  return { x: model.plate.x + inset, size: model.plate.width - 2 * inset };
}

export function qrSvg(model: QrModel, title: string): string {
  const { size, plate } = model;
  const mark = markBox(model);
  const scale = mark.size / MARK_VIEWBOX;
  const escaped = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 8}" height="${size * 8}" shape-rendering="crispEdges">` +
    `<title>${escaped}</title>` +
    `<rect width="${size}" height="${size}" fill="${LIGHT}"/>` +
    `<path fill="${DARK}" d="${modulePath(model)}"/>` +
    `<rect x="${plate.x}" y="${plate.x}" width="${plate.width}" height="${plate.width}" rx="${plate.width * 0.18}" fill="${LIGHT}"/>` +
    `<g fill="${DARK}" shape-rendering="geometricPrecision" transform="translate(${mark.x} ${mark.x}) scale(${scale})">` +
    BRAND_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("") +
    `</g></svg>`
  );
}

/** Draw onto a canvas context at `scale` pixels per module (PNG export). */
export function drawQr(ctx: CanvasRenderingContext2D, model: QrModel, scale: number): void {
  const { size, plate } = model;
  ctx.fillStyle = LIGHT;
  ctx.fillRect(0, 0, size * scale, size * scale);
  ctx.fillStyle = DARK;
  model.dark.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) ctx.fillRect(x * scale, y * scale, scale, scale);
    }),
  );
  ctx.fillStyle = LIGHT;
  ctx.beginPath();
  ctx.roundRect(plate.x * scale, plate.x * scale, plate.width * scale, plate.width * scale, plate.width * 0.18 * scale);
  ctx.fill();
  const mark = markBox(model);
  ctx.save();
  ctx.translate(mark.x * scale, mark.x * scale);
  ctx.scale((mark.size * scale) / MARK_VIEWBOX, (mark.size * scale) / MARK_VIEWBOX);
  ctx.fillStyle = DARK;
  for (const d of BRAND_MARK_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}
