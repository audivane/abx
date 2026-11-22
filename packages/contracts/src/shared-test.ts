/**
 * Shareable test setups: both codec chains and the run plan, carried in a
 * readable URL fragment so nothing reaches a server, e.g.
 * `#a=opus-128&b=aac-256,mp3-320&trials=16&labels=blind`.
 * A link never carries audio, results or run secrets. The optional file name
 * only tells a recipient which track the sharer used; it never gates anything.
 */
import { AUDIO_MAX_DURATION_SECONDS } from "./audio-limits.js";
import type { ExperimentPlan } from "./experiment.js";
import {
  CODEC_CATALOG,
  CODEC_IDS,
  type CodecId,
  type CodecSelection,
  type SampleRateMode,
} from "./index.js";

export const SHARED_TEST_MAX_STAGES = 4;
export const SHARED_TEST_MIN_TRIALS = 1;
export const SHARED_TEST_MAX_TRIALS = 1000;
/** Longer file names are shortened when sharing; percent-encoding can make each character nine. */
export const SHARED_TEST_MAX_TITLE_CHARS = 80;
/** Whole-fragment limit, well above any valid setup with a file name, and within a level-H QR code. */
export const SHARED_TEST_MAX_FRAGMENT_CHARS = 1024;
const DEFAULT_ALPHA = 0.05;

export interface SharedSourceHint {
  /** The sharer's file name, as shown to them. */
  readonly title: string;
  /** Delivered length, when the sharer had prepared audio. */
  readonly durationSeconds?: number;
}

export interface SharedTest {
  readonly a: readonly CodecSelection[];
  readonly b: readonly CodecSelection[];
  readonly sampleRateMode: SampleRateMode;
  /** One opt-in in the app: canary material and the calibration trial. */
  readonly canaryEnabled: boolean;
  readonly plan: ExperimentPlan & { readonly plannedTrials: number };
  readonly source?: SharedSourceHint;
}

export type SharedTestParse =
  | { readonly status: "none" }
  | { readonly status: "ok"; readonly test: SharedTest }
  | { readonly status: "invalid"; readonly reason: string };

/*
 * Keys: a, b (stages joined by ","; each `<codec>-<kbps>`, `lossless`, or a
 * fixed-rate codec alone), trials, labels (blind|fixed), and the optional
 * rate=48k, alpha=<0.xxx> (default 0.05), check=1, file (+ len).
 * Omitted options take their defaults; unknown or repeated keys are refused.
 */
const KEYS = ["a", "b", "trials", "labels", "rate", "alpha", "check", "file", "len"] as const;
type Key = typeof KEYS[number];

const CODEC_SLUGS: Readonly<Record<CodecId, string>> = Object.freeze({
  noop_passthrough: "lossless",
  opus: "opus",
  aac: "aac",
  ogg_vorbis: "vorbis",
  mp3: "mp3",
  mp2: "mp2",
  lc3: "lc3",
  sbc: "sbc",
  aptx: "aptx",
  aptx_hd: "aptx-hd",
  ldac: "ldac",
});
// Built on first use: index.ts imports this module before CODEC_IDS exists.
let codecBySlug: ReadonlyMap<string, CodecId> | null = null;
function codecForSlug(slug: string): CodecId | undefined {
  codecBySlug ??= new Map(CODEC_IDS.map((codecId) => [CODEC_SLUGS[codecId], codecId] as const));
  return codecBySlug.get(slug);
}

class ShareError extends Error {}
function fail(reason: string): never {
  throw new ShareError(reason);
}

function stageSlug(stage: CodecSelection): string {
  const slug = CODEC_SLUGS[stage.codecId];
  return CODEC_CATALOG[stage.codecId].bitrateOptionsKbps.length === 1 ? slug : `${slug}-${stage.bitrateKbps}`;
}

