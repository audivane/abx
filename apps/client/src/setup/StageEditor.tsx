import type { ChangeEvent, JSX } from "react";
import {
  CODEC_CATALOG,
  CODEC_IDS,
  type CodecCapability,
  type CodecId,
  type CodecSelection,
  type EngineCapabilities,
  type Side,
} from "@codec-abx/contracts";

import { chainLabel, codecLabel } from "../codecs";

export function availability(
  capabilities: EngineCapabilities | null,
  codecId: CodecId,
): CodecCapability | null {
  return (
    capabilities?.codecs.find((codec) => codec.codecId === codecId) ?? null
  );
}

export function isAvailable(codec: CodecCapability | null): boolean {
  return codec?.availability === "available";
}

function preferredBitrate(codecId: CodecId): number {
  const options = CODEC_CATALOG[codecId].bitrateOptionsKbps;
  if (options.length === 0) return 0;
  if (options.includes(128)) return 128;
  return options[Math.floor(options.length / 2)] ?? options[0] ?? 0;
}

export function stageSelection(
  codecId: CodecId,
  currentBitrate: number,
): CodecSelection {
  const options = CODEC_CATALOG[codecId].bitrateOptionsKbps;
  // A codec switch keeps the requested rate when it is valid for the new
  // codec; otherwise it picks a sensible catalog rate. No substitution occurs
  // silently on prepare, because the UI state is the request.
  const bitrateKbps = options.includes(currentBitrate)
    ? currentBitrate
    : preferredBitrate(codecId);
  return Object.freeze({ codecId, bitrateKbps });
}

function addableSelection(
  capabilities: EngineCapabilities | null,
): CodecSelection | null {
  if (capabilities === null) return null;
  const candidates = CODEC_IDS.filter(
    (codecId) =>
      codecId !== "noop_passthrough" &&
      capabilities.codecs.some(
        (codec) =>
          codec.codecId === codecId && codec.availability === "available",
      ),
  );
  const chosen =
    candidates[0] ??
    (capabilities.codecs.some(
      (codec) =>
        codec.codecId === "noop_passthrough" &&
        codec.availability === "available",
    )
      ? "noop_passthrough"
      : null);
  return chosen === null
    ? null
    : stageSelection(chosen, preferredBitrate(chosen));
}

function stageControlIds(
  side: Side,
  index: number,
): { readonly codec: string; readonly bitrate: string } {
  return index === 0
    ? { codec: `codec-${side}`, bitrate: `bitrate-${side}` }
    : {
        codec: `codec-${side}-${index + 1}`,
        bitrate: `bitrate-${side}-${index + 1}`,
      };
}

/** One side of the comparison: a big letter, its ordered stages and Add stage. */
export function StageEditor(props: {
  readonly side: Side;
  readonly stages: readonly CodecSelection[];
  readonly capabilities: EngineCapabilities | null;
  readonly maxStages: number;
  readonly disabled: boolean;
  readonly onChange: (stages: readonly CodecSelection[]) => void;
}): JSX.Element {
  const sideLabel = props.side.toUpperCase();
  const replace = (index: number, selection: CodecSelection): void => {
    const next = props.stages.map((stage, stageIndex) =>
      stageIndex === index ? selection : stage,
    );
    props.onChange(Object.freeze(next));
  };
  const move = (index: number, offset: -1 | 1): void => {
    const target = index + offset;
    if (target < 0 || target >= props.stages.length) return;
    const next = [...props.stages];
    const value = next[index]!;
    next[index] = next[target]!;
    next[target] = value;
    props.onChange(Object.freeze(next));
  };
  const addable = addableSelection(props.capabilities);
  // At the stage limit, Add stage is not offered at all. While the setup is
  // locked the whole fieldset is disabled and the lock banner explains why.
  const showAdd =
    props.capabilities !== null &&
    props.stages.length < props.maxStages &&
    addable !== null;
  return (
    <fieldset
      className="side-card stage-editor"
      data-side={props.side}
      data-stage-count={props.stages.length}
      disabled={props.disabled}
    >
      <legend className="sr-only">Side {sideLabel}</legend>
      <div className="side-head" aria-hidden="true">
        <span className="side-letter">{sideLabel}</span>
        <span className="side-title">
          <small>
            Side {sideLabel}
            {props.stages.length > 1 ? `, ${props.stages.length} stages` : ""}
          </small>
          <b>{chainLabel(props.stages)}</b>
        </span>
      </div>
      <ol className="stage-list">
        {props.stages.map((stage, index) => {
          const ids = stageControlIds(props.side, index);
          const capability = availability(props.capabilities, stage.codecId);
          const options = CODEC_CATALOG[stage.codecId].bitrateOptionsKbps;
          const stageLabel =
            props.stages.length === 1
              ? `Side ${sideLabel}`
              : `Side ${sideLabel} stage ${index + 1}`;
          return (
            <li
              className="stage-row"
              key={`${props.side}-${index}`}
              data-stage-index={index + 1}
            >
              {props.stages.length > 1 ? (
                <span className="stage-index" aria-hidden="true">
                  {index + 1}
                </span>
              ) : null}
              <div className="stage-fields">
                <div className="field">
                  <label htmlFor={ids.codec}>Codec</label>
                  <select
                    id={ids.codec}
                    aria-label={`${stageLabel} codec`}
                    value={stage.codecId}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      replace(
                        index,
                        stageSelection(
                          event.target.value as CodecId,
                          stage.bitrateKbps,
                        ),
                      );
                    }}
                  >
                    {CODEC_IDS.map((codecId) => {
                      const codec = availability(props.capabilities, codecId);
                      const reason = codec?.reason ?? null;
                      return (
                        <option
                          key={codecId}
                          value={codecId}
                          disabled={!isAvailable(codec)}
                        >
                          {codecLabel(codecId)}
                          {codec && !isAvailable(codec)
                            ? ` (${codec.availability}${reason ? `: ${reason}` : ""})`
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={ids.bitrate}>Bitrate</label>
                  <select
                    id={ids.bitrate}
                    aria-label={`${stageLabel} bitrate`}
                    value={String(stage.bitrateKbps)}
                    disabled={options.length <= 1}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                      replace(
                        index,
                        Object.freeze({
                          codecId: stage.codecId,
                          bitrateKbps: Number(event.target.value),
                        }),
                      );
                    }}
                  >
                    {options.map((rate) => (
                      <option key={rate} value={String(rate)}>
                        {rate === 0 ? "Not applicable" : `${rate} kbps`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {props.stages.length > 1 && (
                <div className="stage-actions">
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={`Remove side ${sideLabel} stage ${index + 1}`}
                    onClick={() =>
                      props.onChange(
                        Object.freeze(
                          props.stages.filter(
                            (_value, stageIndex) => stageIndex !== index,
                          ),
                        ),
                      )
                    }
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={`Move side ${sideLabel} stage ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={`Move side ${sideLabel} stage ${index + 1} down`}
                    disabled={index === props.stages.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Down
                  </button>
                </div>
              )}
              {capability && !isAvailable(capability) ? (
                <p className="stage-note status-error">
                  {capability.reason ?? "Availability is not established yet."}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {showAdd ? (
        <button
          type="button"
          className="add-stage"
          aria-label={`Add side ${sideLabel} stage`}
          onClick={() => {
            const selection = addableSelection(props.capabilities);
            if (selection === null) return;
            props.onChange(Object.freeze([...props.stages, selection]));
          }}
        >
          <span aria-hidden="true">+ </span>Add stage
        </button>
      ) : null}
    </fieldset>
  );
}
