import { useEffect, useId, useState, type JSX } from "react";

import type { PlaybackLabel, PreparedArtifact } from "@codec-abx/contracts";

import { formatClock } from "../format.js";
import { deviceLabel } from "../workspace/OutputDevicePanel.js";
import type { ListeningHook } from "./useListening.js";
import {
  calibrationMaterialAdvice,
  isRawCodecProbeArtifact,
  listeningArtifactEligibility,
} from "./model.js";
import { trialStartGateBlocker } from "./readiness.js";
import { useListeningShortcuts, useShortcutsEnabled } from "./shortcuts.js";
import type { RunTally } from "./useRunTally.js";
import { TrialTally } from "./TrialTally.js";

export type ListeningPrimaryPhase =
  | "idle"
  | "preparing"
  | "binding"
  | "staging"
  | "ready"
  | "cancelled"
  | "error";

export interface ListeningPrimary {
  readonly phase: ListeningPrimaryPhase;
  /** Preparation, binding or staging currently owns the primary action. */
  readonly busy: boolean;
  readonly message: string | null;
  readonly canPrepare: boolean;
  /** The retained artifact matches the current source, codecs, rate and opt-in. */
  readonly pairReady: boolean;
  readonly onPrepare: () => void;
  readonly onCancel: () => Promise<void>;
}

export interface ListeningSectionProps {
  readonly artifact: PreparedArtifact | null;
  readonly listening: ListeningHook;
  readonly primary: ListeningPrimary;
  /** The Listen view is the visible view; keyboard shortcuts apply only then. */
  readonly active: boolean;
  readonly tally: RunTally | null;
  readonly onDisableCalibration: () => void;
  readonly onReset: () => void;
  readonly onGoToSetup: () => void;
  readonly onViewResults: () => void;
}

const TILE_CAPTIONS: Readonly<Record<PlaybackLabel, string>> = {
  A: "Reference A",
  B: "Reference B",
  X: "Unknown: A or B?",
};

/** Segments for short plans; long plans use one continuous bar. */
const MAX_SEGMENTS = 40;

function PlayIcon(props: { readonly playing: boolean }): JSX.Element {
  return props.playing ? (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3" width="4.5" height="14" rx="1" />
      <rect x="11.5" y="3" width="4.5" height="14" rx="1" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6 3.5v13l11-6.5z" />
    </svg>
  );
}

