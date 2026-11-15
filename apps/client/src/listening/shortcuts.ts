import { useCallback, useEffect, useRef, useState } from "react";

import type { DisplayAnswer, PlaybackLabel } from "@codec-abx/contracts";

/**
 * Listening keyboard shortcuts: Space play/pause, A/B/X select, 1/2 answer.
 * Each action is offered only when the matching on-screen control is enabled,
 * calls the same controller method as that control and reveals nothing the
 * screen does not already show. Nothing fires while typing in a field, with a
 * modifier held, on key repeat or while a dialog or menu owns the keyboard.
 */
export type ShortcutAction =
  | { readonly kind: "toggle-playback" }
  | { readonly kind: "select"; readonly label: PlaybackLabel }
  | { readonly kind: "answer"; readonly answer: DisplayAnswer };

export interface ShortcutTarget {
  readonly tagName: string;
  readonly type?: string;
  readonly role?: string | null;
  readonly isContentEditable?: boolean;
  /** Inside an element marked data-no-shortcuts (a menu or popover). */
  readonly insideNoShortcuts?: boolean;
}

export interface ShortcutKey {
  readonly key: string;
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly target: ShortcutTarget | null;
}

export interface ShortcutContext {
  /** The Listen view is visible and no modal dialog is open. */
  readonly active: boolean;
  readonly playing: boolean;
  readonly playEnabled: boolean;
  readonly pauseEnabled: boolean;
  readonly selectEnabled: boolean;
  readonly answerEnabled: boolean;
}

const NON_TEXT_INPUTS = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "radio",
  "range",
  "file",
  "color",
  "image",
]);

const ACTIVATABLE_ROLES = new Set([
  "button",
  "checkbox",
  "link",
  "menuitem",
  "menuitemradio",
  "option",
  "radio",
  "slider",
  "switch",
  "tab",
]);

/** Text fields, number fields, selects and editable regions receive typing. */
export function isTextEntry(target: ShortcutTarget | null): boolean {
  if (target === null) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT")
    return !NON_TEXT_INPUTS.has((target.type ?? "text").toLowerCase());
  return false;
}

/** Space already activates these natively; a shortcut must not also fire. */
export function isActivatable(target: ShortcutTarget | null): boolean {
  if (target === null) return false;
  const tag = target.tagName.toUpperCase();
  if (
    tag === "BUTTON" ||
    tag === "A" ||
    tag === "SUMMARY" ||
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA"
  )
    return true;
  return target.role != null && ACTIVATABLE_ROLES.has(target.role);
}

export function resolveShortcut(
  key: ShortcutKey,
  context: ShortcutContext,
): ShortcutAction | null {
  if (!context.active) return null;
  if (key.ctrlKey || key.metaKey || key.altKey || key.repeat) return null;
  if (key.target?.insideNoShortcuts) return null;
  if (isTextEntry(key.target)) return null;

  if (key.key === " " || key.code === "Space") {
    if (isActivatable(key.target)) return null;
    if (context.playing ? !context.pauseEnabled : !context.playEnabled)
      return null;
    return { kind: "toggle-playback" };
  }

  const letter = key.key.length === 1 ? key.key.toUpperCase() : "";
  if (letter === "A" || letter === "B" || letter === "X") {
    return context.selectEnabled ? { kind: "select", label: letter } : null;
  }

  const digit =
    key.key === "1" || key.code === "Digit1" || key.code === "Numpad1"
      ? "A"
      : key.key === "2" || key.code === "Digit2" || key.code === "Numpad2"
        ? "B"
        : null;
  if (digit !== null) {
    return context.answerEnabled ? { kind: "answer", answer: digit } : null;
  }
  return null;
}

function describeTarget(target: EventTarget | null): ShortcutTarget | null {
  if (!(target instanceof HTMLElement)) return null;
  return {
    tagName: target.tagName,
    ...(target instanceof HTMLInputElement ? { type: target.type } : {}),
    role: target.getAttribute("role"),
    isContentEditable: target.isContentEditable,
    insideNoShortcuts: target.closest("[data-no-shortcuts]") !== null,
  };
}

/** Window-level listener; the latest context and handler are read per key. */
export function useListeningShortcuts(
  context: ShortcutContext,
  onAction: (action: ShortcutAction) => void,
): void {
  const latest = useRef({ context, onAction });
  latest.current = { context, onAction };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const { context: current, onAction: handle } = latest.current;
      const dialogOpen = document.querySelector("dialog[open]") !== null;
      const action = resolveShortcut(
        {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          target: describeTarget(event.target),
        },
        { ...current, active: current.active && !dialogOpen },
      );
      if (action === null) return;
      event.preventDefault();
      handle(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export const SHORTCUTS_STORAGE_KEY = "audivane.shortcuts";

/** Stored "off" turns single-key shortcuts off (WCAG 2.1.4); anything else is on. */
export function parseShortcutsEnabled(stored: string | null): boolean {
  return stored !== "off";
}

function readShortcutsEnabled(): boolean {
  try {
    return parseShortcutsEnabled(window.localStorage.getItem(SHORTCUTS_STORAGE_KEY));
  } catch {
    return true;
  }
}

/** The listener's on/off choice for single-key shortcuts, kept per device. */
export function useShortcutsEnabled(): readonly [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabledState] = useState<boolean>(() =>
    typeof window === "undefined" ? true : readShortcutsEnabled(),
  );
  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  }, []);
  return [enabled, setEnabled] as const;
}
