import type {
  CanarySide,
  EngineCapabilities,
  PreparedArtifact,
  PreparationRequest,
  Side,
} from "@codec-abx/contracts";
import type { PrepareOptions } from "@codec-abx/preparation";
import { BrowserPreparationEngine } from "@codec-abx/engine-browser";
import { BrowserExperimentClient } from "@codec-abx/experiment-browser";

import type { ListeningClient } from "./listening/controller.js";

/** ABX runs in the browser only; both engines are local to this tab. */
export type ClientRuntimeKind = "browser";

/** The selected source stays in this tab as a local File. */
export type ClientSource = File;

export interface ClientPreparationEngine {
  capabilities(): Promise<EngineCapabilities>;
  prepare(
    source: ClientSource,
    request: PreparationRequest,
    options?: PrepareOptions,
  ): Promise<PreparedArtifact>;
  readAudio(artifactId: string, side: Side): Promise<ArrayBuffer>;
  readCanaryAudio?(artifactId: string, side: CanarySide): Promise<ArrayBuffer>;
  release(artifactId: string): Promise<void>;
  dispose(): Promise<void>;
}

export interface ClientRuntime {
  readonly kind: ClientRuntimeKind;
  readonly preparation: ClientPreparationEngine;
  createListeningClient(): ListeningClient;
}

export function sourceName(source: ClientSource | null): string | null {
  return source === null ? null : source.name;
}

export function sourceSize(source: ClientSource | null): number | null {
  return source === null ? null : source.size;
}

/**
 * Create the local browser runtime once per mounted application. Prepared audio
 * and the experiment service never leave this tab; no adapter can select a
 * different processing location.
 */
export function createClientRuntime(): ClientRuntime {
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  const engine = new BrowserPreparationEngine({
    coreURL: new URL("codec-assets/ffmpeg-core.js", base).href,
    wasmURL: new URL("codec-assets/ffmpeg-core.wasm", base).href,
    lc3WasmURL: new URL("codec-assets/lc3_codec.wasm", base).href,
    ldacWasmURL: new URL("codec-assets/ldac_codec.wasm", base).href,
  });
  return {
    kind: "browser",
    preparation: {
      capabilities: () => engine.capabilities(),
      prepare: (source, request, options) =>
        engine.prepare(source, request, options),
      readAudio: (artifactId, side) => engine.readAudio(artifactId, side),
      ...(engine.readCanaryAudio
        ? {
            readCanaryAudio: (artifactId: string, side: CanarySide) =>
              engine.readCanaryAudio!(artifactId, side),
          }
        : {}),
      release: (artifactId) => engine.release(artifactId),
      dispose: () => engine.dispose(),
    },
    createListeningClient: () => new BrowserExperimentClient(),
  };
}
