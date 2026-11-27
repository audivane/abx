import {
  CODEC_CATALOG,
  type CodecId,
  type CodecSelection,
} from "@codec-abx/contracts";

export function codecLabel(codecId: CodecId): string {
  if (codecId === "noop_passthrough") return "PCM16 passthrough (no-op)";
  if (codecId === "opus") return "Opus (libopus)";
  return CODEC_CATALOG[codecId].displayName;
}

/** Short stage label for summaries: "Opus 128 kbps", "PCM16 passthrough". */
export function stageLabel(stage: CodecSelection): string {
  if (stage.codecId === "noop_passthrough") return "PCM16 passthrough";
  return `${CODEC_CATALOG[stage.codecId].displayName} ${stage.bitrateKbps} kbps`;
}

/** One chain as ordered stages: "AAC 128 kbps → MP3 128 kbps". */
export function chainLabel(stages: readonly CodecSelection[]): string {
  return stages.length === 0 ? "-" : stages.map(stageLabel).join(" → ");
}
