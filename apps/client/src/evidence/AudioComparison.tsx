import { useCallback, useEffect, useRef, useState, type JSX, type ReactNode, type RefCallback } from "react";
import type { EvidenceDetailsState, EvidenceDetailsChange } from "./details";
import type {
  CanarySide,
  CodecSelection,
  LevelMeasurement,
  PreparedArtifact,
  Side,
  TrackProvenance,
} from "@codec-abx/contracts";
import { chainLabel } from "../codecs";
import { formatChannels, formatClock, formatLength, formatRate } from "../format";

function formatLevel(
  level: LevelMeasurement,
  unit: string,
  meanings: { readonly negative: string; readonly missing: string },
): string {
  switch (level.status) {
    case "finite":
      return `${level.value.toFixed(2)} ${unit}`;
    case "negative-infinity":
      return `−∞ ${unit} — ${meanings.negative}`;
    case "undefined":
      return `undefined — ${meanings.missing} (${level.reason})`;
    case "unavailable":
      return `unavailable — ${level.reason}`;
  }
}

/** "−16.00 / −16.00 LUFS" when both are finite, otherwise each in full. */
function formatPair(
  a: LevelMeasurement,
  b: LevelMeasurement,
  unit: string,
  meanings: { readonly negative: string; readonly missing: string },
): string {
  if (a.status === "finite" && b.status === "finite")
    return `${a.value.toFixed(2)} / ${b.value.toFixed(2)} ${unit}`;
  return `A ${formatLevel(a, unit, meanings)} · B ${formatLevel(b, unit, meanings)}`;
}

const LOUDNESS_MEANINGS = {
  negative: "digital silence or below the absolute loudness gate",
  missing: "no finite integrated level",
} as const;

const PEAK_MEANINGS = {
  negative: "digital silence",
  missing: "no defined peak",
} as const;

const NULL_MEANINGS = {
  negative: "exact digital null",
  missing: "silent reference; the ratio is not defined",
} as const;

const DELTA_MEANINGS = {
  negative: "an exact level difference is not a finite dB delta",
  missing: "at least one side has no finite integrated level",
} as const;

function trackStages(track: TrackProvenance): readonly CodecSelection[] {
  return track.stages && track.stages.length > 0
    ? track.stages.map((stage) => stage.requested)
    : [track.requested];
}

/**
 * A labelled preview player: the side letter sits on the player itself so A
 * and B can never be confused. The first press loads that side's delivered
 * WAV; later presses play and pause the element. Only one preview plays at a
 * time.
 */
