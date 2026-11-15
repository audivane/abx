import type { JSX } from "react";

export interface SessionStripProps {
  readonly sourceName: string | null;
  readonly sourceLength: string | null;
  readonly chainA: string;
  readonly chainB: string;
  readonly plan: string;
  readonly output: string;
  /** "running": locked with End test; "preparing": locked, no End test yet. */
  readonly phase: "preparing" | "running" | "terminal";
  readonly lifecycleLabel: string | null;
  readonly canEnd: boolean;
  readonly onEnd: () => void;
  /** Terminal runs outside Results offer the way to the result. */
  readonly onViewResults: (() => void) | null;
}

/**
 * The test's fixed setup, shown during and after a run in place of the old
 * sidebar. Locked text and End test appear only while the test runs.
 */
export function SessionStrip(props: SessionStripProps): JSX.Element {
  return (
    <section className="session-strip" aria-label="Current test">
      <div className="session-inner">
        <span className="session-item session-file">
          <b>{props.sourceName ?? "No source"}</b>
          {props.sourceLength ? <> · {props.sourceLength}</> : null}
        </span>
        <span className="session-item session-chains">
          <span className="chain-pill">
            <span className="chain-letter" aria-hidden="true">A</span>
            <span className="sr-only">Side A: </span>
            {props.chainA}
          </span>
          <span className="vs" aria-hidden="true">vs</span>
          <span className="chain-pill">
            <span className="chain-letter" aria-hidden="true">B</span>
            <span className="sr-only">Side B: </span>
            {props.chainB}
          </span>
        </span>
        <span className="session-item session-plan">{props.plan}</span>
        <span className="session-item session-output">{props.output}</span>
        <span className="session-end">
          {props.phase === "terminal" ? (
            <>
              {props.lifecycleLabel ? (
                <span className="lifecycle-chip">{props.lifecycleLabel}</span>
              ) : null}
              {props.onViewResults ? (
                <button type="button" className="ghost small" onClick={props.onViewResults}>
                  View results
                </button>
              ) : null}
            </>
          ) : (
            <>
              <span className="lock-note">
                {props.phase === "preparing" ? "Preparing · setup locked" : "Locked during the test"}
              </span>
              {props.canEnd ? (
                <button
                  type="button"
                  className="ghost small end-test"
                  onClick={props.onEnd}
                >
                  End test
                </button>
              ) : null}
            </>
          )}
        </span>
      </div>
    </section>
  );
}
