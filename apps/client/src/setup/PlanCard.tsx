import {
  useId,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";

export interface PlanFormFields {
  readonly plannedTrials: string;
  readonly alpha: string;
  readonly labelMode: "fixed" | "blind_random";
}

function HelpPopover(props: {
  readonly label: string;
  readonly children: ReactNode;
}): JSX.Element {
  const ref = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="help"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        ref.current?.focus();
      }}
    >
      <button
        type="button"
        className="link-button"
        ref={ref}
        aria-label={props.label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        About
      </button>
      {open ? (
        <span className="help-panel" id={id} role="note">
          {props.children}
        </span>
      ) : null}
    </span>
  );
}

export function PlanCard(props: {
  readonly fields: PlanFormFields;
  readonly disabled: boolean;
  readonly locked: boolean;
  readonly dirty: boolean;
  readonly valid: boolean;
  readonly error: string | null;
  readonly canApply: boolean;
  readonly runConfigured: boolean;
  readonly onApply: () => void;
  readonly onChange: (patch: Partial<PlanFormFields>) => void;
  readonly calibrationEnabled: boolean;
  readonly calibrationDisabled: boolean;
  readonly onCalibrationChange: (enabled: boolean) => void;
}): JSX.Element {
  const labelMode =
    props.fields.labelMode === "blind_random" ? "Randomized" : "Fixed";
  return (
    <section className="card plan-card" aria-labelledby="plan-heading">
      <div className="card-head">
        <h2 id="plan-heading">Test plan</h2>
        {props.locked && <span className="card-meta">Locked</span>}
      </div>
      <dl className="plan-lines">
        <div>
          <dt>Test trials</dt>
          <dd className="num">{props.fields.plannedTrials}</dd>
        </div>
        <div>
          <dt>Labels</dt>
          <dd>{labelMode}</dd>
        </div>
        <div>
          <dt>Significance (α)</dt>
          <dd className="num">{props.fields.alpha}</dd>
        </div>
        <div className="readiness">
          <dt>
            <label htmlFor="canary-enabled">Readiness check</label>{" "}
            <HelpPopover label="About the readiness check">
              Optional calibration using exactly the first min(10 s, prepared
              Side A). It must pass before scored trials, is excluded from N,
              and scored trials keep the full prepared track. Off creates no
              calibration material.
            </HelpPopover>
          </dt>
          <dd>
            <input
              id="canary-enabled"
              className="switch"
              aria-label="Calibration readiness check (first 10 s of prepared Side A)"
              type="checkbox"
              role="switch"
              checked={props.calibrationEnabled}
              disabled={props.calibrationDisabled}
              onChange={(event) =>
                props.onCalibrationChange(event.target.checked)
              }
            />
          </dd>
        </div>
      </dl>
      <details className="listening-test-plan" open>
        <summary>Edit plan</summary>
        <div className="plan-fields">
          <div className="field">
            <label htmlFor="plan-trials">
              Planned test trials N (1–1000)
            </label>
            <input
              id="plan-trials"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={props.fields.plannedTrials}
              disabled={props.disabled}
              onChange={(event) =>
                props.onChange({ plannedTrials: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="plan-alpha">Alpha (strict p &lt; alpha)</label>
            <input
              id="plan-alpha"
              type="number"
              min={0.001}
              max={0.999}
              step={0.001}
              value={props.fields.alpha}
              disabled={props.disabled}
              onChange={(event) => props.onChange({ alpha: event.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="plan-label-mode">Label mode</label>
            <select
              id="plan-label-mode"
              value={props.fields.labelMode}
              disabled={props.disabled}
              onChange={(event) =>
                props.onChange({
                  labelMode: event.target.value as "fixed" | "blind_random",
                })
              }
            >
              <option value="blind_random">
                Randomized (A/B swapped per trial)
              </option>
              <option value="fixed">Fixed display order</option>
            </select>
          </div>
        </div>
      </details>
      {props.error ? (
        <p className="status-error" role="alert">
          {props.error}
        </p>
      ) : null}
      {props.valid ? null : (
        <p className="status-error" role="alert">
          The plan has invalid fields. Review N and alpha before preparing.
        </p>
      )}
      {props.runConfigured ? (
        <button
          type="button"
          className="ghost"
          disabled={!props.canApply}
          onClick={props.onApply}
        >
          Apply plan and re-check gates
        </button>
      ) : null}
      {props.runConfigured && props.dirty ? (
        <p className="field-note">The edits differ from the verified plan.</p>
      ) : null}
    </section>
  );
}
