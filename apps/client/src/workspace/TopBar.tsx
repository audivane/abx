import { useRef, type JSX, type ReactNode } from "react";

import {
  ThemeSwitcher,
  type ThemePreference,
} from "./ThemeSwitcher.js";

export type WorkspaceView = "setup" | "listen" | "evidence";

/**
 * done: the step's work is finished and it can be revisited (✓).
 * current: the visible step.
 * available: reachable but not finished.
 * locked: nothing to show yet; the step cannot be opened.
 */
export type StepState = "done" | "current" | "available" | "locked";

export interface StepDescriptor {
  readonly view: WorkspaceView;
  readonly label: string;
  readonly state: StepState;
  /** Why a locked step cannot be opened yet. */
  readonly lockedReason?: string;
}

function BrandMark(): JSX.Element {
  return (
    <svg viewBox="0 0 256 256" width="26" height="26" aria-hidden="true">
      <path d="M120 40c-9 0-15 7-19 17L36 201c-2 4 0 7 5 7h36l18-40h27v-24h-16l16-40V40z" />
      <path d="M136 40c9 0 15 7 19 17l65 144c2 4 0 7-5 7h-36l-18-40h-27v-24h16l-16-40V40z" />
    </svg>
  );
}

export function Stepper(props: {
  readonly steps: readonly StepDescriptor[];
  readonly onSelect: (view: WorkspaceView) => void;
}): JSX.Element {
  return (
    <nav className="stepper" aria-label="Workspace steps">
      <ol>
        {props.steps.map((step, index) => (
          <li key={step.view} className="step-item">
            {index > 0 ? <span className="step-sep" aria-hidden="true" /> : null}
            <button
              type="button"
              className="step"
              data-tab={step.view}
              data-state={step.state}
              aria-current={step.state === "current" ? "step" : undefined}
              aria-disabled={step.state === "locked" ? "true" : undefined}
              aria-describedby={
                step.state === "locked" ? `step-${step.view}-locked` : undefined
              }
              title={step.state === "locked" ? step.lockedReason : undefined}
              onClick={() => {
                if (step.state !== "locked") props.onSelect(step.view);
              }}
            >
              <span className="step-n" aria-hidden="true">
                {step.state === "done" ? "✓" : index + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </button>
            {step.state === "locked" ? (
              <span className="sr-only" id={`step-${step.view}-locked`}>
                {step.lockedReason ?? "Not available yet"}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function TopBar(props: {
  readonly brandHref: string | null;
  readonly steps: readonly StepDescriptor[];
  readonly onSelectStep: (view: WorkspaceView) => void;
  readonly themePreference: ThemePreference;
  readonly onThemeChange: (next: ThemePreference) => void;
  readonly about: ReactNode;
}): JSX.Element {
  const aboutRef = useRef<HTMLDialogElement | null>(null);
  const aboutButtonRef = useRef<HTMLButtonElement | null>(null);
  const brandContent = (
    <>
      <span className="brand-mark">
        <BrandMark />
      </span>
      <span className="brand-name">Audivane</span>
      <span className="brand-product">ABX</span>
    </>
  );
  return (
    <header className="topbar">
      {props.brandHref !== null ? (
        <a
          className="brand"
          href={props.brandHref}
          aria-label="Audivane home"
          title="Back to the Audivane website"
        >
          {brandContent}
        </a>
      ) : (
        <div className="brand">{brandContent}</div>
      )}
      <Stepper steps={props.steps} onSelect={props.onSelectStep} />
      <div className="topbar-tools">
        <span className="local-badge">
          <span className="local-dot" aria-hidden="true" />
          Local · nothing uploaded
        </span>
        <ThemeSwitcher
          preference={props.themePreference}
          onChange={props.onThemeChange}
        />
        <button
          type="button"
          ref={aboutButtonRef}
          className="icon-button"
          aria-label="About and diagnostics"
          title="About and diagnostics"
          aria-haspopup="dialog"
          onClick={() => aboutRef.current?.showModal()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle
              cx="8"
              cy="8"
              r="6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 7v4.5M8 4.6v.1"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <dialog
        className="about-dialog"
        ref={aboutRef}
        aria-labelledby="about-heading"
        onClose={() => aboutButtonRef.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop (the dialog box itself, outside its
          // content wrapper) closes the dialog.
          if (event.target === event.currentTarget) aboutRef.current?.close();
        }}
      >
        <div className="about-body">
          <div className="about-head">
            <h2 id="about-heading">About and diagnostics</h2>
            <button
              type="button"
              className="ghost small"
              onClick={() => aboutRef.current?.close()}
            >
              Close
            </button>
          </div>
          {props.about}
        </div>
      </dialog>
    </header>
  );
}
