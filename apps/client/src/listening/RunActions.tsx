import type { JSX } from "react";

export interface RunActionsProps {
  /** A listening run exists (running, configured or terminal). */
  readonly hasRun: boolean;
  readonly closing: boolean;
  readonly exportDisabled: boolean;
  readonly onDownload: () => void;
  /** Restart the same run: same prepared pair and plan (existing reset). */
  readonly onReset: () => void;
  /** Close the run and return to an unlocked Setup (existing close). */
  readonly onClose: () => void;
  /** Opens the share dialog for this setup; absent when it cannot be shared. */
  readonly onShare?: () => void;
  /** Present only when clearing is possible (no run holds the audio). */
  readonly clear: { readonly disabled: boolean; readonly onClear: () => void } | null;
}

/** Results actions: Download results first, then run management. */
export function RunActions(props: RunActionsProps): JSX.Element {
  return (
    <div className="results-actions listening-actions">
      <button
        type="button"
        className="primary"
        disabled={props.exportDisabled}
        onClick={props.onDownload}
      >
        Download results
      </button>
      {props.onShare ? (
        <button type="button" className="ghost" onClick={props.onShare}>
          Share this test
        </button>
      ) : null}
      {props.hasRun ? (
        <>
          <button
            type="button"
            className="ghost"
            disabled={props.closing}
            onClick={props.onReset}
          >
            Run again with the same setup
          </button>
          <button
            type="button"
            className="quiet"
            disabled={props.closing}
            onClick={props.onClose}
          >
            New test
          </button>
        </>
      ) : null}
      {props.clear ? (
        <>
          <span className="spacer" aria-hidden="true" />
          <button
            type="button"
            className="quiet"
            disabled={props.clear.disabled}
            onClick={props.clear.onClear}
          >
            Clear prepared audio
          </button>
        </>
      ) : null}
    </div>
  );
}