function Equalizer(): JSX.Element {
  return (
    <span className="eq" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function ListeningSection(props: ListeningSectionProps): JSX.Element {
  const { artifact, listening, primary } = props;
  const { controller, state } = listening;
  const ids = useId();
  const [loopError, setLoopError] = useState<string | null>(null);
  const [loopStart, setLoopStart] = useState("0");
  const [loopEnd, setLoopEnd] = useState("0");
  const [lastFeedback, setLastFeedback] = useState<typeof state.feedback>(null);

  const eligibility = listeningArtifactEligibility(artifact);
  const rawArtifact = isRawCodecProbeArtifact(artifact);
  const playback = state.playback;
  const output = playback?.output;
  const trial = state.trial;
  const snapshot = state.snapshot;
  const busy = state.busy !== null;
  const planLocked = state.planLocked;
  const selectionRequired = playback?.selectionRequired === true;
  const carryingPrevious = playback?.carryingPreviousTrial === true;
  const selected = selectionRequired ? null : (playback?.selected ?? null);
  const playing = playback?.playing === true;
  const advice = artifact ? calibrationMaterialAdvice(artifact) : null;
  const feedback = state.feedback ?? lastFeedback;

  useEffect(() => {
    if (state.feedback !== null) {
      setLastFeedback(state.feedback);
      return;
    }
    if (state.trial === null) setLastFeedback(null);
  }, [state.feedback, state.trial]);

  useEffect(() => {
    if (playback === null) return;
    setLoopStart(String(playback.loop.startSeconds));
    setLoopEnd(
      String(
        playback.loop.endSeconds > playback.loop.startSeconds
          ? playback.loop.endSeconds
          : playback.durationSeconds,
      ),
    );
  }, [trial?.token, playback === null ? null : playback.durationSeconds]);

  const playbackReady = playback !== null && playback.phase === "ready";
  const outputPending = playback?.output?.pending != null;
  const controlsEnabled =
    playbackReady &&
    !state.answered &&
    state.busy === null &&
    state.pendingAnswer === null &&
    !state.outputBlocked &&
    !outputPending &&
    snapshot?.lifecycle === "running";
  const playEnabled = controlsEnabled && !selectionRequired && !playing;
  const pauseEnabled = playing && !state.outputBlocked;
  const answerEnabled =
    controlsEnabled &&
    !selectionRequired &&
    trial !== null &&
    playback?.trial?.token === trial.token &&
    playback.trial.runId === trial.runId;
  const terminal =
    state.session === "completed" ||
    state.session === "sealed" ||
    state.session === "void";
  const canNext =
    state.answered &&
    snapshot?.lifecycle === "running" &&
    state.busy === null &&
    !state.outputBlocked &&
    !outputPending;
  const calibrationBlocked =
    snapshot?.plan.calibrationEnabled === true &&
    snapshot.gates.calibrationStatus === "unavailable";

  const [shortcutsOn, setShortcutsOn] = useShortcutsEnabled();
  useListeningShortcuts(
    {
      active: props.active && shortcutsOn,
      playing,
      playEnabled,
      pauseEnabled,
      selectEnabled: controlsEnabled,
      answerEnabled: answerEnabled && !state.answered,
    },
    (action) => {
      if (action.kind === "toggle-playback") {
        if (playing) controller.pause();
        else void controller.play();
      } else if (action.kind === "select") {
        controller.select(action.label);
      } else {
        void controller.answer(action.answer);
      }
    },
  );

  const stageLoading =
    primary.busy ||
    state.session === "configuring" ||
    state.session === "closing" ||
    state.busy === "start" ||
    state.busy === "reset" ||
    state.busy === "next";
  const stageState: "idle" | "loading" | "ready" = stageLoading
    ? "loading"
    : trial !== null && !terminal
      ? "ready"
      : "idle";
  const stageTitle = terminal
    ? "Run ended"
    : stageLoading
      ? primary.phase === "preparing"
        ? "Preparing test…"
        : primary.phase === "binding"
          ? "Verifying prepared pair…"
          : primary.phase === "staging"
            ? "Loading trial 1…"
            : state.busy === "next"
              ? "Loading next trial…"
              : state.busy === "reset"
                ? "Resetting run…"
                : "Loading audio…"
      : trial !== null
        ? playing
          ? "Playing"
          : "Paused"
        : state.session === "configured"
          ? "Ready"
          : "Ready to listen";
  const startBlocker =
    snapshot === null ? null : trialStartGateBlocker(snapshot, artifact);
  const inlineStartBlocker =
    state.session === "configured" &&
    state.error === null &&
    startBlocker !== null &&
    startBlocker.code !== "artifact-unbound" &&
    startBlocker.code !== "calibration-unavailable"
      ? startBlocker.message
      : null;

  // Nothing prepared yet: an empty state with a way back to Setup, never a
  // disabled player. Cancelled or stopped preparation keeps its retry here.
  // A configured run whose trial 1 could not be staged (a refused gate or a
  // failed bind) also gets the empty state with its messages, not a player.
  const notPrepared =
    trial === null &&
    !primary.busy &&
    !stageLoading &&
    (state.session === "idle" || state.session === "configured");
  const configuredOnly = state.session === "configured";
  const canRetryPrepare =
    primary.phase === "error" ||
    primary.phase === "cancelled" ||
    (configuredOnly && state.error !== null);
  const emptyTitle =
    primary.phase === "cancelled"
      ? "Test preparation cancelled"
      : primary.phase === "error"
        ? "Test setup stopped"
        : configuredOnly
          ? "Trial 1 is not staged"
          : "Prepare a test first";
  const emptyMessage =
    primary.phase === "cancelled"
      ? (primary.message ??
        "Test preparation was cancelled. No trial was staged.")
      : primary.phase === "error"
        ? (primary.message ??
          "Test setup stopped before staging. Review the error above.")
        : configuredOnly
          ? "The listening run is configured but no trial is staged. Resolve the message above to continue."
          : primary.pairReady
          ? "Prepared pair ready. Prepare test stages trial 1 paused."
          : artifact !== null && eligibility === null
            ? "Inputs changed since the last preparation. Prepare test makes a matching pair."
            : "Choose a source and the two chains in Setup, then select Prepare test. Trial 1 is staged paused.";

  const heading = terminal
    ? snapshot?.lifecycle === "completed"
      ? "Test complete"
      : "Test ended"
    : primary.phase === "preparing" ||
        primary.phase === "binding" ||
        primary.phase === "staging"
      ? "Preparing test"
      : trial !== null
        ? null
        : "Listen";
  const plannedTrials = snapshot?.plan.plannedTrials ?? null;
  const scoredTrials = snapshot?.statistics.scoredTrials ?? 0;
  const currentScored =
    trial !== null && trial.kind === "scored" && !terminal
      ? trial.trialIndex
      : null;
  const subline =
    trial !== null && !terminal && trial.kind === "calibration"
      ? "Calibration, not scored"
      : !terminal && primary.busy
        ? (primary.message ?? "Aligning and level-matching both sides")
        : null;
  const completedAnswers =
    terminal &&
    snapshot !== null &&
    props.tally !== null &&
    props.tally.runId === snapshot.runId
      ? props.tally.rows
      : null;

  const applyLoop = (enabled: boolean): void => {
    if (playback === null) return;
    const start = Number(loopStart);
    const end = Number(loopEnd);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > playback.durationSeconds ||
      end - start < 0.01
    ) {
      setLoopError(
        "Loop needs finite bounds inside the clip with at least 10 ms between start and end.",
      );
      return;
    }
    setLoopError(null);
    controller.setLoop({ enabled, startSeconds: start, endSeconds: end });
  };

  const toggleLoop = (): void => {
    applyLoop(playback?.loop.enabled !== true);
  };

  const errorBlocks = (
    <>
      {state.session === "idle" &&
        artifact !== null &&
        eligibility !== null && (
          <p className="warning" role="alert">
            <strong>
              {rawArtifact ? "Prepared for diagnostics." : "This pair cannot be used for listening."}
            </strong>{" "}
            {eligibility}
            {rawArtifact
              ? " Prepare test replaces this diagnostic artifact with an aligned pair; the current artifact is released when the new preparation starts."
              : ""}
          </p>
        )}
      {state.outputBlocked && (
        <div className="status-error" role="alert">
          <strong>Output route changed after the plan locked.</strong> Playback
          was paused and Play, trial changes and answers are blocked. No
          fallback device or automatic resume is used, and the existing
          calibration cannot be assumed valid. Reset the run explicitly before
          continuing.
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={props.onReset}
            >
              Reset listening run to recover
            </button>
          </div>
        </div>
      )}
      {calibrationBlocked && (
        <div className="warning" role="alert">
          <strong>Calibration is requested but unavailable.</strong>{" "}
          {advice ?? "The bound canary material or reader is unavailable."}{" "}
          Start is blocked.
          <div className="actions">
            <button
              type="button"
              className="ghost"
              disabled={busy || planLocked}
              onClick={props.onDisableCalibration}
            >
              Disable calibration explicitly for this plan
            </button>
          </div>
        </div>
      )}
      {inlineStartBlocker && (
        <p className="warning" role="alert">
          {inlineStartBlocker}
        </p>
      )}
    </>
  );

  const fatalAndSetupErrors = (
    <>
      {state.session === "fatal" && (
        <div className="status-error" role="alert">
          <strong>This listening run is unavailable.</strong>{" "}
          {state.error?.message ?? "The dedicated experiment Worker failed."} No
          export is claimed to exist for the lost run. Start a new run
          explicitly; the runtime is never recreated silently.
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={() => void controller.closeSession()}
            >
              Discard unavailable run
            </button>
          </div>
        </div>
      )}

      {state.error !== null &&
        snapshot === null &&
        state.session !== "fatal" && (
          <div className="status-error" role="alert">
            <strong>Listening setup failed.</strong> {state.error.message}
            <div className="actions">
              <button
                type="button"
                className="ghost"
                disabled={busy || !artifact || eligibility !== null}
                onClick={primary.onPrepare}
              >
                Retry/check listening preparation
              </button>
              {state.session === "idle" ? null : (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => void controller.closeSession()}
                >
                  Close listening run
                </button>
              )}
            </div>
          </div>
        )}
    </>
  );

  const runErrors = (
    <>
      {snapshot !== null &&
        state.session !== "fatal" &&
        state.session !== "idle" && (
          <section className="listening-run" aria-labelledby={`${ids}-run`}>
            <h2 className="sr-only" id={`${ids}-run`}>
              Run: {snapshot.lifecycle}
            </h2>
            {state.error !== null && state.error.retry !== "answer" && (
              <div className="status-error" role="alert">
                <strong>
                  Listening error{" "}
                  {state.error.code ? `(${state.error.code})` : ""}:
                </strong>{" "}
                {state.error.message}
                {state.error.reasons.length > 0 ? (
                  <ul>
                    {state.error.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                {state.error.code === "calibration-unavailable" &&
                snapshot.lifecycle === "configured" ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy || planLocked}
                      onClick={props.onDisableCalibration}
                    >
                      Disable calibration explicitly for this plan
                    </button>
                  </div>
                ) : null}
                {state.error.retry === "load" && playback?.phase === "error" ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() => void controller.retryLoad()}
                    >
                      Retry trial load
                    </button>
                  </div>
                ) : null}
                {state.error.retry === "start" ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={busy}
                      onClick={() => void controller.start()}
                    >
                      Retry staging
                    </button>
                  </div>
                ) : null}
                {state.error.retry === "prepare" ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      disabled={
                        busy || planLocked || !artifact || eligibility !== null
                      }
                      onClick={primary.onPrepare}
                    >
                      Retry/check listening preparation
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            {playback?.phase === "error" && (
              <div className="status-error" role="alert">
                <strong>This A/B/X set failed to load atomically.</strong>{" "}
                {carryingPrevious
                  ? "Previous trial audio continues; answers stay disabled. Retry or end the test."
                  : "No partial audio is available."}{" "}
                {playback.error}
                <div className="actions">
                  <button
                    type="button"
                    className="primary"
                    disabled={busy}
                    onClick={() => void controller.retryLoad()}
                  >
                    Retry trial load
                  </button>
                </div>
              </div>
            )}
            {state.notice ? (
              <p className="field-note" role="status">
                {state.notice}
              </p>
            ) : null}
          </section>
        )}

    </>
  );

  const sessionDetails = (
    <>
        {snapshot === null ? null : (
          <details className="listen-context session-details">
            <summary>Session details</summary>
            <dl className="facts">
              <dt>Plan</dt>
              <dd>
                {snapshot.plan.plannedTrials ?? "practice"} trials, α{" "}
                {snapshot.plan.alpha}
              </dd>
              <dt>Labels</dt>
              <dd>
                <code>{snapshot.plan.labelMode}</code>
              </dd>
              <dt>Readiness</dt>
              <dd>
                {snapshot.plan.calibrationEnabled
                  ? "ON (excluded from scored N)"
                  : "explicitly OFF"}
              </dd>
              <dt>Preparation validity</dt>
              <dd>
                <strong>{snapshot.gates.preparationStatus}</strong>
              </dd>
              <dt>Calibration gate</dt>
              <dd>
                <strong>{snapshot.gates.calibrationStatus}</strong>
              </dd>
              <dt>Null gate</dt>
              <dd>
                <strong>{snapshot.gates.nullStatus}</strong>
              </dd>
              <dt>Output</dt>
              <dd>{deviceLabel(output, output?.selectedDeviceId ?? null)}</dd>
              <dt>Lifecycle</dt>
              <dd>
                <strong>{snapshot.lifecycle}</strong>
              </dd>
            </dl>
          </details>
        )}
    </>
  );

  if (notPrepared) {
    return (
      <section
        className="listen-content listening"
        data-session={state.session}
        aria-labelledby="listening-heading"
      >
        {errorBlocks}
        {fatalAndSetupErrors}
        {runErrors}
        <div className="listen-empty listening-stage-placeholder">
          <h1 id="listening-heading" className="display">
            {emptyTitle}
          </h1>
          <p>{emptyMessage}</p>
          <div className="actions">
            {canRetryPrepare ? (
              <button
                type="button"
                className="primary"
                disabled={!primary.canPrepare || primary.busy}
                onClick={primary.onPrepare}
              >
                Retry prepare test
              </button>
            ) : null}
            <button
              type="button"
              className={canRetryPrepare ? "ghost" : "primary"}
              onClick={props.onGoToSetup}
            >
              Back to Setup
            </button>
          </div>
        </div>
        <div className="listen-foot">{sessionDetails}</div>
      </section>
    );
  }

  const segmentCount =
    plannedTrials !== null && plannedTrials > 0 && plannedTrials <= MAX_SEGMENTS
      ? plannedTrials
      : 0;

  return (
    <section
      className="listen-content listening"
      data-session={state.session}
      aria-labelledby="listening-heading"
    >
      <header className="listen-head">
        <div className="listen-heading">
          <div className="trial-heading-row">
            <h1 id="listening-heading" className="display">
              {heading ?? (
                <>
                  Trial {trial!.trialIndex}{" "}
                  <em>
                    of {snapshot?.plan.plannedTrials ?? "practice"}
                  </em>
                </>
              )}
            </h1>
            <span
              className={`answer-status${feedback ? (feedback.correct ? " answer-correct" : " answer-incorrect") : ""}`}
              role="status"
              aria-live="polite"
            >
              {feedback ? (feedback.correct ? "Correct" : "Incorrect") : ""}
            </span>
          </div>
          <p className="subline">{subline ?? " "}</p>
        </div>
        <div className="listen-progress">
          {primary.busy ? (
            <button
              type="button"
              className="ghost small"
              onClick={() => void primary.onCancel()}
            >
              Cancel preparation
            </button>
          ) : (
            <span className="progress-label">
              {plannedTrials === null
                ? " "
                : `${Math.min(scoredTrials, plannedTrials)} of ${plannedTrials} answered`}
            </span>
          )}
          <div className="trial-progress">
            <progress
              className={segmentCount > 0 ? "sr-only" : "progress-bar"}
              aria-label="Trials completed"
              max={
                plannedTrials === null || plannedTrials <= 0 ? 1 : plannedTrials
              }
              value={
                plannedTrials === null || plannedTrials <= 0
                  ? 0
                  : Math.min(scoredTrials, plannedTrials)
              }
            />
            {segmentCount > 0 ? (
              <span className="segments" aria-hidden="true">
                {Array.from({ length: segmentCount }, (_value, index) => (
                  <i
                    key={index}
                    data-state={
                      index < scoredTrials
                        ? "answered"
                        : currentScored !== null && index === currentScored - 1
                          ? "current"
                          : "pending"
                    }
                  />
                ))}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {errorBlocks}

      <section
        className="listening-stage"
        data-state={stageState}
        aria-labelledby={ids + "-stage"}
      >
        <h2 className="sr-only" id={ids + "-stage"}>
          Listening controls
        </h2>
        <article
          className={
            trial !== null && !terminal
              ? "listening-trial"
              : "listening-stage-body"
          }
          {...(trial !== null && !terminal
            ? {
                "data-token": trial.token,
                "data-kind": trial.kind,
              }
            : {})}
        >
          <div className="stage-status" role="status" aria-live="polite">
            <strong>{stageTitle}</strong>
            {stageState === "loading" && (
              <progress
                className="stage-progress"
                aria-label="Test preparation progress"
                max={1}
                value={undefined}
              />
            )}
          </div>

          {terminal && snapshot !== null ? (
            <div
              className="run-results card"
              data-lifecycle={snapshot.lifecycle}
              role="status"
            >
              <p className="run-score">
                <strong>
                  {snapshot.statistics.scoredTrials === 0
                    ? "No scored trials."
                    : `${snapshot.statistics.correctTrials} / ${snapshot.statistics.scoredTrials} correct`}
                </strong>
              </p>
              {completedAnswers && <TrialTally rows={completedAnswers} />}
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={props.onViewResults}
                >
                  View results
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="card listening-transport">
                <button
                  type="button"
                  className="transport-toggle"
                  aria-label={playing ? "Pause" : "Play"}
                  disabled={playing ? !pauseEnabled : !playEnabled}
                  onClick={() => {
                    if (playing) controller.pause();
                    else void controller.play();
                  }}
                >
                  <PlayIcon playing={playing} />
                </button>
                <div className="scrub">
                  <label className="sr-only" htmlFor={`${ids}-position`}>
                    Shared timeline position
                  </label>
                  <input
                    id={`${ids}-position`}
                    className="timeline"
                    type="range"
                    min={0}
                    max={Math.max(0.001, playback?.durationSeconds ?? 0)}
                    step={0.001}
                    value={Math.min(
                      playback?.positionSeconds ?? 0,
                      playback?.durationSeconds ?? 0,
                    )}
                    style={{
                      ["--fill" as string]: `${
                        playback && playback.durationSeconds > 0
                          ? Math.min(
                              100,
                              (playback.positionSeconds /
                                playback.durationSeconds) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                    disabled={!controlsEnabled}
                    onChange={(event) =>
                      controller.seek(Number(event.target.value))
                    }
                  />
                  <span
                    className="time-readout"
                    data-duration-seconds={(
                      playback?.durationSeconds ?? 0
                    ).toFixed(3)}
                  >
                    <span>{formatClock(playback?.positionSeconds ?? 0)}</span>
                    <span aria-hidden="true"> / </span>
                    <span>{formatClock(playback?.durationSeconds ?? 0)}</span>
                    <span className="sr-only">
                      {" "}
                      ({(playback?.durationSeconds ?? 0).toFixed(3)} s)
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="chip loop-toggle"
                  aria-pressed={playback?.loop.enabled === true}
                  aria-label={
                    playback?.loop.enabled === true
                      ? "Disable loop"
                      : "Enable loop"
                  }
                  disabled={!controlsEnabled}
                  onClick={toggleLoop}
                >
                  <span aria-hidden="true">↻ </span>
                  {playback?.loop.enabled === true ? "Loop on" : "Loop off"}
                </button>
                {playback?.loop.enabled === true && (
                  <div className="loop-edit">
                    <label>
                      From
                      <input
                        aria-label="Loop start (s)"
                        type="number"
                        min={0}
                        step={0.01}
                        value={loopStart}
                        disabled={!controlsEnabled}
                        onChange={(event) => setLoopStart(event.target.value)}
                      />
                    </label>
                    <label>
                      to
                      <input
                        aria-label="Loop end (s)"
                        type="number"
                        min={0}
                        step={0.01}
                        value={loopEnd}
                        disabled={!controlsEnabled}
                        onChange={(event) => setLoopEnd(event.target.value)}
                      />
                    </label>
                    <span className="field-note">seconds</span>
                    <button
                      type="button"
                      className="ghost small"
                      disabled={!controlsEnabled}
                      onClick={() => applyLoop(true)}
                    >
                      Apply loop range
                    </button>
                  </div>
                )}
                {loopError ? (
                  <p className="status-error loop-error" role="alert">
                    {loopError}
                  </p>
                ) : null}
              </div>

              <div
                className="label-select tiles"
                role="group"
                aria-label="Playback label selection"
              >
                {(["A", "B", "X"] as const).map((label: PlaybackLabel) => {
                  const on = selected === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      className="tile"
                      data-selected={on ? "true" : undefined}
                      aria-pressed={on}
                      aria-label={`Monitor playback label ${label}`}
                      disabled={!controlsEnabled}
                      onClick={() => controller.select(label)}
                    >
                      {on ? (
                        <span className="tile-now" aria-hidden="true">
                          {playing ? (
                            <>
                              <Equalizer /> Playing
                            </>
                          ) : (
                            "Selected"
                          )}
                        </span>
                      ) : null}
                      {shortcutsOn ? <kbd aria-hidden="true">{label}</kbd> : null}
                      <span className="tile-letter" aria-hidden="true">
                        {label}
                      </span>
                      <small aria-hidden="true">{TILE_CAPTIONS[label]}</small>
                    </button>
                  );
                })}
              </div>

              <section
                className="listening-answer"
                aria-labelledby={`${ids}-answer`}
              >
                <div className="answer-title">
                  <h2 id={`${ids}-answer`}>Is X A or B?</h2>
                  {trial?.kind === "calibration" && (
                    <span className="tag">Calibration</span>
                  )}
                </div>
                <div className="answer-buttons">
                  <button
                    type="button"
                    className="answer"
                    aria-label="Answer A"
                    disabled={!answerEnabled || state.answered}
                    onClick={() => void controller.answer("A")}
                  >
                    X is A {shortcutsOn ? <kbd aria-hidden="true">1</kbd> : null}
                  </button>
                  <button
                    type="button"
                    className="answer"
                    aria-label="Answer B"
                    disabled={!answerEnabled || state.answered}
                    onClick={() => void controller.answer("B")}
                  >
                    X is B {shortcutsOn ? <kbd aria-hidden="true">2</kbd> : null}
                  </button>
                </div>
                {state.error !== null && state.error.retry === "answer" && (
                  <div className="status-error" role="alert">
                    <strong>Answer submission needs reconciliation.</strong>{" "}
                    {state.error.message}
                    {state.error.reasons.length > 0 && (
                      <ul>
                        {state.error.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                    <div className="actions">
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy || state.pendingAnswer === null}
                        onClick={() => void controller.retryAnswer()}
                      >
                        Retry identical answer {state.pendingAnswer ?? ""}
                      </button>
                    </div>
                  </div>
                )}
                {canNext && (
                  <div className="actions">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void controller.next()}
                    >
                      Next trial
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </article>
      </section>

      {fatalAndSetupErrors}

      {runErrors}

      <div className="listen-foot">
        {!terminal ? (
          <div className="key-hints">
            {shortcutsOn ? (
              <p className="key-hint-list" aria-label="Keyboard shortcuts">
                <span>
                  <kbd>Space</kbd> play / pause
                </span>
                <span>
                  <kbd>A</kbd>
                  <kbd>B</kbd>
                  <kbd>X</kbd> switch
                </span>
                <span>
                  <kbd>1</kbd>
                  <kbd>2</kbd> answer
                </span>
              </p>
            ) : null}
            <label className="shortcut-toggle">
              <input
                type="checkbox"
                checked={shortcutsOn}
                onChange={(event) => setShortcutsOn(event.currentTarget.checked)}
              />
              Keyboard shortcuts
            </label>
          </div>
        ) : null}
        {sessionDetails}
      </div>
    </section>
  );
}
