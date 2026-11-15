import { useEffect, useState } from "react";

import type { AnswerReceipt } from "@codec-abx/contracts";

export interface RunTally {
  readonly runId: string;
  readonly rows: readonly AnswerReceipt[];
}

/**
 * Per-trial results of the current run, collected from the answer receipts the
 * controller already publishes one at a time through `state.feedback`. A new
 * run (reset or reopen) restarts the list, and a token is recorded at most
 * once even after a reconciled retry. Views decide when the rows may be shown.
 */
export function useRunTally(feedback: AnswerReceipt | null): RunTally | null {
  const [tally, setTally] = useState<RunTally | null>(null);
  useEffect(() => {
    if (feedback === null) return;
    setTally((current) => {
      const rows =
        current !== null && current.runId === feedback.runId ? current.rows : [];
      return {
        runId: feedback.runId,
        rows: rows.some((row) => row.token === feedback.token)
          ? rows
          : [...rows, feedback],
      };
    });
  }, [feedback]);
  return tally;
}
