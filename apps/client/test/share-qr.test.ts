import assert from "node:assert/strict";
import test from "node:test";
import jsQR from "jsqr";
import { sharedTestUrl, type SharedTest } from "@codec-abx/contracts";
import { qrModel, qrSvg, type QrModel } from "../src/share/qr.js";

/** Rasterise at `scale` px per module; `markFill` paints the logo's box solid dark (worst case). */
function raster(model: QrModel, scale: number, markFill: boolean): { data: Uint8ClampedArray; width: number } {
  const width = model.size * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  const inset = model.plate.width * 0.12;
  const markStart = (model.plate.x + inset) * scale;
  const markEnd = (model.plate.x + model.plate.width - inset) * scale;
  for (let py = 0; py < width; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const dark = model.dark[Math.floor(py / scale)]![Math.floor(px / scale)] ||
        (markFill && px >= markStart && px < markEnd && py >= markStart && py < markEnd);
      if (dark) data.fill(0, (py * width + px) * 4, (py * width + px) * 4 + 3);
    }
  }
  return { data, width };
}

const setup: SharedTest = {
  a: [{ codecId: "opus", bitrateKbps: 128 }],
  b: [{ codecId: "aac", bitrateKbps: 256 }],
  sampleRateMode: "native",
  canaryEnabled: false,
  plan: { version: 1, plannedTrials: 16, alpha: 0.05, labelMode: "blind_random", calibrationEnabled: false },
};
const largest: SharedTest = {
  ...setup,
  a: Array(4).fill({ codecId: "ogg_vorbis", bitrateKbps: 320 }),
  b: Array(4).fill({ codecId: "aptx_hd", bitrateKbps: 576 }),
  canaryEnabled: true,
  plan: { ...setup.plan, plannedTrials: 1000, alpha: 0.012345, calibrationEnabled: true },
  source: { title: "音".repeat(200), durationSeconds: 1799.9 },
};

test("QR codes with the centre logo still decode to the exact link", () => {
  for (const shared of [setup, largest]) {
    const link = sharedTestUrl("https://audivane.app", "/abx/", shared);
    const model = qrModel(link);
    // The plate must stay a small share of the symbol (level H restores 30%).
    const symbol = model.size - 8;
    assert.ok((model.plate.width / symbol) ** 2 < 0.06);
    for (const markFill of [false, true]) {
      const { data, width } = raster(model, 4, markFill);
      const decoded = jsQR(data, width, width);
      assert.equal(decoded?.data, link, `decode (mark ${markFill ? "solid" : "cleared"}, ${link.length} chars)`);
    }
    assert.match(qrSvg(model, "Audivane ABX test"), /^<svg [^>]*viewBox="0 0 \d+ \d+"/);
  }
});
