import type { JSX, ReactNode } from "react";
import type { AnswerReceipt, ExperimentSnapshot } from "@codec-abx/contracts";

import {
  resultExplanation,
  resultHeading,
  resultKicker,
} from "./explanation.js";
import { TrialTally } from "./TrialTally.js";

/**
 * Outcome class used only for styling, so failed checks, void, ended-early,
 * in-progress and completed runs stay visibly distinct (always with text).
 */
export function runOutcome(
  snapshot: ExperimentSnapshot,
): "failed" | "void" | "sealed" | "running" | "significant" | "not-significant" {
  const { gates, plan, statistics, lifecycle } = snapshot;
  if (
    gates.preparationStatus === "failed" ||
    gates.nullStatus === "failed" ||
    (plan.calibrationEnabled && gates.calibrationStatus === "failed")
  )
    return "failed";
  if (statistics.isFinal)
    return statistics.significantVerdict ? "significant" : "not-significant";
  if (lifecycle === "void") return "void";
  if (lifecycle === "sealed") return "sealed";
  return "running";
}

export function RunRecord(props: {
  readonly snapshot: ExperimentSnapshot;
  /** Terminal runs only; a running test never lists per-trial results. */
  readonly tally: readonly AnswerReceipt[] | null;
  readonly detailsOpen: boolean;
  readonly onDetailsToggle: (open: boolean) => void;
  readonly children?: ReactNode;
}): JSX.Element {
  const { statistics: stats, gates, plan } = props.snapshot;
  const outcome = runOutcome(props.snapshot);
  return (
    <section
      className="run-record"
      data-lifecycle={props.snapshot.lifecycle}
      data-outcome={outcome}
      aria-labelledby="run-record-heading"
    >
      <div className="verdict">
        <div className="verdict-copy">
          <p className="kicker">{resultKicker(props.snapshot)}</p>
          <h2 id="run-record-heading" className="display">
            {resultHeading(props.snapshot)}
          </h2>
          <p className="verdict-text">{resultExplanation(props.snapshot)}</p>
        </div>
        {props.tally && props.tally.length > 0 ? (
          <TrialTally rows={props.tally} />
        ) : null}
      </div>
      <dl className="card evidence-metrics">
        <div>
          <dt>Correct</dt>
          <dd>
            {stats.correctTrials} <span>/ {stats.scoredTrials}</span>
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>
            {stats.scoredTrials
              ? `${Math.round((stats.correctTrials / stats.scoredTrials) * 100)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>p-value (one-sided)</dt>
          <dd>{stats.pValue.toFixed(4)}</dd>
        </div>
        <div>
          <dt>95% confidence interval</dt>
          <dd>
            {(stats.abilityCi95[0] * 100).toFixed(1)}–
            {(stats.abilityCi95[1] * 100).toFixed(1)}%
          </dd>
        </div>
      </dl>
      {gates.preparationDisclosure && (
        <p className="warning" role="alert">
          {gates.preparationDisclosure}
        </p>
      )}
      {gates.reasons.length > 0 && (
        <ul className="gate-reasons">
          {gates.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {props.children}
      <details
        className="card disclosure test-details"
        open={props.detailsOpen}
        onToggle={(event) => props.onDetailsToggle(event.currentTarget.open)}
      >
        <summary>Test details</summary>
        <dl className="facts">
          <dt>Trials</dt>
          <dd>
            {stats.scoredTrials} / {plan.plannedTrials ?? "Practice"}
          </dd>
          <dt>Significance threshold</dt>
          <dd>{plan.alpha}</dd>
          <dt>Required correct</dt>
          <dd>{stats.requiredCorrect ?? "—"}</dd>
          <dt>Labels</dt>
          <dd>{plan.labelMode === "fixed" ? "Fixed" : "Randomized"}</dd>
          <dt>Readiness check</dt>
          <dd>{plan.calibrationEnabled ? gates.calibrationStatus : "Off"}</dd>
          <dt>Audio preparation</dt>
          <dd>{gates.preparationStatus}</dd>
          <dt>Identical-audio check</dt>
          <dd>
            {gates.nullStatus === "not-applicable"
              ? "Not needed"
              : gates.nullStatus}
          </dd>
        </dl>
      </details>
    </section>
  );
}
