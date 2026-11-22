import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type JSX,
  type RefObject,
} from "react";

import { formatChannels, formatLength, formatRate } from "../format";

export const SOURCE_ACCEPT =
  ".wav,.flac,.mp3,.m4a,.mp4,.aac,.ogg,.oga,.opus,audio/wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/opus";

const FORMAT_BY_EXTENSION: Readonly<Record<string, string>> = {
  wav: "WAV",
  flac: "FLAC",
  mp3: "MP3",
  m4a: "M4A",
  mp4: "MP4",
  aac: "AAC",
  ogg: "Ogg",
  oga: "Ogg",
  opus: "Opus",
};

export function formatFromName(name: string): string | null {
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  return name.includes(".") ? (FORMAT_BY_EXTENSION[extension] ?? null) : null;
}

export function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export interface PreparedSourceFacts {
  readonly sampleRate: number;
  readonly channels: 1 | 2;
  readonly seconds: number;
}

function NoteIcon(): JSX.Element {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function SourceCard(props: {
  readonly name: string | null;
  readonly sizeBytes: number | null;
  readonly prepared: PreparedSourceFacts | null;
  /** Source changes are blocked by an operation or the active test. */
  readonly disabled: boolean;
  /** The active listening test holds the source. */
  readonly locked: boolean;
  readonly limitLine: string;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onDropFile: (file: File) => void;
}): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const hasSource = props.name !== null;
  const format = props.name === null ? null : formatFromName(props.name);
  const facts = [
    format,
    props.prepared ? formatRate(props.prepared.sampleRate) : null,
    props.prepared ? formatChannels(props.prepared.channels) : null,
    props.prepared ? formatLength(props.prepared.seconds) : null,
    props.sizeBytes === null ? null : formatSize(props.sizeBytes),
  ].filter((value): value is string => value !== null);
  const acceptDrop = !props.disabled;
  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (!acceptDrop || !event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    setDragging(false);
    if (!acceptDrop) return;
    const file = event.dataTransfer.files[0];
    if (!file) return;
    event.preventDefault();
    props.onDropFile(file);
  };

  const picker = (
    <input
      id="source-file"
      ref={props.fileInputRef}
      className="file-input sr-only"
      aria-label="Audio file"
      type="file"
      accept={SOURCE_ACCEPT}
      aria-describedby="source-limit-line"
      disabled={props.disabled}
      onChange={props.onSelectFile}
    />
  );

  return (
    <section
      className="card source-card"
      aria-labelledby="source-heading"
      data-dragging={dragging ? "true" : undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* One stable input element: swapping it between the drop zone and the
          file row would drop the selected File from the DOM. */}
      {picker}
      <div className="card-head">
        <h2 id="source-heading">Source</h2>
        <span className="card-meta" id="source-limit-line">
          {props.limitLine}
        </span>
      </div>
      {hasSource ? (
        <div className="source-file">
          <span className="file-icon">
            <NoteIcon />
          </span>
          <div className="file-meta">
            <b className="file-summary" aria-live="polite">
              {props.name}
            </b>
            <span>{facts.join(" · ")}</span>
          </div>
          {props.locked ? (
            <span className="lock-note">Locked during the test</span>
          ) : (
            <label
              htmlFor="source-file"
              className="button ghost"
              data-disabled={props.disabled ? "true" : undefined}
            >
              Replace…
            </label>
          )}
        </div>
      ) : (
        <>
          <label
            htmlFor="source-file"
            className="drop-zone"
            data-disabled={props.disabled ? "true" : undefined}
          >
            <span className="file-icon">
              <NoteIcon />
            </span>
            <b>Drop an audio file here</b>
            <span>
              or <u>choose a file</u> from this device. It is never uploaded.
            </span>
          </label>
        </>
      )}
      <details className="source-limits">
        <summary>Formats and limits</summary>
        <p>WAV, FLAC, MP3, AAC, M4A, Ogg and Opus.</p>
      </details>
    </section>
  );
}
