import {
  CODEC_CATALOG,
  type CodecSelection,
  type SharedTest,
} from "@codec-abx/contracts";

function shortStage(stage: CodecSelection): string {
  if (stage.codecId === "noop_passthrough") return "Lossless";
  return `${CODEC_CATALOG[stage.codecId].displayName} ${stage.bitrateKbps}`;
}

function shortChain(stages: readonly CodecSelection[]): string {
  return stages.map(shortStage).join(" → ");
}

/** "Opus 128 vs AAC 256, 16 trials, blind labels". */
export function sharedTestSummary(test: SharedTest): string {
  const parts = [
    `${shortChain(test.a)} vs ${shortChain(test.b)}`,
    `${test.plan.plannedTrials} trial${test.plan.plannedTrials === 1 ? "" : "s"}`,
    test.plan.labelMode === "blind_random" ? "blind labels" : "fixed labels",
  ];
  if (test.canaryEnabled) parts.push("readiness check");
  if (test.sampleRateMode === "force_48k") parts.push("48 kHz");
  return parts.join(", ");
}

function sameStages(a: readonly CodecSelection[], b: readonly CodecSelection[]): boolean {
  return a.length === b.length &&
    a.every((stage, i) => stage.codecId === b[i]!.codecId && stage.bitrateKbps === b[i]!.bitrateKbps);
}

/** True when two setups carry the same chains and plan (the source hint is ignored). */
export function sameSharedSetup(x: SharedTest, y: SharedTest): boolean {
  return sameStages(x.a, y.a) && sameStages(x.b, y.b) &&
    x.sampleRateMode === y.sampleRateMode && x.canaryEnabled === y.canaryEnabled &&
    x.plan.plannedTrials === y.plan.plannedTrials && x.plan.alpha === y.plan.alpha &&
    x.plan.labelMode === y.plan.labelMode;
}
