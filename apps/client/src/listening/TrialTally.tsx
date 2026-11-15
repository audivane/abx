import type { JSX } from "react";

import type { AnswerReceipt } from "@codec-abx/contracts";

/**
 * Per-trial ✓/✗ chips. Shown only once a run is terminal, exactly where the
 * previous interface showed its tally; a running test never lists them.
 */
export function TrialTally(props: {
  readonly rows: readonly AnswerReceipt[];
}): JSX.Element {
  return (
    <ol className="trial-tally" aria-label="Answered trials">
      {props.rows.map((row) => (
        <li
          key={row.token}
          className={
            row.kind === "calibration"
              ? "tally-neutral"
              : row.correct
                ? "tally-hit"
                : "tally-miss"
          }
        >
          <span aria-hidden="true">
            {row.kind === "calibration" ? "C" : row.trialIndex}
          </span>
          <b aria-hidden="true">{row.correct ? "✓" : "✗"}</b>
          <span className="sr-only">
            {`${row.kind === "calibration" ? "Readiness check" : `Trial ${row.trialIndex}`}: answered ${row.answer}, ${row.correct ? "correct" : "incorrect"}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
