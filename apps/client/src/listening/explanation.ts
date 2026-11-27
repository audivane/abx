import type { ExperimentSnapshot } from "@codec-abx/contracts";

/**
 * The verdict headline. Wording and order are the run record's existing
 * logic; the redesign only moved where it is shown.
 */
export function resultHeading({
  statistics,
  gates,
  plan,
  lifecycle,
}: ExperimentSnapshot): string {
  if (
    gates.preparationStatus === "failed" ||
    gates.nullStatus === "failed" ||
    (plan.calibrationEnabled && gates.calibrationStatus === "failed")
  )
    return "Test checks failed";
  if (statistics.isFinal) {
    return statistics.significantVerdict
      ? "Significant difference detected"
      : "No significant difference detected";
  }
  if (lifecycle === "void") return "Test invalid";
  if (lifecycle === "sealed") return "Test ended early";
  return "Test in progress";
}

/** "about 36%", "about 3.5%", "about 0.39%", "less than 0.01%". */
export function describeChance(pValue: number): string {
  const percent = pValue * 100;
  if (percent >= 99.5) return "every time or nearly so";
  if (percent >= 10) return `about ${Math.round(percent)}% of the time`;
  if (percent >= 1) return `about ${percent.toFixed(1)}% of the time`;
  if (percent >= 0.01) return `about ${Number(percent.toPrecision(2))}% of the time`;
  return "less than 0.01% of the time";
}

function trialsWord(count: number): string {
  return count === 1 ? "trial" : "trials";
}

/** Kicker above the verdict: lifecycle plus the trial count. */
export function resultKicker(snapshot: ExperimentSnapshot): string {
  const { scoredTrials } = snapshot.statistics;
  const planned = snapshot.plan.plannedTrials;
  const count =
    planned === null
      ? `${scoredTrials} ${trialsWord(scoredTrials)}`
      : `${scoredTrials} of ${planned} ${trialsWord(planned)}`;
  switch (snapshot.lifecycle) {
    case "completed":
      return `Test complete, ${count}`;
    case "sealed":
      return `Ended early, ${count}`;
    case "void":
      return `Run void, ${count}`;
    default:
      return `Test in progress, ${count} answered`;
  }
}

/**
 * Plain-language reading of the run, built only from the computed exact
 * one-sided binomial p-value (P[X ≥ k] under guessing) and the planned α.
 * Scientific policy (docs/methodology.md): a non-significant result does not
 * show the sides are identical, a significant one is not a certification, and
 * an ended-early, void or failed-check run is never a final result.
 */
export function resultExplanation(snapshot: ExperimentSnapshot): string {
  const { statistics, plan, gates, lifecycle } = snapshot;
  const k = statistics.correctTrials;
  const n = statistics.scoredTrials;
  const alpha = plan.alpha;
  const got = `You got ${k} of ${n} right.`;
  const chance =
    k === 0
      ? "Guessing alone always scores at least that well"
      : `Guessing alone scores ${k} or more ${describeChance(statistics.pValue)}`;

  if (
    gates.preparationStatus === "failed" ||
    gates.nullStatus === "failed" ||
    (plan.calibrationEnabled && gates.calibrationStatus === "failed")
  ) {
    return "A required check did not pass, so this run has no valid result. The score is kept in the record for audit only; see Test details for the check that failed.";
  }
  if (lifecycle === "void") {
    return "This run is void and has no scored result. Its record is kept for audit; prepare a new run to test again.";
  }
  if (lifecycle === "sealed") {
    const planned = plan.plannedTrials;
    return n === 0
      ? "The test was ended before any scored trial was answered. An ended run is never a final result."
      : `${got} The test was ended after ${n} of ${planned ?? n} planned ${trialsWord(planned ?? n)}, so this is not a final result and no verdict is drawn from it.`;
  }
  if (!statistics.isFinal) {
    return n === 0
      ? "No scored trial has been answered yet. The result is decided only after every planned trial."
      : `${got} The result is decided only after every planned trial; nothing is concluded from a partial run.`;
  }
  if (statistics.significantVerdict) {
    const lenient =
      alpha > 0.05
        ? ` A threshold above the usual 0.05 is easier to meet by guessing alone, so treat this as weak evidence.`
        : "";
    return `${got} ${chance}. That is below your planned threshold of α ${alpha}, so this run meets the test's rule for a significant result.${lenient} It is evidence from one run on this setup, not a certification of either codec or of audibility elsewhere.`;
  }
  // A final non-significant run shows only its heading.
  return "";
}
