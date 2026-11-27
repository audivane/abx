import assert from "node:assert/strict";
import test from "node:test";
import {
  SHARED_TEST_MAX_FRAGMENT_CHARS,
  SHARED_TEST_MAX_TITLE_CHARS,
  encodeSharedTest,
  parseSharedTestFragment,
  sharedTestUrl,
  type SharedTest,
} from "../src/index.js";

const base: SharedTest = {
  a: [{ codecId: "opus", bitrateKbps: 128 }],
  b: [{ codecId: "aac", bitrateKbps: 256 }, { codecId: "mp3", bitrateKbps: 320 }],
  sampleRateMode: "force_48k",
  canaryEnabled: true,
  plan: { version: 1, plannedTrials: 16, alpha: 0.05, labelMode: "blind_random", calibrationEnabled: true },
};

const valid = "a=opus-128&b=aac-256&trials=16&labels=blind";

test("links are readable and leave defaults out", () => {
  const plain: SharedTest = {
    ...base,
    b: [{ codecId: "aac", bitrateKbps: 256 }],
    sampleRateMode: "native",
    canaryEnabled: false,
    plan: { ...base.plan, calibrationEnabled: false },
  };
  assert.equal(sharedTestUrl("https://audivane.app", "/abx/", plain), `https://audivane.app/abx/#${valid}`);
  assert.equal(
    encodeSharedTest({
      ...base,
      a: [{ codecId: "noop_passthrough", bitrateKbps: 0 }],
      b: [{ codecId: "aptx_hd", bitrateKbps: 576 }, { codecId: "ogg_vorbis", bitrateKbps: 160 }],
      plan: { ...base.plan, alpha: 0.01, labelMode: "fixed" },
    }),
    "a=lossless&b=aptx-hd,vorbis-160&trials=16&labels=fixed&rate=48k&alpha=0.01&check=1",
  );
});