function LabelledPlayer(props: {
  readonly side: Side;
  readonly url: string | null;
  readonly durationSeconds: number;
  readonly disabled: boolean;
  readonly audioRef: RefCallback<HTMLAudioElement>;
  readonly onLoad: () => void;
  readonly onPlayStarted: (side: Side) => void;
  readonly register: (side: Side, element: HTMLAudioElement | null) => void;
}): JSX.Element {
  const letter = props.side.toUpperCase();
  const element = useRef<HTMLAudioElement | null>(null);
  const pendingPlay = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(props.durationSeconds);

  useEffect(() => {
    if (props.url === null) {
      setPlaying(false);
      setPosition(0);
    }
  }, [props.url]);

  // A stable ref callback: React must not detach and re-attach the element on
  // every render, because the owner's detach path stops and unloads it.
  const latest = useRef(props);
  latest.current = props;
  const setElement = useCallback((node: HTMLAudioElement | null): void => {
    element.current = node;
    latest.current.register(latest.current.side, node);
    latest.current.audioRef(node);
    if (node !== null && pendingPlay.current) {
      pendingPlay.current = false;
      void node.play().catch(() => undefined);
    }
  }, []);

  const loaded = props.url !== null;
  return (
    <div className="player" data-side={props.side}>
      <button
        type="button"
        className="player-toggle"
        aria-label={!loaded ? `Preview ${letter}` : playing ? `Pause ${letter}` : `Play ${letter}`}
        disabled={props.disabled}
        onClick={() => {
          const node = element.current;
          if (!loaded || node === null) {
            pendingPlay.current = true;
            props.onLoad();
            return;
          }
          if (node.paused) void node.play().catch(() => undefined);
          else node.pause();
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          {playing ? (
            <>
              <rect x="2" y="1.5" width="3" height="9" rx=".6" />
              <rect x="7" y="1.5" width="3" height="9" rx=".6" />
            </>
          ) : (
            <path d="M3 1.5v9l7.5-4.5z" />
          )}
        </svg>
      </button>
      <span className="player-side" aria-hidden="true">
        {letter}
      </span>
      <input
        type="range"
        className="player-bar"
        aria-label={`Side ${letter} position`}
        min={0}
        max={Math.max(0.001, duration)}
        step={0.01}
        value={Math.min(position, duration)}
        disabled={!loaded || props.disabled}
        style={{ ["--fill" as string]: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%` }}
        onChange={(event) => {
          const node = element.current;
          if (node) node.currentTime = Number(event.target.value);
        }}
      />
      <span className="player-time">
        {formatClock(position)} / {formatClock(duration)}
      </span>
      {props.url !== null ? (
        <audio
          ref={setElement}
          preload="metadata"
          src={props.url}
          aria-label={`Side ${letter} preview`}
          onPlay={() => {
            setPlaying(true);
            props.onPlayStarted(props.side);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setDuration(value);
          }}
        />
      ) : null}
    </div>
  );
}

function TrackCard(props: {
  readonly side: Side;
  readonly artifact: PreparedArtifact;
  readonly actionsDisabled: boolean;
  readonly audioBlocked: boolean;
  readonly url: string | null;
  readonly audioRef: RefCallback<HTMLAudioElement>;
  readonly onLoadSample: (side: Side) => void;
  readonly onDownloadWav: (side: Side) => void;
  readonly onPlayStarted: (side: Side) => void;
  readonly register: (side: Side, element: HTMLAudioElement | null) => void;
}): JSX.Element {
  const letter = props.side.toUpperCase();
  const track = props.side === "a" ? props.artifact.a : props.artifact.b;
  const delivered = track.delivered;
  const duration =
    delivered.sampleRate > 0 ? delivered.frames / delivered.sampleRate : 0;
  return (
    <article className="track-card side-card" data-side={props.side} aria-label={`Delivered side ${letter}`}>
      <header className="side-head">
        <span className="side-letter" aria-hidden="true">
          {letter}
        </span>
        <span className="side-title">
          <b>
            <span className="sr-only">Side {letter}: </span>
            {chainLabel(trackStages(track))}
          </b>
          <small>
            Delivered {formatRate(delivered.sampleRate)} ·{" "}
            {formatChannels(delivered.channels)} · {formatLength(duration)}
          </small>
        </span>
      </header>
      {props.audioBlocked ? null : (
        <>
          <LabelledPlayer
            side={props.side}
            url={props.url}
            durationSeconds={duration}
            disabled={props.actionsDisabled}
            audioRef={props.audioRef}
            onLoad={() => props.onLoadSample(props.side)}
            onPlayStarted={props.onPlayStarted}
            register={props.register}
          />
          <div className="track-actions">
            <button
              type="button"
              className="ghost small"
              disabled={props.actionsDisabled}
              onClick={() => props.onDownloadWav(props.side)}
            >
              Download WAV {letter}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function CanaryMaterialPanel(props: {
  readonly artifact: PreparedArtifact;
  readonly actionsDisabled: boolean;
  readonly audioBlocked: boolean;
  readonly detailsState: EvidenceDetailsState;
  readonly onDetailsChange: EvidenceDetailsChange;
  readonly samples: Readonly<Record<CanarySide, string | null>>;
  readonly audioRefs: Readonly<Record<CanarySide, RefCallback<HTMLAudioElement>>>;
  readonly onLoad: (side: CanarySide) => void;
  readonly onDownload: (side: CanarySide) => void;
}): JSX.Element | null {
  const canary = props.artifact.canary;
  if (!canary) return null;
  const report = canary.report;
  return (
    <section className="canary" aria-labelledby="canary-heading">
      <div className="gate-line">
        <h3 id="canary-heading">
          Diagnostic canary material · <code>{report.policy}</code>
        </h3>
        <p className="card-meta">
          <strong>{report.status}</strong> · usable{" "}
          <code>{String(report.usable)}</code>
        </p>
      </div>
      {canary.audio ? (
        <div className="track-actions canary-actions">
          {(["pristine", "degraded"] as const).map((side) => (
            <span key={side} className="action-pair">
              <button
                type="button"
                className="ghost small"
                disabled={props.actionsDisabled}
                onClick={() => props.onLoad(side)}
              >
                Load canary sample {side}
              </button>
              <button
                type="button"
                className="ghost small"
                disabled={props.actionsDisabled}
                onClick={() => props.onDownload(side)}
              >
                Download canary WAV {side}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="warning" role="alert">
          <strong>No canary bytes retained or served.</strong> The material
          check did not pass, so this artifact keeps only the measured report.
          Nothing was silently substituted.
        </p>
      )}
      {!props.audioBlocked && (props.samples.pristine || props.samples.degraded) ? (
        <div className="diagnostic-audio">
          {(["pristine", "degraded"] as const).map((side) =>
            props.samples[side] ? (
              <label key={side} className="canary-player">
                <span>Canary {side}</span>
                <audio
                  ref={props.audioRefs[side]}
                  controls
                  preload="metadata"
                  src={props.samples[side]}
                  aria-label={`Canary ${side} preview`}
                />
              </label>
            ) : null,
          )}
        </div>
      ) : null}
      <details
        open={props.detailsState.canary}
        onToggle={(event) =>
          props.onDetailsChange("canary", event.currentTarget.open)
        }
      >
        <summary>Canary evidence and notes</summary>
        <p className="field-note">
          A measured, deliberately easy material check on the final delivered
          Side A. It is not proof of human audibility, a listener calibration
          trial or a scored ABX result. No listener canary gate is implemented.
        </p>
        <dl className="facts">
          <dt>Minimum residual</dt>
          <dd>{report.minimumResidualDb} dB (strictly greater is usable)</dd>
          <dt>Measured residual</dt>
          <dd>{formatLevel(report.depthDb, "dB", NULL_MEANINGS)}</dd>
          <dt>Reason</dt>
          <dd>{report.reason}</dd>
          <dt>Frozen material facts</dt>
          <dd>
            cutoff {report.cutoffHz} Hz · grid{" "}
            <code>{report.frequencyGrid}</code> · drive {report.drive}× · clip ±
            {report.clipLevel}
          </dd>
          <dt>Layout</dt>
          <dd>
            {report.sampleRate} Hz · {report.channels === 1 ? "mono" : "stereo"}{" "}
            · {report.frames} frames
          </dd>
          {canary.audio ? (
            <>
              <dt>Pristine WAV SHA-256</dt>
              <dd>
                <code>{canary.audio.pristine.wavSha256}</code>
              </dd>
              <dt>Degraded WAV SHA-256</dt>
              <dd>
                <code>{canary.audio.degraded.wavSha256}</code>
              </dd>
            </>
          ) : null}
        </dl>
        <ul>
          {report.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

type SampleSide = Side | CanarySide;

interface AudioComparisonProps {
  readonly artifact: PreparedArtifact;
  readonly actionsDisabled: boolean;
  /** A listening run is active: unblinded previews and downloads are withheld. */
  readonly audioBlocked: boolean;
  readonly detailsState: EvidenceDetailsState;
  readonly onDetailsChange: EvidenceDetailsChange;
  readonly samples: Readonly<Record<SampleSide, string | null>>;
  readonly audioRefs: Readonly<
    Record<SampleSide, RefCallback<HTMLAudioElement>>
  >;
  readonly onLoadSample: (side: Side) => void;
  readonly onDownloadWav: (side: Side) => void;
  readonly onLoadCanary: (side: CanarySide) => void;
  readonly onDownloadCanary: (side: CanarySide) => void;
  /** Optional action row rendered inside the card (Setup diagnostics). */
  readonly actions?: ReactNode;
}

export function AudioComparison({
  artifact,
  actionsDisabled,
  audioBlocked,
  detailsState,
  onDetailsChange,
  samples,
  audioRefs,
  onLoadSample,
  onDownloadWav,
  onLoadCanary,
  onDownloadCanary,
  actions,
}: AudioComparisonProps): JSX.Element {
  const delivered = artifact.measurements.delivered;
  const players = useRef<Partial<Record<Side, HTMLAudioElement | null>>>({});
  const register = (side: Side, element: HTMLAudioElement | null): void => {
    players.current[side] = element;
  };
  const onPlayStarted = (side: Side): void => {
    for (const other of ["a", "b"] as const) {
      if (other !== side) players.current[other]?.pause();
    }
  };
  return (
    <section className="card evidence-audio" aria-labelledby="results-heading">
      <div className="card-head">
        <h2 id="results-heading">Listen to each side</h2>
        <span className="card-meta">
          {audioBlocked ? "Available after the test" : "Unblinded — labels shown"}
        </span>
      </div>
      {audioBlocked ? (
        <p className="field-note" role="note">
          Unblinded A and B audio is withheld while the test is running. It is
          available here after the test ends.
        </p>
      ) : null}
      <div className="tracks delivered-grid">
        {(["a", "b"] as const).map((side) => (
          <TrackCard
            key={side}
            side={side}
            artifact={artifact}
            actionsDisabled={actionsDisabled}
            audioBlocked={audioBlocked}
            url={audioBlocked ? null : samples[side]}
            audioRef={audioRefs[side]}
            onLoadSample={onLoadSample}
            onDownloadWav={onDownloadWav}
            onPlayStarted={onPlayStarted}
            register={register}
          />
        ))}
      </div>
      {delivered ? (
        <dl className="measurements">
          <div>
            <dt>Loudness A / B</dt>
            <dd>
              {formatPair(
                delivered.a.integratedLufs,
                delivered.b.integratedLufs,
                "LUFS",
                LOUDNESS_MEANINGS,
              )}
            </dd>
          </div>
          <div>
            <dt>Loudness difference</dt>
            <dd>
              {formatLevel(delivered.loudnessDeltaDb, "dB", DELTA_MEANINGS)}
            </dd>
          </div>
          <div>
            <dt>Peak A / B</dt>
            <dd>
              {formatPair(
                delivered.a.samplePeakDbfs,
                delivered.b.samplePeakDbfs,
                "dBFS",
                PEAK_MEANINGS,
              )}
            </dd>
          </div>
          <div>
            <dt>Timing difference</dt>
            <dd>
              {delivered.alignment.status === "estimated"
                ? `${delivered.alignment.lagSamples} samples`
                : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt>Null depth</dt>
            <dd>
              {formatLevel(delivered.nullDepth.depthDb, "dB", NULL_MEANINGS)}
            </dd>
          </div>
        </dl>
      ) : null}
      <details
        className="disclosure files-details"
        open={detailsState.files}
        onToggle={(event) => onDetailsChange("files", event.currentTarget.open)}
      >
        <summary>Files and diagnostics</summary>
        <p className="field-note">
          Download results saves one JSON record with the run, its diagnostics,
          provenance and hashes.
        </p>
        <CanaryMaterialPanel
          artifact={artifact}
          actionsDisabled={actionsDisabled}
          audioBlocked={audioBlocked}
          detailsState={detailsState}
          onDetailsChange={onDetailsChange}
          samples={samples}
          audioRefs={audioRefs}
          onLoad={onLoadCanary}
          onDownload={onDownloadCanary}
        />
      </details>
      {actions}
    </section>
  );
}
