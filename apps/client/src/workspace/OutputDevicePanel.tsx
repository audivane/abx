import { useId, type JSX } from "react";

import type {
  OutputDeviceEntry,
  PlaybackOutputState,
} from "@codec-abx/contracts";

export function deviceLabel(
  output: PlaybackOutputState | undefined,
  deviceId: string | null,
): string {
  if (deviceId === null || deviceId === "") return "System default output";
  return output?.devices.find((device) => device.deviceId === deviceId)?.label ??
    "Selected device (label unavailable)";
}

function supportText(output: PlaybackOutputState | undefined): string {
  const support = output?.support ?? "unavailable";
  if (support === "supported") {
    return "supported: this browser exposes Web Audio output routing";
  }
  if (support === "unsupported") {
    return "unsupported: this browser cannot choose an output sink; the default output remains usable";
  }
  return "unavailable: no selectable output is currently exposed; the default output remains usable";
}

/**
 * Output card in Setup. The select keeps its position when the route locks
 * and is disabled in place with a lock note. Support, device ids and method
 * notes live in the routing disclosure, not in routine copy.
 */
export function OutputDevicePanel(props: {
  readonly output: PlaybackOutputState | undefined;
  readonly locked: boolean;
  readonly busy: boolean;
  readonly onRefresh: () => void;
  readonly onSelect: (deviceId: string) => void;
  readonly onRequest: () => void;
}): JSX.Element {
  const { output, locked, busy } = props;
  const ids = useId();
  const pending = output?.pending ?? null;
  const devices: readonly OutputDeviceEntry[] = output?.devices ?? [];
  const selected = output?.selectedDeviceId ?? null;
  const hasDefault = devices.some((device) => device.deviceId === "");
  const options = [
    ...(hasDefault ? [] : [{ deviceId: "", label: "System default output" }]),
    ...devices,
    ...(selected !== null && selected !== "" &&
      !devices.some((device) => device.deviceId === selected)
      ? [{ deviceId: selected, label: "Selected device (label unavailable)" }]
      : []),
  ];
  const chooserIsNeeded = output?.canRequest === true && options.length <= 1;
  return (
    <section className="card listening-output" aria-labelledby={`${ids}-output`}>
      <div className="card-head">
        <h2 id={`${ids}-output`}>Output device</h2>
      </div>
      <label className="sr-only" htmlFor={`${ids}-device`}>Select a listed output</label>
      <select
        id={`${ids}-device`}
        className="device"
        value={selected ?? ""}
        disabled={locked || busy || pending !== null}
        onChange={(event) => props.onSelect(event.target.value)}
      >
        {options.map((device, index) => (
          <option key={`${device.deviceId}-${index}`} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      {locked ? <p className="lock-note">Locked for this test.</p> : null}
      {output?.error ? <p className="status-error" role="alert">{output.error}</p> : null}
      <div className="actions output-actions">
        <button
          type="button"
          className="ghost small"
          disabled={busy || pending !== null}
          onClick={props.onRefresh}
        >
          Refresh output devices
        </button>
        {output?.canRequest === true ? (
          <button
            type="button"
            className={chooserIsNeeded ? "primary small" : "ghost small"}
            disabled={busy || locked || pending !== null}
            onClick={props.onRequest}
          >
            Choose output device…
          </button>
        ) : null}
      </div>
      <details className="listening-output-details">
        <summary>Routing details</summary>
        <p className="field-note">{supportText(output)}</p>
        <dl className="facts">
          <dt>Chooser</dt>
          <dd>
            {output?.canRequest === true
              ? "available (explicit browser chooser)"
              : "not exposed by this browser"}
          </dd>
          <dt>Requested</dt>
          <dd>{deviceLabel(output, output?.requestedDeviceId ?? null)}</dd>
          <dt>Applied</dt>
          <dd>{deviceLabel(output, selected)}</dd>
          <dt>Observed route</dt>
          <dd>{deviceLabel(output, output?.observedDeviceId ?? null)}</dd>
          <dt>Route change</dt>
          <dd><strong>{output?.change ?? "none"}</strong></dd>
          {pending !== null ? (
            <>
              <dt>Pending</dt>
              <dd>{pending} operation in progress</dd>
            </>
          ) : null}
        </dl>
      </details>
    </section>
  );
}