test("a shared setup round-trips through the link, with and without a file name", () => {
  const url = sharedTestUrl("https://audivane.app", "/abx/", base);
  const parsed = parseSharedTestFragment(new URL(url).hash);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.deepEqual(parsed.test, base);
  assert.ok(Object.isFrozen(parsed.test) && Object.isFrozen(parsed.test.a[0]));

  const withSource: SharedTest = {
    ...base,
    source: { title: "Pôr do Sol, Canção Lenta, takes 2 + 3.flac", durationSeconds: 231.44 },
  };
  const fragment = encodeSharedTest(withSource);
  assert.match(fragment, /&file=P%C3%B4r%20do%20Sol,%20Can%C3%A7%C3%A3o%20Lenta,%20takes%202%20%2B%203\.flac&len=231\.4$/);
  const again = parseSharedTestFragment(new URL(sharedTestUrl("https://audivane.app", "/abx/", withSource)).hash);
  assert.equal(again.status, "ok");
  if (again.status !== "ok") return;
  assert.deepEqual(again.test.source, { title: withSource.source!.title, durationSeconds: 231.4 });

  // Long names are shortened, never split inside a character.
  const long = encodeSharedTest({ ...base, source: { title: "x" + "😀".repeat(60) } });
  const shortened = parseSharedTestFragment(long);
  assert.equal(shortened.status, "ok");
  if (shortened.status !== "ok") return;
  assert.equal(shortened.test.source!.title, "x" + "😀".repeat(39));
  assert.ok(shortened.test.source!.title.length <= SHARED_TEST_MAX_TITLE_CHARS);

  // The largest possible setup stays within the fragment limit.
  const largest = encodeSharedTest({
    ...base,
    a: Array(4).fill({ codecId: "ogg_vorbis", bitrateKbps: 320 }),
    b: Array(4).fill({ codecId: "opus", bitrateKbps: 320 }),
    plan: { ...base.plan, plannedTrials: 1000, alpha: 0.012345, labelMode: "fixed" },
    source: { title: "音".repeat(200), durationSeconds: 1799.9 },
  });
  assert.ok(largest.length <= SHARED_TEST_MAX_FRAGMENT_CHARS, String(largest.length));

  assert.match(sharedTestUrl("http://127.0.0.1:5173", "/", base), /^http:\/\/127\.0\.0\.1:5173\/#a=opus-128&/);
});

test("fragments that are not test links are ignored", () => {
  for (const hash of ["", "#", "#main", "#top=1", "#x=1.abc", "#t=1.eyJh", "#ab=1"]) {
    assert.deepEqual(parseSharedTestFragment(hash), { status: "none" });
  }
});

test("bad links are rejected with a reason, never substituted", () => {
  const bad: readonly [string, string][] = [
    ["missing side", "#a=opus-128&trials=16&labels=blind"],
    ["empty side", "#a=&b=aac-256&trials=16&labels=blind"],
    ["unknown key", `#${valid}&secret=00`],
    ["repeated key", `#${valid}&trials=8`],
    ["bad escape", `#${valid}&file=%E2%80`],
    ["key without value", `#${valid}&check`],
    ["unknown codec", "#a=sim_ldac-990&b=aac-256&trials=16&labels=blind"],
    ["internal codec id", "#a=ogg_vorbis-160&b=aac-256&trials=16&labels=blind"],
    ["bitrate not in catalog", "#a=opus-128&b=aac-255&trials=16&labels=blind"],
    ["missing bitrate", "#a=opus&b=aac-256&trials=16&labels=blind"],
    ["bitrate on fixed-rate codec", "#a=aptx-352&b=aac-256&trials=16&labels=blind"],
    ["lossless with bitrate", "#a=lossless-128&b=aac-256&trials=16&labels=blind"],
    ["leading-zero bitrate", "#a=opus-0128&b=aac-256&trials=16&labels=blind"],
    ["empty stage", "#a=opus-128,&b=aac-256&trials=16&labels=blind"],
    ["five stages", "#a=opus-128&b=aac-256,aac-256,aac-256,aac-256,aac-256&trials=16&labels=blind"],
    ["no trials", "#a=opus-128&b=aac-256&labels=blind"],
    ["zero trials", "#a=opus-128&b=aac-256&trials=0&labels=blind"],
    ["too many trials", "#a=opus-128&b=aac-256&trials=1001&labels=blind"],
    ["fractional trials", "#a=opus-128&b=aac-256&trials=8.5&labels=blind"],
    ["no labels", "#a=opus-128&b=aac-256&trials=16"],
    ["unknown labels", "#a=opus-128&b=aac-256&trials=16&labels=shuffled"],
    ["unknown rate", `#${valid}&rate=44k1`],
    ["native rate spelled out", `#${valid}&rate=native`],
    ["alpha zero", `#${valid}&alpha=0`],
    ["alpha one", `#${valid}&alpha=1`],
    ["alpha exponent", `#${valid}&alpha=5e-2`],
    ["check not 1", `#${valid}&check=true`],
    ["length without file", `#${valid}&len=12`],
    ["hash (removed)", `#${valid}&file=a&sha256=${"0".repeat(64)}`],
    ["empty file name", `#${valid}&file=`],
    ["file control chars", `#${valid}&file=a%0Ab`],
    ["file too long", `#${valid}&file=${"a".repeat(SHARED_TEST_MAX_TITLE_CHARS + 1)}`],
    ["negative length", `#${valid}&file=a&len=-1`],
    ["length beyond limit", `#${valid}&file=a&len=99999`],
    ["oversized", `#${valid}&file=${"a".repeat(SHARED_TEST_MAX_FRAGMENT_CHARS)}`],
  ];
  for (const [name, hash] of bad) {
    const parsed = parseSharedTestFragment(hash);
    assert.equal(parsed.status, "invalid", name);
    if (parsed.status === "invalid") assert.ok(parsed.reason.length > 0 && parsed.reason.length < 120, name);
  }
  // The base link itself is valid, so each case fails for its own reason.
  assert.equal(parseSharedTestFragment(`#${valid}`).status, "ok");
});

test("encoding refuses setups the parser would reject", () => {
  assert.throws(() => encodeSharedTest({ ...base, canaryEnabled: false }));
  assert.throws(() => encodeSharedTest({ ...base, a: [{ codecId: "opus", bitrateKbps: 129 }] }));
  assert.throws(() => encodeSharedTest({ ...base, plan: { ...base.plan, plannedTrials: 0 } }));
  assert.throws(() => encodeSharedTest({ ...base, plan: { ...base.plan, alpha: 1e-7 } }));
});
