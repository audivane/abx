import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from "react";
import {
  CODEC_CATALOG,
  encodeSharedTest,
  parseSharedTestFragment,
  type CanarySide,
  type CodecSelection,
  type EngineCapabilities,
  type ExperimentPlan,
  type ExperimentSnapshot,
  type PreparedArtifact,
  type PreparationProgress,
  type PreparationRequest,
  type SampleRateMode,
  type SharedTest,
  type Side,
} from "@codec-abx/contracts";

import { chainLabel, codecLabel } from "./codecs";
import { buildDiagnosticExport } from "./diagnostics";
import { triggerDownload } from "./download";
import { formatLength } from "./format";
import { RunActions } from "./listening/RunActions";
import type { EvidenceDetailsState } from "./evidence/details";
import { AudioComparison } from "./evidence/AudioComparison";
import { RunRecord } from "./listening/RunRecord";
import { ListeningSection } from "./listening/ListeningSection";
import type { ListeningReaders } from "./listening/controller";
import {
  LISTENING_DEFAULTS,
  isRawCodecProbeArtifact,
  listeningArtifactEligibility,
  validateListeningPlan,
  type ListeningPlanFields,
} from "./listening/model";
import { useListening } from "./listening/useListening";
import { useRunTally } from "./listening/useRunTally";
import {
  PrepareTestWorkflow,
  type DiagnosticPreparationPolicy,
  type PrepareTestInputs,
  type PrepareTestRequestMode,
} from "./preparation/workflow";
import {
  createClientRuntime,
  sourceName as clientSourceName,
  sourceSize as clientSourceSize,
  type ClientRuntime,
  type ClientRuntimeKind,
  type ClientSource,
} from "./runtime";
import { PlanCard, type PlanFormFields } from "./setup/PlanCard";
import { SourceCard } from "./setup/SourceCard";
import {
  StageEditor,
  availability,
  isAvailable,
  stageSelection,
} from "./setup/StageEditor";
import { ShareDialog, type ShareRequest } from "./share/ShareDialog";
import {
  sameSharedSetup,
  sharedTestSummary,
} from "./share/summary";
import { sourceOfferLink, WEBSITE_BASE } from "./source-offer";
import { deviceLabel, OutputDevicePanel } from "./workspace/OutputDevicePanel";
import { SessionStrip } from "./workspace/SessionStrip";
import { useThemePreference } from "./workspace/ThemeSwitcher";
import {
  TopBar,
  type StepDescriptor,
  type StepState,
  type WorkspaceView,
} from "./workspace/TopBar";

type CapabilitiesState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly capabilities: EngineCapabilities }
  | { readonly status: "error"; readonly error: string };

type BrowserPreparationMode = DiagnosticPreparationPolicy;

const PREPARATION_MODE_LABELS: Readonly<
  Record<BrowserPreparationMode, string>
> = {
  "codec-probe-only": "Raw codec-stage measurement (manual diagnostic)",
  "aligned-gain-matched-v1": "Aligned and gain-matched preparation (default)",
};

interface SampleUrls {
  readonly a: string | null;
  readonly b: string | null;
  readonly pristine: string | null;
  readonly degraded: string | null;
}

const EMPTY_SAMPLES: SampleUrls = {
  a: null,
  b: null,
  pristine: null,
  degraded: null,
};

function sampleUrlList(urls: SampleUrls): readonly string[] {
  return [urls.a, urls.b, urls.pristine, urls.degraded].filter(
    (url): url is string => url !== null,
  );
}

function errorMessage(error: unknown): string {
  if (error !== null && typeof error === "object" &&
    typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return String(error);
}

const MAX_STAGES_PER_SIDE = 4;

const DEFAULT_STAGES_A: readonly CodecSelection[] = Object.freeze([
  Object.freeze({ codecId: "noop_passthrough" as const, bitrateKbps: 0 }),
]);
const DEFAULT_STAGES_B: readonly CodecSelection[] = Object.freeze([
  Object.freeze({ codecId: "aac" as const, bitrateKbps: 128 }),
]);
const DEFAULT_PLAN_FIELDS: PlanFormFields = Object.freeze({
  plannedTrials: String(LISTENING_DEFAULTS.plannedTrials),
  alpha: String(LISTENING_DEFAULTS.alpha),
  labelMode: LISTENING_DEFAULTS.labelMode,
});

type SharedBanner =
  | { readonly kind: "ok"; readonly test: SharedTest }
  | { readonly kind: "invalid"; readonly reason: string };

/** Drop a test link from the address bar once it has been read. */
function removeShareFragment(): void {
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname + window.location.search,
  );
}

function planFieldsFromShare(test: SharedTest): PlanFormFields {
  return {
    plannedTrials: String(test.plan.plannedTrials),
    alpha: String(test.plan.alpha),
    labelMode: test.plan.labelMode,
  };
}

function phaseLabel(phase: PreparationProgress["phase"]): string {
  switch (phase) {
    case "loading":
      return "Loading";
    case "probing":
      return "Probing";
    case "encoding":
      return "Encoding/decoding";
    case "preparing":
      return "Aligning and matching levels";
    case "measuring":
      return "Measuring delivered bytes";
    case "complete":
      return "Complete";
  }
}

function planMatches(
  snapshot: ExperimentSnapshot,
  fields: ListeningPlanFields,
): boolean {
  return (
    snapshot.plan.plannedTrials === Number(fields.plannedTrials) &&
    snapshot.plan.alpha === Number(fields.alpha) &&
    snapshot.plan.labelMode === fields.labelMode &&
    snapshot.plan.calibrationEnabled === fields.calibrationEnabled
  );
}