function chain(text: string | undefined, side: "A" | "B"): readonly CodecSelection[] {
  if (text === undefined) fail(`The link has no side ${side}.`);
  const parts = text.split(",");
  if (parts.length > SHARED_TEST_MAX_STAGES) fail(`Side ${side} can have at most ${SHARED_TEST_MAX_STAGES} stages.`);
  return Object.freeze(parts.map((part, index): CodecSelection => {
    const stage = `Side ${side} stage ${index + 1}`;
    // A whole-part match first keeps hyphenated names such as "aptx-hd" intact.
    let codecId = codecForSlug(part);
    let bitrateText: string | null = null;
    if (codecId === undefined) {
      const dash = part.lastIndexOf("-");
      codecId = dash > 0 ? codecForSlug(part.slice(0, dash)) : undefined;
      if (codecId === undefined) fail(`${stage} uses an unknown codec.`);
      bitrateText = part.slice(dash + 1);
    }
    const entry = CODEC_CATALOG[codecId];
    if (bitrateText === null) {
      if (entry.bitrateOptionsKbps.length !== 1) fail(`${stage} needs a bitrate, e.g. ${CODEC_SLUGS[codecId]}-${entry.bitrateOptionsKbps.at(-1)}.`);
      return Object.freeze({ codecId, bitrateKbps: entry.bitrateOptionsKbps[0]! });
    }
    const bitrate = /^[1-9][0-9]{0,3}$/.test(bitrateText) ? Number(bitrateText) : NaN;
    if (entry.bitrateOptionsKbps.length === 1 || !entry.bitrateOptionsKbps.includes(bitrate)) {
      fail(`${stage} uses a bitrate ${entry.displayName} does not offer.`);
    }
    return Object.freeze({ codecId, bitrateKbps: bitrate });
  }));
}

function sourceHint(params: ReadonlyMap<Key, string>): SharedSourceHint | undefined {
  const title = params.get("file");
  const len = params.get("len");
  if (title === undefined && len === undefined) return undefined;
  if (title === undefined) fail("The link has a file length but no file name.");
  if (title.length < 1 || title.length > SHARED_TEST_MAX_TITLE_CHARS ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(title)) fail("The file name in the link is not valid.");
  let durationSeconds: number | undefined;
  if (len !== undefined) {
    durationSeconds = /^[0-9]{1,5}(\.[0-9])?$/.test(len) ? Number(len) : NaN;
    if (!(durationSeconds > 0 && durationSeconds <= AUDIO_MAX_DURATION_SECONDS)) fail("The file length in the link is not valid.");
  }
  return Object.freeze({ title, ...(durationSeconds === undefined ? {} : { durationSeconds }) });
}

/** Split a fragment into decoded key/value pairs. Values keep "+" (not a space). */
function readParams(fragment: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of fragment.split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) fail("The link is damaged.");
    let key: string, value: string;
    try {
      key = decodeURIComponent(pair.slice(0, eq));
      value = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      fail("The link is damaged.");
    }
    if (params.has(key)) fail(`The link repeats the setting "${key.slice(0, 32)}".`);
    params.set(key, value);
  }
  return params;
}

function sharedTestFromParams(raw: Map<string, string>): SharedTest {
  for (const key of raw.keys()) {
    if (!(KEYS as readonly string[]).includes(key)) fail(`The link has an unknown setting "${key.slice(0, 32)}".`);
  }
  const params = raw as Map<Key, string>;
  const a = chain(params.get("a"), "A");
  const b = chain(params.get("b"), "B");
  const trialsText = params.get("trials");
  const trials = trialsText !== undefined && /^[1-9][0-9]{0,3}$/.test(trialsText) ? Number(trialsText) : NaN;
  if (!(trials >= SHARED_TEST_MIN_TRIALS && trials <= SHARED_TEST_MAX_TRIALS)) {
    fail(`Trials must be a whole number from ${SHARED_TEST_MIN_TRIALS} to ${SHARED_TEST_MAX_TRIALS}.`);
  }
  const labels = params.get("labels");
  if (labels !== "blind" && labels !== "fixed") fail("Labels must be blind or fixed.");
  const rate = params.get("rate");
  if (rate !== undefined && rate !== "48k") fail("The sample-rate setting is not valid.");
  const alphaText = params.get("alpha");
  const alpha = alphaText === undefined ? DEFAULT_ALPHA : /^0\.[0-9]{1,6}$/.test(alphaText) ? Number(alphaText) : NaN;
  if (!(alpha > 0 && alpha < 1)) fail("The significance level must be between 0 and 1.");
  const checkText = params.get("check");
  if (checkText !== undefined && checkText !== "1") fail("The readiness check setting is not valid.");
  const check = checkText === "1";
  const source = sourceHint(params);
  return Object.freeze({
    a,
    b,
    sampleRateMode: rate === "48k" ? "force_48k" as const : "native" as const,
    canaryEnabled: check,
    plan: Object.freeze({
      version: 1 as const,
      plannedTrials: trials,
      alpha,
      labelMode: labels === "blind" ? "blind_random" as const : "fixed" as const,
      calibrationEnabled: check,
    }),
    ...(source === undefined ? {} : { source }),
  });
}

