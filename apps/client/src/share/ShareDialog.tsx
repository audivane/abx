import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { sharedTestUrl, type SharedTest } from "@codec-abx/contracts";

import { triggerDownload } from "../download";
import { drawQr, qrModel, qrSvg } from "./qr";
import { sharedTestSummary } from "./summary";

const PNG_PIXELS_PER_MODULE = 12;

export interface ShareRequest {
  /** The setup to share, without a source hint. */
  readonly setup: SharedTest;
  /** Copy the link as soon as the dialog opens ("Copy test link"). */
  readonly copyOnOpen: boolean;
}

async function copyText(text: string, fallback: HTMLInputElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallback === null) return false;
    fallback.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    }
  }
}

export function ShareDialog(props: {
  readonly request: ShareRequest | null;
  readonly source: File | null;
  readonly sourceSeconds: number | null;
  readonly onClose: () => void;
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [includeSource, setIncludeSource] = useState(false);
  const [copied, setCopied] = useState<"copied" | "failed" | null>(null);
  const request = props.request;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (request !== null && !dialog.open) dialog.showModal();
    if (request === null && dialog.open) dialog.close();
  }, [request]);

  const hintReady = includeSource && props.source !== null;
  const link = useMemo(() => {
    if (request === null) return null;
    const setup: SharedTest = hintReady
      ? {
          ...request.setup,
          source: {
            title: props.source!.name || "Audio file",
            ...(props.sourceSeconds !== null && props.sourceSeconds > 0
              ? { durationSeconds: props.sourceSeconds }
              : {}),
          },
        }
      : request.setup;
    return sharedTestUrl(window.location.origin, import.meta.env.BASE_URL, setup);
  }, [request, hintReady, props.source, props.sourceSeconds]);

  const qr = useMemo(() => (link === null ? null : qrModel(link)), [link]);
  const svg = useMemo(() => (qr === null ? null : qrSvg(qr, "Audivane ABX test link")), [qr]);

  useEffect(() => setCopied(null), [link]);

  // "Copy test link" copies straight away; the dialog then offers the QR code.
  const copyOnOpen = request?.copyOnOpen ?? false;
  const initialLink = useRef<string | null>(null);
  useEffect(() => {
    if (request === null) {
      initialLink.current = null;
      return;
    }
    if (!copyOnOpen || link === null || initialLink.current !== null) return;
    initialLink.current = link;
    void copyText(link, inputRef.current).then((ok) => setCopied(ok ? "copied" : "failed"));
  }, [request, copyOnOpen, link]);

  const copy = (): void => {
    if (link === null) return;
    void copyText(link, inputRef.current).then((ok) => setCopied(ok ? "copied" : "failed"));
  };

  const savePng = (): void => {
    if (qr === null) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = qr.size * PNG_PIXELS_PER_MODULE;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    drawQr(ctx, qr, PNG_PIXELS_PER_MODULE);
    canvas.toBlob((blob) => {
      if (blob !== null) triggerDownload(blob, "audivane-abx-test-qr.png");
    }, "image/png");
  };

  const saveSvg = (): void => {
    if (svg === null) return;
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), "audivane-abx-test-qr.svg");
  };

  return (
    <dialog
      className="about-dialog share-dialog"
      ref={dialogRef}
      aria-labelledby="share-heading"
      onClose={props.onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      {request !== null && link !== null && svg !== null ? (
        <div className="about-body">
          <div className="about-head">
            <h2 id="share-heading">Share this test</h2>
            <button
              type="button"
              className="ghost small"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </div>
          <p className="share-summary">{sharedTestSummary(request.setup)}</p>
          <p className="field-note">
            The link holds the codec settings and test plan.
          </p>
          <div className="share-link">
            <input
              ref={inputRef}
              type="text"
              readOnly
              aria-label="Test link"
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button type="button" className="primary" onClick={copy}>
              Copy link
            </button>
          </div>
          <p className="share-status" role="status" aria-live="polite">
            {copied === "copied"
              ? "Link copied."
              : copied === "failed"
                ? "Could not copy. Select the link and copy it yourself."
                : ""}
          </p>
          {props.source !== null ? (
            <label className="share-option">
              <input
                type="checkbox"
                checked={includeSource}
                onChange={(event) => setIncludeSource(event.target.checked)}
              />
              <span>
                Include file name
                <small>
                  Adds the file name and length; the file itself isn't shared.
                </small>
              </span>
            </label>
          ) : null}
          <div className="share-qr">
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
              alt="QR code for the test link"
              width={240}
              height={240}
            />
            <div className="actions">
              <button type="button" className="ghost small" onClick={savePng}>
                Save PNG
              </button>
              <button type="button" className="ghost small" onClick={saveSvg}>
                Save SVG
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