function CapabilitiesPanel(props: {
  readonly state: CapabilitiesState;
}): JSX.Element {
  const kind: ClientRuntimeKind = "browser";
  if (props.state.status === "loading") {
    return (
      <section
        className="capability-strip"
        aria-labelledby="capabilities-heading"
        data-runtime={kind}
      >
        <div className="section-head">
          <h2 id="capabilities-heading">Runtime capabilities</h2>
          <p className="section-meta">Probing the local runtime</p>
        </div>
        <p role="status" className="hint">
          Loading the local WASM core and checking each encoder and decoder…
        </p>
      </section>
    );
  }
  if (props.state.status === "error") {
    return (
      <section
        className="capability-strip"
        aria-labelledby="capabilities-heading"
        data-runtime={kind}
      >
        <div className="section-head">
          <h2 id="capabilities-heading">Runtime capabilities</h2>
          <p className="section-meta">Unavailable</p>
        </div>
        <p className="status-error" role="alert">
          Capability loading failed: {props.state.error}
        </p>
        <p className="hint">
          No engine substitution, upload or simulated codec fallback is applied.
          Reload the page to retry.
        </p>
      </section>
    );
  }
  const capabilities = props.state.capabilities;
  const availableCodecs = capabilities.codecs.filter(isAvailable).length;
  return (
    <section
      className="capability-strip"
      aria-labelledby="capabilities-heading"
      data-runtime={kind}
    >
      <div className="section-head">
        <h2 id="capabilities-heading">Runtime capabilities</h2>
        <p className="section-meta">
          <span
            className={`badge badge-${availableCodecs > 0 ? "available" : "unavailable"}`}
          >
            {availableCodecs} available
          </span>
        </p>
      </div>
      <details className="cap-details">
        <summary>Codecs and limits</summary>
        <dl className="facts">
          <dt>Processing</dt>
          <dd>In this browser</dd>
          <dt>File limit</dt>
          <dd>
            {Math.round(capabilities.maxInputBytes / (1024 * 1024))} MiB,{" "}
            {Math.floor(capabilities.maxDurationSeconds / 60)} min
          </dd>
          <dt>Channels</dt>
          <dd>Mono or stereo</dd>
          <dt>Stages per side</dt>
          <dd>{capabilities.maxStagesPerSide ?? 1}</dd>
        </dl>
        <ul className="codec-list">
          {capabilities.codecs.map((codec) => (
            <li key={codec.codecId}>
              <strong>{codecLabel(codec.codecId)}</strong>{" "}
              <span className={`badge badge-${codec.availability}`}>
                {codec.availability}
              </span>
              {codec.reason ? (
                <span className="codec-reason">{codec.reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function App(): JSX.Element {
  const [runtime] = useState(createClientRuntime);
  return <RuntimeApp runtime={runtime} />;
}

function RuntimeApp({
  runtime,
}: {
  readonly runtime: ClientRuntime;
}): JSX.Element {
  const kind: ClientRuntimeKind = "browser";
  const engine = runtime.preparation;
  const { preference: themePreference, setPreference: setThemePreference } =
    useThemePreference();
  const [view, setView] = useState<WorkspaceView>("setup");
  // A test link fills the setup once at load; nothing prepares or plays.
  const [initialShare] = useState(() =>
    parseSharedTestFragment(window.location.hash),
  );
  const sharedAtLoad = initialShare.status === "ok" ? initialShare.test : null;
  const [sharedBanner, setSharedBanner] = useState<SharedBanner | null>(() =>
    initialShare.status === "ok"
      ? { kind: "ok", test: initialShare.test }
      : initialShare.status === "invalid"
        ? { kind: "invalid", reason: initialShare.reason }
        : null,
  );
  const [shareRequest, setShareRequest] = useState<ShareRequest | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesState>({
    status: "loading",
  });
  const [stagesA, setStagesA] = useState<readonly CodecSelection[]>(
    sharedAtLoad?.a ?? DEFAULT_STAGES_A,
  );
  const [stagesB, setStagesB] = useState<readonly CodecSelection[]>(
    sharedAtLoad?.b ?? DEFAULT_STAGES_B,
  );
  const [rateMode, setRateMode] = useState<SampleRateMode>(
    sharedAtLoad?.sampleRateMode ?? "native",
  );
  const [preparationMode, setPreparationMode] =
    useState<BrowserPreparationMode>("aligned-gain-matched-v1");
  /** One opt-in: canary generation and the listening calibration plan. */
  const [calibrationEnabled, setCalibrationEnabled] = useState(
    sharedAtLoad?.canaryEnabled ?? false,
  );
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<SampleUrls>(EMPTY_SAMPLES);
  const [planFields, setPlanFields] = useState<PlanFormFields>(() =>
    sharedAtLoad === null ? DEFAULT_PLAN_FIELDS : planFieldsFromShare(sharedAtLoad),
  );
  const [planError, setPlanError] = useState<string | null>(null);

  const listening = useListening(runtime.createListeningClient);
  const listeningLocksLab = listening.state.session !== "idle";
  const diagnosticAudioBlocked =
    listeningLocksLab &&
    listening.state.session !== "completed" &&
    listening.state.session !== "sealed" &&
    listening.state.session !== "void";
  const diagnosticAudioBlockedRef = useRef(diagnosticAudioBlocked);
  diagnosticAudioBlockedRef.current = diagnosticAudioBlocked;
  const [audioDetails, setAudioDetails] = useState<EvidenceDetailsState>({
    test: false,
    measurements: false,
    files: false,
    canary: false,
  });
  const listeningLocksRef = useRef(listeningLocksLab);
  listeningLocksRef.current = listeningLocksLab;
  const listeningReaders = useMemo<ListeningReaders>(
    () => ({
      readAudio: (artifactId, side) => engine.readAudio(artifactId, side),
      ...(engine.readCanaryAudio
        ? {
            readCanaryAudio: (artifactId, side) =>
              engine.readCanaryAudio!(artifactId, side),
          }
        : {}),
    }),
    [engine],
  );

  const mountedRef = useRef(true);
  const samplesRef = useRef<SampleUrls>(EMPTY_SAMPLES);
  const audioElementsRef = useRef<
    Record<keyof SampleUrls, HTMLAudioElement | null>
  >({
    a: null,
    b: null,
    pristine: null,
    degraded: null,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const revokeSamples = useCallback((): void => {
    for (const url of sampleUrlList(samplesRef.current)) {
      URL.revokeObjectURL(url);
    }
    samplesRef.current = EMPTY_SAMPLES;
    if (mountedRef.current) setSamples(EMPTY_SAMPLES);
  }, []);

  const stopDiagnosticOutputs = useCallback((): void => {
    // Pausing the element itself is required; removing the DOM or revoking a
    // blob URL alone does not guarantee that an already-playing element stops.
    for (const key of Object.keys(
      audioElementsRef.current,
    ) as (keyof SampleUrls)[]) {
      const element = audioElementsRef.current[key];
      audioElementsRef.current[key] = null;
      if (element === null) continue;
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    revokeSamples();
  }, [revokeSamples]);

  const audioRefCallbacks = useMemo(() => {
    const register =
      (key: keyof SampleUrls) =>
      (element: HTMLAudioElement | null): void => {
        if (element !== null) {
          audioElementsRef.current[key] = element;
          return;
        }
        // React calls this on unmount before passive effects. Keep the element
        // reference so a playing HTML audio output is stopped, not just orphaned.
        const previous = audioElementsRef.current[key];
        audioElementsRef.current[key] = null;
        if (previous !== null) {
          previous.pause();
          previous.removeAttribute("src");
          previous.load();
        }
      };
    return {
      a: register("a"),
      b: register("b"),
      pristine: register("pristine"),
      degraded: register("degraded"),
    };
  }, []);

  useEffect(() => {
    if (diagnosticAudioBlocked) stopDiagnosticOutputs();
  }, [diagnosticAudioBlocked, stopDiagnosticOutputs]);

  // Request policy stays a view/config fact: which manual policy and rate were
  // selected. Sequencing, captured identity and reuse belong to the workflow.
  const buildPreparationRequest = useCallback(
    (
      inputs: PrepareTestInputs,
      mode: PrepareTestRequestMode,
    ): PreparationRequest => {
      // The primary action always requests the shared policy; the advanced
      // manual form may deliberately request the raw probe.
      const selectedPolicy =
        mode === "prepare-test" ||
        inputs.diagnosticPolicy === "aligned-gain-matched-v1"
          ? { preparationPolicy: "aligned-gain-matched-v1" as const }
          : {};
      const global = {
        sampleRateMode: inputs.rateMode,
        ...selectedPolicy,
        ...(inputs.calibrationEnabled ? { canaryEnabled: true } : {}),
      };
      // Both sides with exactly one stage keep the delivered version-1 request.
      // Any explicit multi-stage chain is represented as version 2.
      return inputs.stagesA.length === 1 && inputs.stagesB.length === 1
        ? {
            version: 1,
            ...global,
            a: stageSelection(
              inputs.stagesA[0]!.codecId,
              inputs.stagesA[0]!.bitrateKbps,
            ),
            b: stageSelection(
              inputs.stagesB[0]!.codecId,
              inputs.stagesB[0]!.bitrateKbps,
            ),
          }
        : {
            version: 2,
            ...global,
            a: Object.freeze(
              inputs.stagesA.map((stage) =>
                stageSelection(stage.codecId, stage.bitrateKbps),
              ),
            ),
            b: Object.freeze(
              inputs.stagesB.map((stage) =>
                stageSelection(stage.codecId, stage.bitrateKbps),
              ),
            ),
          };
    },
    [],
  );

  // One workflow per mounted app. It is created lazily so its lifecycle and
  // engine disposal ownership cannot be replaced by a later render.
  const [workflow] = useState(
    () =>
      new PrepareTestWorkflow<ClientSource, PreparedArtifact>({
        engine,
        controller: listening.controller,
        readers: listeningReaders,
        isListeningLocked: () => listeningLocksRef.current,
        onArtifactDiscarded: stopDiagnosticOutputs,
        buildRequest: buildPreparationRequest,
        publishError: (message) => {
          if (mountedRef.current) setError(message);
        },
        reportCleanupFailure: (message) => {
          console.error("Application cleanup was not confirmed:", message);
        },
      }),
  );

  const [workflowState, setWorkflowState] = useState(() => workflow.state);
  useEffect(() => workflow.subscribe(setWorkflowState), [workflow]);
  // The lifecycle stays the artifact owner and is observed directly for
  // diagnostics; the workflow owns setup sequencing and reuse identity.
  const [preparationState, setPreparationState] = useState(
    () => workflow.lifecycle.state,
  );
  useEffect(
    () => workflow.lifecycle.subscribe(setPreparationState),
    [workflow],
  );
  const { source, status, progress, artifact, resetting, changingSource } =
    preparationState;

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void engine.capabilities().then(
      (value) => {
        if (cancelled || !mountedRef.current) return;
        setCapabilities({ status: "ready", capabilities: value });
      },
      (reason: unknown) => {
        if (cancelled || !mountedRef.current) return;
        setCapabilities({ status: "error", error: errorMessage(reason) });
      },
    );
    return () => {
      cancelled = true;
      mountedRef.current = false;
      for (const url of sampleUrlList(samplesRef.current)) {
        URL.revokeObjectURL(url);
      }
      samplesRef.current = EMPTY_SAMPLES;
      // The workflow joins the listening Worker/player, then preparation, then
      // the engine. Each failure is reported; teardown never claims completion
      // or skips the remaining owners.
      void workflow.dispose();
    };
  }, [engine, workflow]);

  const caps =
    capabilities.status === "ready" ? capabilities.capabilities : null;
  const maxStagesPerSide = Math.max(
    1,
    Math.min(MAX_STAGES_PER_SIDE, caps?.maxStagesPerSide ?? 1),
  );
  const allStages = useMemo(
    () => [
      ...stagesA.map((stage, index) => ({ side: "a" as const, index, stage })),
      ...stagesB.map((stage, index) => ({ side: "b" as const, index, stage })),
    ],
    [stagesA, stagesB],
  );
  const unavailableStages = allStages.flatMap(({ side, index, stage }) => {
    const capability = availability(caps, stage.codecId);
    return isAvailable(capability)
      ? []
      : [
          {
            side,
            index,
            codecId: stage.codecId,
            availability: capability?.availability ?? "unknown",
            reason:
              capability?.reason ?? "Availability has not been established",
          },
        ];
  });
  const chainsFit =
    stagesA.length <= maxStagesPerSide && stagesB.length <= maxStagesPerSide;
  const codecsReady = unavailableStages.length === 0 && chainsFit;
  const busy = status === "preparing" || status === "cancelling";
  const prepareTestBusy = workflowState.busy;
  const controlsDisabled =
    busy || resetting || changingSource || listeningLocksLab || prepareTestBusy;
  const unavailableSelection =
    capabilities.status === "ready" && !codecsReady
      ? chainsFit
        ? "Selected stages cannot be requested: " +
          unavailableStages
            .map(
              (entry) =>
                `side ${entry.side.toUpperCase()} stage ${entry.index + 1} ${CODEC_CATALOG[entry.codecId].displayName} is ${entry.availability} (${entry.reason})`,
            )
            .join("; ") +
          ". No codec substitution is applied."
        : `This build advertises at most ${maxStagesPerSide} stage(s) per side; remove stages before preparing.`
      : null;

  // Every value the primary action may capture. The workflow snapshots these
  // on an explicit command; nothing here starts work by itself.
  const inputs = useMemo<PrepareTestInputs>(
    () => ({
      sourceIdentity:
        source === null
          ? "none"
          : `file:${source.name}:${source.size}:${source.lastModified}`,
      stagesA,
      stagesB,
      rateMode,
      calibrationEnabled,
      diagnosticPolicy: preparationMode,
    }),
    [source, stagesA, stagesB, rateMode, calibrationEnabled, preparationMode],
  );

  const chooseSource = async (selected: ClientSource): Promise<boolean> => {
    const adopted = await workflow.chooseSource(selected);
    if (!adopted && fileInputRef.current) fileInputRef.current.value = "";
    return adopted;
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    if (listeningLocksLab) return;
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    void chooseSource(selected);
  };

  const beginPrepare = (): void => {
    if (listeningLocksLab || prepareTestBusy) return;
    if (
      !source ||
      controlsDisabled ||
      !codecsReady ||
      !preparationModeSupported
    )
      return;
    if (preparationMode === "codec-probe-only" && calibrationEnabled) return;
    setModeNotice(null);
    void workflow.prepareDiagnostic(inputs);
  };

  const cancelPrepare = (): void => {
    if (prepareTestBusy) return;
    void workflow.cancel();
  };

  const reset = async (): Promise<void> => {
    if (resetting || listeningLocksLab) return;
    const cleared = await workflow.reset();
    if (cleared && mountedRef.current && fileInputRef.current)
      fileInputRef.current.value = "";
  };

  /**
   * One explicit primary action: prepare aligned audio, verify/bind the exact
   * captured plan, then stage trial 1 paused. The workflow owns that sequence;
   * this handler only submits the current form values. It never plays, answers
   * or advances, and it never binds a completed artifact from an effect.
   */
  const runPrepareTest = (plan: ExperimentPlan): Promise<void> => {
    // View prerequisites keep the button disabled; this guard mirrors them so a
    // programmatic call cannot bypass codec/policy readiness.
    if (!source || !codecsReady || !alignedPreparationSupported)
      return Promise.resolve();
    setModeNotice(null);
    return workflow.prepareTest(inputs, plan);
  };

  const cancelPrepareTest = (): Promise<void> => workflow.cancel();

  const loadSample = async (side: Side): Promise<void> => {
    if (diagnosticAudioBlockedRef.current) return;
    const current = workflow.lifecycle.completedArtifact;
    if (!current) return;
    try {
      const bytes = await engine.readAudio(current.id, side);
      if (
        !mountedRef.current ||
        diagnosticAudioBlockedRef.current ||
        workflow.lifecycle.completedArtifact !== current
      )
        return;
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      const previous = samplesRef.current[side];
      if (previous) URL.revokeObjectURL(previous);
      const next: SampleUrls = { ...samplesRef.current, [side]: url };
      samplesRef.current = next;
      if (mountedRef.current) setSamples(next);
    } catch (reason: unknown) {
      if (
        mountedRef.current &&
        workflow.lifecycle.completedArtifact === current
      ) {
        setError(`Sample unavailable: ${errorMessage(reason)}`);
      }
    }
  };

  const downloadWav = async (side: Side): Promise<void> => {
    if (diagnosticAudioBlockedRef.current) return;
    const current = workflow.lifecycle.completedArtifact;
    if (!current) return;
    try {
      const bytes = await engine.readAudio(current.id, side);
      if (
        !mountedRef.current ||
        diagnosticAudioBlockedRef.current ||
        workflow.lifecycle.completedArtifact !== current
      )
        return;
      triggerDownload(
        new Blob([bytes], { type: "audio/wav" }),
        `codec-abx-diagnostic-side-${side}-${current.id.slice(0, 8)}.wav`,
      );
    } catch (reason: unknown) {
      if (
        mountedRef.current &&
        workflow.lifecycle.completedArtifact === current
      ) {
        setError(`Diagnostic WAV unavailable: ${errorMessage(reason)}`);
      }
    }
  };

  const loadCanarySample = async (side: CanarySide): Promise<void> => {
    if (diagnosticAudioBlockedRef.current) return;
    const current = workflow.lifecycle.completedArtifact;
    if (!current?.canary?.audio) return;
    try {
      const bytes = await engine.readCanaryAudio?.(current.id, side);
      if (!bytes)
        throw new Error("This engine does not expose canary material");
      if (
        !mountedRef.current ||
        diagnosticAudioBlockedRef.current ||
        workflow.lifecycle.completedArtifact !== current
      )
        return;
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      const previous = samplesRef.current[side];
      if (previous) URL.revokeObjectURL(previous);
      const next: SampleUrls = { ...samplesRef.current, [side]: url };
      samplesRef.current = next;
      if (mountedRef.current) setSamples(next);
    } catch (reason: unknown) {
      if (
        mountedRef.current &&
        workflow.lifecycle.completedArtifact === current
      ) {
        setError(`Canary sample unavailable: ${errorMessage(reason)}`);
      }
    }
  };

  const downloadCanaryWav = async (side: CanarySide): Promise<void> => {
    if (diagnosticAudioBlockedRef.current) return;
    const current = workflow.lifecycle.completedArtifact;
    if (!current?.canary?.audio) return;
    try {
      const bytes = await engine.readCanaryAudio?.(current.id, side);
      if (!bytes)
        throw new Error("This engine does not expose canary material");
      if (
        !mountedRef.current ||
        diagnosticAudioBlockedRef.current ||
        workflow.lifecycle.completedArtifact !== current
      )
        return;
      triggerDownload(
        new Blob([bytes], { type: "audio/wav" }),
        `codec-abx-canary-${side}-${current.id.slice(0, 8)}.wav`,
      );
    } catch (reason: unknown) {
      if (
        mountedRef.current &&
        workflow.lifecycle.completedArtifact === current
      ) {
        setError(`Canary WAV unavailable: ${errorMessage(reason)}`);
      }
    }
  };

  const downloadResults = async (): Promise<void> => {
    const current = workflow.lifecycle.state.artifact;
    if (!current) return;
    const hasRun =
      listening.state.snapshot !== null && listening.state.session !== "idle";
    const payload = hasRun
      ? await listening.controller.exportPayload()
      : buildDiagnosticExport(current, new Date().toISOString());
    if (payload === null) return;
    const kind = hasRun ? "listening" : "diagnostic";
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
      `codec-abx-${kind}-${current.id.slice(0, 8)}.json`,
    );
  };

  const closeListeningRun = async (): Promise<void> => {
    await listening.controller.closeSession();
    if (!mountedRef.current) return;
    setView("setup");
  };

  const endTest = async (): Promise<void> => {
    // Stop the audible transport immediately; the controller owns whether a
    // paused graph can be resumed by an in-flight operation.
    listening.controller.pause();
    await listening.controller.seal();
    if (!mountedRef.current) return;
    if (listening.controller.state.snapshot?.lifecycle === "sealed") {
      setView("evidence");
      return;
    }
    // Seal could not complete while work was in flight. Terminate through the
    // explicit close path and never claim a sealed export for this run.
    await listening.controller.closeSession();
    if (!mountedRef.current) return;
    setError(
      "The run was stopped before it could be sealed; no sealed export was produced.",
    );
    setView("setup");
  };

  const selectedName = clientSourceName(source);
  const selectedSize = clientSourceSize(source);
  const sourceSize =
    selectedSize === null
      ? null
      : `${(selectedSize / (1024 * 1024)).toFixed(2)} MiB`;
  const supportedPolicies =
    caps?.supportedPreparationPolicies ??
    (caps ? [caps.preparationPolicy] : []);
  const requestedPolicy = preparationMode;
  const preparationModeSupported =
    supportedPolicies.length === 0 ||
    supportedPolicies.includes(requestedPolicy);
  const alignedPreparationSupported =
    supportedPolicies.length === 0 ||
    supportedPolicies.includes("aligned-gain-matched-v1");
  const manualCanaryConflict =
    preparationMode === "codec-probe-only" && calibrationEnabled;
  // A missing source stays a gate but carries no message: the disabled
  // action already says it, and the setup view repeats it enough.
  const manualPrepareBlockedReason = listeningLocksLab
    ? "Close the current listening run before manual preparation."
    : !source
      ? null
      : !codecsReady
        ? (unavailableSelection ?? "Choose available codecs first.")
        : busy || resetting || changingSource || prepareTestBusy
          ? "Wait for the current operation to finish before manual preparation."
          : !preparationModeSupported
            ? "This build does not advertise the selected manual policy; no silent fallback is applied."
            : manualCanaryConflict
              ? "Manual raw preparation cannot generate the readiness check. Choose aligned for manual diagnostics or turn the readiness check off; Prepare test always uses aligned preparation."
              : null;
  const manualCanPrepare =
    source !== null && manualPrepareBlockedReason === null;
  const primaryBlockedReason =
    listeningLocksLab && listening.state.session !== "configured"
      ? "Close the current listening run before preparing another test."
      : listening.state.planLocked
        ? "Reset the listening run before preparing another test."
        : !source
          ? null
          : !codecsReady
            ? (unavailableSelection ?? "Choose available codecs first.")
            : busy || resetting || changingSource
              ? "Wait for the current operation to finish before preparing the test."
              : !alignedPreparationSupported
                ? "This build does not advertise aligned and gain-matched preparation."
                : null;

  const planFieldsWithCalibration = useMemo<ListeningPlanFields>(
    () => ({ ...planFields, calibrationEnabled }),
    [planFields, calibrationEnabled],
  );
  const planValidation = useMemo(
    () => validateListeningPlan(planFieldsWithCalibration),
    [planFieldsWithCalibration],
  );
  const planDirty =
    listening.state.snapshot === null
      ? true
      : !planMatches(listening.state.snapshot, planFieldsWithCalibration);
  const planDisabled =
    listening.state.busy !== null ||
    listening.state.planLocked ||
    prepareTestBusy ||
    listening.state.session === "fatal";
  const calibrationDisabled =
    planDisabled || listening.state.session !== "idle";
  const runConfigured = listening.state.session === "configured";
  const canApplyPlan =
    runConfigured &&
    listening.state.busy === null &&
    !listening.state.planLocked &&
    planValidation.plan !== null &&
    planDirty &&
    artifact !== null;
  const primaryCanPrepare =
    source !== null &&
    primaryBlockedReason === null &&
    !prepareTestBusy &&
    listening.state.busy === null &&
    !listening.state.planLocked &&
    planValidation.plan !== null;
  const primaryPairReady = workflow.isPairReady(inputs);
  const globalError = error ?? workflowState.error;
  const snapshot = listening.state.snapshot;

  // Shared test links: read at load (above) or when a link is opened in this
  // tab later, then removed from the address bar.
  const applySharedTest = useCallback((test: SharedTest): void => {
    setStagesA(test.a);
    setStagesB(test.b);
    setRateMode(test.sampleRateMode);
    setCalibrationEnabled(test.canaryEnabled);
    setPlanFields(planFieldsFromShare(test));
    setPlanError(null);
    setModeNotice(null);
  }, []);
  useEffect(() => {
    if (parseSharedTestFragment(window.location.hash).status !== "none")
      removeShareFragment();
    const onHashChange = (): void => {
      const parsed = parseSharedTestFragment(window.location.hash);
      if (parsed.status === "none") return;
      removeShareFragment();
      if (parsed.status === "invalid") {
        setSharedBanner({ kind: "invalid", reason: parsed.reason });
        return;
      }
      if (listeningLocksRef.current) {
        setSharedBanner({
          kind: "invalid",
          reason: "End the current test, then open the link again.",
        });
        return;
      }
      applySharedTest(parsed.test);
      setSharedBanner({ kind: "ok", test: parsed.test });
      setView("setup");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applySharedTest]);

  /** The current setup when it can be shared; null while the plan is invalid. */
  const shareSetup = useMemo<SharedTest | null>(() => {
    const plan = planValidation.plan;
    if (plan === null || plan.plannedTrials === null) return null;
    const setup: SharedTest = {
      a: stagesA,
      b: stagesB,
      sampleRateMode: rateMode,
      canaryEnabled: calibrationEnabled,
      plan: { ...plan, plannedTrials: plan.plannedTrials },
    };
    try {
      encodeSharedTest(setup);
      return setup;
    } catch {
      return null;
    }
  }, [planValidation.plan, stagesA, stagesB, rateMode, calibrationEnabled]);

  const sharedTest = sharedBanner?.kind === "ok" ? sharedBanner.test : null;
  const sharedHint = sharedTest?.source ?? null;
  const sharedEdited =
    sharedTest !== null && (shareSetup === null || !sameSharedSetup(sharedTest, shareSetup));

  const clearSharedTest = (): void => {
    if (sharedBanner?.kind === "ok" && !controlsDisabled) {
      applySharedTest({
        a: DEFAULT_STAGES_A,
        b: DEFAULT_STAGES_B,
        sampleRateMode: "native",
        canaryEnabled: false,
        plan: {
          version: 1,
          plannedTrials: LISTENING_DEFAULTS.plannedTrials,
          alpha: LISTENING_DEFAULTS.alpha,
          labelMode: LISTENING_DEFAULTS.labelMode,
          calibrationEnabled: false,
        },
      });
    }
    setSharedBanner(null);
  };

  const prepareTest = (): void => {
    if (
      (listeningLocksLab && listening.state.session !== "configured") ||
      prepareTestBusy ||
      listening.state.busy !== null ||
      listening.state.planLocked
    )
      return;
    if (planValidation.plan === null) {
      setPlanError(planValidation.errors.join(" "));
      setView("setup");
      return;
    }
    if (primaryBlockedReason !== null) {
      setPlanError(primaryBlockedReason);
      setView("setup");
      return;
    }
    setPlanError(null);
    setModeNotice(null);
    setView("listen");
    void runPrepareTest(planValidation.plan);
  };

  const retryPrepareTest = (): void => {
    if (
      prepareTestBusy ||
      listening.state.busy !== null ||
      listening.state.planLocked
    )
      return;
    if (planValidation.plan === null) {
      setPlanError(planValidation.errors.join(" "));
      setView("setup");
      return;
    }
    setPlanError(null);
    setView("listen");
    void runPrepareTest(planValidation.plan);
  };

  const applyPlan = async (): Promise<void> => {
    const plan = planValidation.plan;
    if (plan === null) {
      setPlanError(planValidation.errors.join(" "));
      return;
    }
    if (artifact === null) {
      setPlanError("No prepared pair is retained. Run Prepare test again.");
      return;
    }
    if (listening.state.busy !== null || listening.state.planLocked) return;
    setPlanError(null);
    await listening.controller.prepareSession(plan, artifact, listeningReaders);
    if (
      listening.controller.state.session === "configured" &&
      listening.controller.state.error === null
    )
      await listening.controller.start();
  };

  const changePlan = (patch: Partial<PlanFormFields>): void => {
    setPlanFields((previous) => ({ ...previous, ...patch }));
    setPlanError(null);
  };

  const changeCalibration = (enabled: boolean): void => {
    setCalibrationEnabled(enabled);
    setModeNotice(null);
    setPlanError(null);
  };

  const disableCalibration = async (): Promise<void> => {
    const next = validateListeningPlan({
      ...planFields,
      calibrationEnabled: false,
    });
    setCalibrationEnabled(false);
    setModeNotice(null);
    if (next.plan === null) {
      setPlanError(next.errors.join(" "));
      return;
    }
    setPlanError(null);
    if (
      artifact !== null &&
      listening.state.session === "configured" &&
      listening.state.busy === null &&
      !listening.state.planLocked
    ) {
      await listening.controller.prepareSession(
        next.plan,
        artifact,
        listeningReaders,
      );
      if (
        listening.controller.state.session === "configured" &&
        listening.controller.state.error === null
      )
        await listening.controller.start();
    }
  };

  const restartListeningRun = async (): Promise<void> => {
    stopDiagnosticOutputs();
    setView("listen");
    await listening.controller.restart();
  };

  const tally = useRunTally(listening.state.feedback);
  const session = listening.state.session;
  const terminal =
    session === "completed" || session === "sealed" || session === "void";
  const hasRun = snapshot !== null && session !== "fatal" && session !== "idle";
  const terminalTally =
    terminal && snapshot !== null && tally !== null && tally.runId === snapshot.runId
      ? tally.rows
      : null;
  const exportDisabled =
    listening.state.busy !== null ||
    (snapshot !== null && !listening.state.canExport);

  const runActions = (
    <RunActions
      hasRun={hasRun}
      closing={session === "closing"}
      exportDisabled={exportDisabled || artifact === null}
      onDownload={() => void downloadResults()}
      onReset={() => void restartListeningRun()}
      onClose={() => void closeListeningRun()}
      {...(shareSetup !== null
        ? {
            onShare: () =>
              setShareRequest({ setup: shareSetup, copyOnOpen: false }),
          }
        : {})}
      clear={
        listeningLocksLab || artifact === null
          ? null
          : { disabled: resetting, onClear: () => void reset() }
      }
    />
  );

  const audioComparison = (actions?: JSX.Element) =>
    artifact && (
      <AudioComparison
        artifact={artifact}
        actionsDisabled={
          busy ||
          resetting ||
          changingSource ||
          prepareTestBusy ||
          diagnosticAudioBlocked ||
          status !== "complete"
        }
        audioBlocked={diagnosticAudioBlocked}
        detailsState={audioDetails}
        onDetailsChange={(key, open) =>
          setAudioDetails((previous) =>
            previous[key] === open ? previous : { ...previous, [key]: open },
          )
        }
        samples={samples}
        audioRefs={audioRefCallbacks}
        onLoadSample={(side) => void loadSample(side)}
        onDownloadWav={(side) => void downloadWav(side)}
        onLoadCanary={(side) => void loadCanarySample(side)}
        onDownloadCanary={(side) => void downloadCanaryWav(side)}
        {...(actions ? { actions } : {})}
      />
    );

  const showSetupResults =
    view === "setup" &&
    artifact !== null &&
    status === "complete" &&
    workflowState.phase === "idle" &&
    !listeningLocksLab;
  const websiteHome = import.meta.env.BASE_URL === WEBSITE_BASE;
  const sourceOffer = sourceOfferLink({
    baseUrl: import.meta.env.BASE_URL,
  });

  // Stepper: Setup is done once a test holds the setup; Listen opens when
  // something is staged, preparing or needs a retry; Results opens when a run
  // or prepared audio exists. A locked step cannot be opened.
  const listenAvailable =
    session !== "idle" ||
    prepareTestBusy ||
    workflowState.phase === "error" ||
    workflowState.phase === "cancelled" ||
    listening.state.error !== null;
  const resultsAvailable = snapshot !== null || artifact !== null;
  const stepState = (
    step: WorkspaceView,
    done: boolean,
    available: boolean,
  ): StepState =>
    view === step ? "current" : done ? "done" : available ? "available" : "locked";
  const steps: readonly StepDescriptor[] = [
    {
      view: "setup",
      label: "Setup",
      state: stepState("setup", listeningLocksLab, true),
    },
    {
      view: "listen",
      label: "Listen",
      state: stepState("listen", terminal, listenAvailable),
      lockedReason: "Prepare a test first",
    },
    {
      view: "evidence",
      label: "Results",
      state: stepState("evidence", false, resultsAvailable),
      lockedReason: "Results appear after you prepare audio or run a test",
    },
  ];

  const deliveredA = artifact?.a.delivered ?? null;
  const preparedFacts =
    deliveredA !== null && deliveredA.sampleRate > 0
      ? {
          sampleRate: deliveredA.sampleRate,
          channels: deliveredA.channels,
          seconds: deliveredA.frames / deliveredA.sampleRate,
        }
      : null;
  const output = listening.state.playback?.output;
  const showStrip = listeningLocksLab || prepareTestBusy;
  const runEndable =
    snapshot !== null &&
    (snapshot.lifecycle === "running" || snapshot.lifecycle === "configured") &&
    (session === "running" || session === "configured") &&
    !prepareTestBusy;
  const stripPlan = snapshot
    ? `${snapshot.plan.plannedTrials ?? "Practice"} trials, α ${snapshot.plan.alpha}, ${snapshot.plan.labelMode === "fixed" ? "fixed labels" : "randomized"}`
    : `${planFields.plannedTrials} trials, α ${planFields.alpha}, ${planFields.labelMode === "fixed" ? "fixed labels" : "randomized"}`;
  const lifecycleLabel =
    snapshot === null
      ? null
      : snapshot.lifecycle === "completed"
        ? "Completed"
        : snapshot.lifecycle === "sealed"
          ? "Ended early"
          : snapshot.lifecycle === "void"
            ? "Void"
            : null;

  const limitLine = caps
    ? `Up to ${Math.floor(caps.maxDurationSeconds / 60)} min, ${Math.round(caps.maxInputBytes / (1024 * 1024))} MiB, 32-bit file`
    : "Up to 30 min, 512 MiB, 32-bit file";
  const advancedSummary = [
    rateMode === "native" ? "Native source rate" : "48 kHz delivery",
    preparationMode === "aligned-gain-matched-v1"
      ? "aligned and gain-matched"
      : "raw codec probe for diagnostics",
  ].join(", ");

  return (
    <div className="app" data-runtime={kind} data-view={view}>
      <TopBar
        brandHref={websiteHome ? "/" : null}
        steps={steps}
        onSelectStep={setView}
        themePreference={themePreference}
        onThemeChange={setThemePreference}
        about={
          <>
            <p className="about-lede">
              Audivane ABX compares two codec chains from one local audio file
              in a blind A/B/X test. Preparation and playback run in this
              browser with local WASM codecs. Audio is never uploaded to any server.
            </p>
            <dl className="facts">
              <dt>Runtime</dt>
              <dd>Browser local</dd>
              <dt>Source</dt>
              <dd>
                <a
                  href={sourceOffer.href}
                  target={sourceOffer.external ? "_blank" : undefined}
                  rel={sourceOffer.external ? "noopener noreferrer" : undefined}
                >
                  {sourceOffer.label}
                </a>
              </dd>
            </dl>
            <CapabilitiesPanel state={capabilities} />
          </>
        }
      />

      {showStrip ? (
        <SessionStrip
          sourceName={selectedName}
          sourceLength={preparedFacts ? formatLength(preparedFacts.seconds) : null}
          chainA={chainLabel(stagesA)}
          chainB={chainLabel(stagesB)}
          plan={stripPlan}
          output={deviceLabel(output, output?.selectedDeviceId ?? null)}
          phase={terminal ? "terminal" : listeningLocksLab ? "running" : "preparing"}
          lifecycleLabel={lifecycleLabel}
          canEnd={runEndable}
          onEnd={() => void endTest()}
          onViewResults={terminal && view === "setup" ? () => setView("evidence") : null}
        />
      ) : null}

      <main className="main-content" id="main">
        {globalError ? (
          <div className="global-error status-error" role="alert">
            {globalError}
          </div>
        ) : null}

        <section
          className="view"
          id="setup-view"
          hidden={view !== "setup"}
          aria-label="Setup"
        >
          {listeningLocksLab && (
            <p className="notice lock-banner" role="note">
              This test is active. Source, chains and plan are locked; end the
              test to edit them.
            </p>
          )}
          {sharedBanner !== null && !listeningLocksLab ? (
            <div
              className={`share-banner ${sharedBanner.kind === "ok" ? "notice" : "status-error"}`}
              role={sharedBanner.kind === "ok" ? "note" : "alert"}
            >
              <div className="share-banner-copy">
                {sharedBanner.kind === "ok" ? (
                  <>
                    <p>
                      <strong>Shared test:</strong>{" "}
                      {sharedTestSummary(sharedBanner.test)}
                      {sharedEdited ? " (edited)" : ""}
                    </p>
                    {sharedHint !== null ? (
                      <p className="field-note">
                        Sharer&apos;s file: {sharedHint.title}
                        {sharedHint.durationSeconds !== undefined
                          ? ` (${formatLength(sharedHint.durationSeconds)})`
                          : ""}
                      </p>
                    ) : null}
                    {capabilities.status === "ready" && unavailableStages.length > 0 ? (
                      <p className="share-banner-block">
                        {unavailableStages
                          .map(
                            (entry) =>
                              `${CODEC_CATALOG[entry.codecId].displayName} (side ${entry.side.toUpperCase()}, stage ${entry.index + 1})`,
                          )
                          .join(", ")}{" "}
                        {unavailableStages.length === 1 ? "does" : "do"} not
                        work in this browser, so this test cannot be prepared
                        here.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>
                    <strong>This test link could not be opened.</strong>{" "}
                    {sharedBanner.reason}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="ghost small"
                onClick={clearSharedTest}
              >
                {sharedBanner.kind === "ok" ? "Clear" : "Dismiss"}
              </button>
            </div>
          ) : null}
          <div className="setup-grid">
            <div className="setup-main">
              <SourceCard
                name={selectedName}
                sizeBytes={selectedSize}
                prepared={preparedFacts}
                disabled={controlsDisabled}
                locked={listeningLocksLab}
                limitLine={limitLine}
                fileInputRef={fileInputRef}
                onSelectFile={selectFile}
                onDropFile={(file) => {
                  if (listeningLocksLab || controlsDisabled) return;
                  void chooseSource(file);
                }}
              />

              <section className="card chain-board" aria-labelledby="config-heading">
                <div className="card-head">
                  <h2 id="config-heading">What are you comparing?</h2>
                  <span className="card-meta">
                    Up to {maxStagesPerSide} stage
                    {maxStagesPerSide === 1 ? "" : "s"} per side
                  </span>
                </div>
                <div className="chain-grid">
                  <StageEditor
                    side="a"
                    stages={stagesA}
                    capabilities={caps}
                    maxStages={maxStagesPerSide}
                    disabled={controlsDisabled}
                    onChange={setStagesA}
                  />
                  <span className="vs" aria-hidden="true">
                    vs
                  </span>
                  <StageEditor
                    side="b"
                    stages={stagesB}
                    capabilities={caps}
                    maxStages={maxStagesPerSide}
                    disabled={controlsDisabled}
                    onChange={setStagesB}
                  />
                </div>
                {!preparationModeSupported && (
                  <p className="status-error" role="alert">
                    This build does not advertise the selected manual
                    preparation policy; no silent fallback is applied.
                  </p>
                )}
                {unavailableSelection ? (
                  <p className="status-error" role="alert">
                    {unavailableSelection}
                  </p>
                ) : null}
              </section>

              <details className="card disclosure advanced-preparation">
                <summary>
                  <span>Advanced processing and diagnostics</span>
                  <span className="summary-meta">{advancedSummary}</span>
                </summary>
                <div className="advanced-body">
                  <fieldset className="field-group" disabled={controlsDisabled}>
                    <legend>Final sample rate</legend>
                    <div className="field">
                      <select
                        id="rate-mode"
                        aria-label="Final sample rate"
                        value={rateMode}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                          setRateMode(event.target.value as SampleRateMode);
                        }}
                      >
                        <option value="native">Native source rate</option>
                        <option value="force_48k">Force 48 kHz delivery</option>
                      </select>
                    </div>
                  </fieldset>
                  <fieldset className="field-group" disabled={controlsDisabled}>
                    <legend>Manual preparation policy</legend>
                    <div className="field">
                      <select
                        id="preparation-policy"
                        aria-label="Manual preparation policy"
                        value={preparationMode}
                        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                          const next = event.target
                            .value as BrowserPreparationMode;
                          setPreparationMode(next);
                          setModeNotice(
                            next === "codec-probe-only" && calibrationEnabled
                              ? "Raw manual preparation cannot generate the readiness check. Prepare test still uses aligned preparation; turn the readiness check off or choose aligned for manual diagnostics."
                              : null,
                          );
                        }}
                      >
                        <option value="codec-probe-only">
                          {PREPARATION_MODE_LABELS["codec-probe-only"]}
                        </option>
                        <option value="aligned-gain-matched-v1">
                          {PREPARATION_MODE_LABELS["aligned-gain-matched-v1"]}
                        </option>
                      </select>
                    </div>
                    <details className="disclosure-inline">
                      <summary>Policy difference</summary>
                      <p className="field-note">
                        Raw mode keeps the codec-stage WAV and measures it.
                        Prepared mode applies alignment, independent gains and
                        one common peak trim in a dedicated worker, then
                        measures the final serialized bytes.
                      </p>
                    </details>
                  </fieldset>
                  {modeNotice ? (
                    <p className="field-note" role="status">
                      {modeNotice}
                    </p>
                  ) : null}
                  <div className="prepare-bar">
                    {!source ? (
                      <p className="field-note">Choose a source file first.</p>
                    ) : null}
                    {manualPrepareBlockedReason ? (
                      <p className="field-note">{manualPrepareBlockedReason}</p>
                    ) : null}
                    <div className="actions prepare-actions">
                      <button
                        type="button"
                        className="ghost"
                        disabled={!manualCanPrepare}
                        onClick={beginPrepare}
                      >
                        Prepare diagnostic artifacts
                      </button>
                      {status === "preparing" && !prepareTestBusy ? (
                        <button
                          type="button"
                          className="quiet"
                          onClick={cancelPrepare}
                        >
                          Cancel
                        </button>
                      ) : null}
                      {resetting || source || artifact || status !== "idle" ? (
                        <button
                          type="button"
                          className="quiet"
                          disabled={resetting || listeningLocksLab}
                          onClick={() => void reset()}
                        >
                          {resetting ? "Resetting…" : "Reset"}
                        </button>
                      ) : null}
                    </div>
                    <div
                      className="run-status"
                      role="status"
                      aria-live="polite"
                    >
                      {status === "preparing" ? (
                        <>
                          <strong>Preparing the test audio.</strong>{" "}
                          {progress
                            ? `${phaseLabel(progress.phase)}: ${progress.message}`
                            : "Starting…"}
                        </>
                      ) : status === "cancelling" ? (
                        <strong>
                          Cancelling and waiting for WASM worker termination…
                        </strong>
                      ) : status === "cancelled" ? (
                        <>
                          <strong>Preparation was cancelled.</strong> The worker
                          stopped and its temporary files were removed, so you
                          can try again.
                        </>
                      ) : status === "complete" ? (
                        <strong>Diagnostic artifacts ready.</strong>
                      ) : status === "error" ? (
                        <strong>Preparation stopped with an error.</strong>
                      ) : null}
                    </div>
                    {status === "preparing" && (
                      <progress
                        aria-label="Preparation progress"
                        max={1}
                        value={undefined}
                      />
                    )}
                  </div>
                </div>
              </details>

              {artifact !== null &&
                isRawCodecProbeArtifact(artifact) &&
                !listeningLocksLab && (
                  <p className="warning" role="note">
                    <strong>Prepared for diagnostics.</strong>{" "}
                    {listeningArtifactEligibility(artifact) ?? ""} Prepare test
                    replaces this diagnostic artifact with an aligned pair; the
                    current artifact is released when the new preparation
                    starts.
                  </p>
                )}

              {showSetupResults &&
                audioComparison(
                  <RunActions
                    hasRun={false}
                    closing={false}
                    exportDisabled={exportDisabled}
                    onDownload={() => void downloadResults()}
                    onReset={() => undefined}
                    onClose={() => undefined}
                    clear={{ disabled: resetting, onClear: () => void reset() }}
                  />,
                )}
            </div>

            <aside className="setup-side" aria-label="Test plan and output">
              <PlanCard
                fields={planFields}
                disabled={planDisabled}
                locked={listening.state.planLocked}
                dirty={planDirty}
                valid={planValidation.plan !== null}
                error={planError}
                canApply={canApplyPlan}
                runConfigured={runConfigured}
                onApply={applyPlan}
                onChange={changePlan}
                calibrationEnabled={calibrationEnabled}
                calibrationDisabled={calibrationDisabled}
                onCalibrationChange={changeCalibration}
              />
              <OutputDevicePanel
                output={output}
                locked={listening.state.planLocked}
                busy={listening.state.busy !== null}
                onRefresh={() => void listening.controller.refreshOutputDevices()}
                onSelect={(deviceId) =>
                  void listening.controller.selectOutputDevice(deviceId)
                }
                onRequest={() => void listening.controller.requestOutputDevice()}
              />
              {listeningLocksLab ? (
                <div className="go">
                  <button
                    type="button"
                    className="primary go-button"
                    onClick={() => setView(terminal ? "evidence" : "listen")}
                  >
                    {terminal ? "View results" : "Back to the test"}
                  </button>
                </div>
              ) : (
                <div className="go">
                  <button
                    type="button"
                    className="primary go-button"
                    aria-describedby="prepare-hint"
                    disabled={!primaryCanPrepare}
                    onClick={prepareTest}
                  >
                    Prepare test
                  </button>
                  <p id="prepare-hint">
                    {primaryBlockedReason ??
                      (!source
                        ? "Choose a source file first."
                        : primaryPairReady
                          ? "Prepared pair ready. Prepare test verifies and stages trial 1 paused."
                          : "Aligns and level-matches both sides, then locks the source, chains and plan.")}
                  </p>
                </div>
              )}
              {shareSetup !== null ? (
                <button
                  type="button"
                  className="quiet small share-setup"
                  onClick={() =>
                    setShareRequest({ setup: shareSetup, copyOnOpen: true })
                  }
                >
                  Copy test link
                </button>
              ) : null}
            </aside>
          </div>
        </section>

        <section
          className="view"
          id="listen-view"
          hidden={view !== "listen"}
          aria-labelledby="listening-heading"
        >
          <ListeningSection
            artifact={
              listeningLocksLab || (status === "complete" && !controlsDisabled)
                ? artifact
                : null
            }
            listening={listening}
            active={view === "listen"}
            tally={tally}
            primary={{
              phase: workflowState.phase,
              busy: prepareTestBusy,
              message: workflowState.message,
              canPrepare: primaryCanPrepare,
              pairReady: primaryPairReady,
              onPrepare: retryPrepareTest,
              onCancel: cancelPrepareTest,
            }}
            onDisableCalibration={disableCalibration}
            onReset={() => void restartListeningRun()}
            onGoToSetup={() => setView("setup")}
            onViewResults={() => setView("evidence")}
          />
        </section>

        <section
          className="view"
          id="evidence-view"
          hidden={view !== "evidence"}
          aria-labelledby="evidence-heading"
        >
          <h1 id="evidence-heading" className="sr-only">
            Results
          </h1>

          {listening.state.error !== null && session !== "fatal" && (
            <div className="status-error" role="alert">
              <strong>Listening error:</strong> {listening.state.error.message}
              {listening.state.error.reasons.length > 0 && (
                <ul>
                  {listening.state.error.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {snapshot !== null && session !== "fatal" ? (
            <RunRecord
              snapshot={snapshot}
              tally={terminalTally}
              detailsOpen={audioDetails.test}
              onDetailsToggle={(open) =>
                setAudioDetails((previous) =>
                  previous.test === open ? previous : { ...previous, test: open },
                )
              }
            >
              {view === "evidence" && audioComparison()}
            </RunRecord>
          ) : artifact !== null ? (
            <>
              <div className="verdict">
                <div className="verdict-copy">
                  <p className="kicker">Prepared audio</p>
                  <h2 className="display">No listening run yet</h2>
                  <p className="verdict-text">
                    Both sides are prepared and measured. Listen to each side
                    below, or prepare the test to stage trial 1 paused.
                  </p>
                </div>
                {!listeningLocksLab && (session === "idle" || session === "configured") ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={!primaryCanPrepare}
                    onClick={prepareTest}
                  >
                    Prepare test
                  </button>
                ) : null}
              </div>
              {view === "evidence" && audioComparison()}
            </>
          ) : (
            <div className="listen-empty">
              <h2 className="display">Nothing to show yet</h2>
              <p>
                Results appear here after you prepare audio or run a test.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => setView("setup")}
                >
                  Back to Setup
                </button>
              </div>
            </div>
          )}
          {view === "evidence" && artifact !== null && runActions}
        </section>

        <ShareDialog
          request={shareRequest}
          source={source}
          sourceSeconds={preparedFacts?.seconds ?? null}
          onClose={() => setShareRequest(null)}
        />

        <footer className="app-footer">
          <span>Audivane ABX</span>
          <a
            href={sourceOffer.href}
            target={sourceOffer.external ? "_blank" : undefined}
            rel={sourceOffer.external ? "noopener noreferrer" : undefined}
          >
            {sourceOffer.label}
          </a>
        </footer>
      </main>
    </div>
  );
}