/** Shorten to the title limit without splitting a surrogate pair. */
function shortTitle(title: string): string {
  if (title.length <= SHARED_TEST_MAX_TITLE_CHARS) return title;
  let cut = SHARED_TEST_MAX_TITLE_CHARS;
  if (/[\ud800-\udbff]/.test(title[cut - 1]!)) cut -= 1;
  return title.slice(0, cut);
}

/** "+" and "," stay readable; everything else is escaped as usual. */
function encodeValue(value: string): string {
  return encodeURIComponent(value).replace(/%2C/g, ",");
}

/** The fragment without "#". Throws if the setup is not shareable. */
export function encodeSharedTest(test: SharedTest): string {
  if (test.canaryEnabled !== test.plan.calibrationEnabled) {
    throw new Error("The readiness check and calibration must match to share a test");
  }
  const pairs: [Key, string][] = [
    ["a", test.a.map(stageSlug).join(",")],
    ["b", test.b.map(stageSlug).join(",")],
    ["trials", String(test.plan.plannedTrials)],
    ["labels", test.plan.labelMode === "blind_random" ? "blind" : "fixed"],
  ];
  if (test.sampleRateMode === "force_48k") pairs.push(["rate", "48k"]);
  if (test.plan.alpha !== DEFAULT_ALPHA) pairs.push(["alpha", String(test.plan.alpha)]);
  if (test.canaryEnabled) pairs.push(["check", "1"]);
  if (test.source !== undefined) {
    pairs.push(["file", shortTitle(test.source.title)]);
    if (test.source.durationSeconds !== undefined) {
      pairs.push(["len", String(Math.round(test.source.durationSeconds * 10) / 10)]);
    }
  }
  const fragment = pairs.map(([key, value]) => `${key}=${encodeValue(value)}`).join("&");
  // Encoding goes through the same parser so a link is never produced that
  // the recipient would refuse.
  const check = parseSharedTestFragment(fragment);
  if (check.status !== "ok") throw new Error(`The test setup cannot be shared: ${check.status === "invalid" ? check.reason : "not a test link"}`);
  return fragment;
}

/** Full link: origin plus app base path plus the fragment. */
export function sharedTestUrl(origin: string, basePath: string, test: SharedTest): string {
  const url = new URL(basePath, origin);
  url.search = "";
  url.hash = encodeSharedTest(test);
  return url.href;
}

/**
 * Parse `location.hash` (with or without "#"). A fragment is a test link when
 * it sets `a` or `b`; anything else returns "none". A test link that fails any
 * check returns "invalid".
 */
export function parseSharedTestFragment(hash: string): SharedTestParse {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!/(^|&)[ab]=/.test(fragment)) return { status: "none" };
  try {
    if (fragment.length > SHARED_TEST_MAX_FRAGMENT_CHARS) fail("The link is too long.");
    return { status: "ok", test: sharedTestFromParams(readParams(fragment)) };
  } catch (error) {
    if (error instanceof ShareError) return { status: "invalid", reason: error.message };
    throw error;
  }
}
