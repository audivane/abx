import { useEffect, useId, useRef, useState, type JSX } from "react";

/** The stored choice. System resolves to Light or Midnight. */
export type ThemePreference = "system" | "light" | "graphite" | "midnight";
/** The applied skin, written to `html[data-theme]`. */
export type ResolvedTheme = "light" | "graphite" | "midnight";

export const THEME_STORAGE_KEY = "audivane.theme";
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "graphite",
  "midnight",
];

const LABELS: Readonly<Record<ThemePreference, string>> = {
  system: "System",
  light: "Light",
  graphite: "Graphite",
  midnight: "Midnight",
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

/**
 * Unknown stored values (including the retired "dark") fall back to System.
 * This is a pre-release prototype: no value is migrated.
 */
export function parseThemePreference(stored: string | null): ThemePreference {
  return isThemePreference(stored) ? stored : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemDark ? "midnight" : "light";
  return preference;
}

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/**
 * Apply the resolved theme before React paints. The attribute is the single
 * source of truth for the token sets and native control colour schemes.
 */
function applyTheme(preference: ThemePreference, systemDark: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preference, systemDark);
  root.dataset.themePreference = preference;
}

const initialPreference =
  typeof window === "undefined" ? "system" : readPreference();
if (typeof document !== "undefined")
  applyTheme(initialPreference, systemPrefersDark());

/**
 * System is the default and keeps following the OS while selected. Light,
 * Graphite and Midnight are explicit local preferences. Nothing here touches
 * zoom or audio.
 */
export function useThemePreference(): {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly setPreference: (next: ThemePreference) => void;
} {
  const [preference, setPreference] =
    useState<ThemePreference>(initialPreference);
  const [systemDark, setSystemDark] = useState<boolean>(
    typeof window === "undefined" ? false : systemPrefersDark(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let media: MediaQueryList;
    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }
    const onChange = (event: MediaQueryListEvent): void =>
      setSystemDark(event.matches);
    setSystemDark(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    // Older WebViews expose the deprecated listener API only.
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    applyTheme(preference, systemDark);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage may be unavailable in a private or locked-down context.
    }
  }, [preference, systemDark]);

  return {
    preference,
    resolved: resolveTheme(preference, systemDark),
    setPreference,
  };
}

function ThemeIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />
    </svg>
  );
}

/**
 * Icon button with a small menu of native radios. Arrow keys move between
 * options (native radio behaviour), Escape and outside clicks close the menu
 * and return focus to the button.
 */
export function ThemeSwitcher(props: {
  readonly preference: ThemePreference;
  readonly onChange: (next: ThemePreference) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ids = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // Set by a pointer press inside the control. Pressing an option's text (a
  // label, which cannot take focus) blurs the focused radio before the click
  // lands; without this the blur closed the menu and the click was lost.
  const pointerInside = useRef(false);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.focus();
    const onPointer = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div
      className="theme-control"
      ref={rootRef}
      onPointerDown={() => {
        pointerInside.current = true;
      }}
      onKeyDown={(event) => {
        pointerInside.current = false;
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }}
      onBlur={(event) => {
        if (pointerInside.current) return;
        if (open && !rootRef.current?.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <button
        type="button"
        ref={buttonRef}
        className="icon-button"
        aria-label={`Theme: ${LABELS[props.preference]}`}
        title="Theme"
        aria-expanded={open}
        aria-controls={`${ids}-menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <ThemeIcon />
      </button>
      {open ? (
        <fieldset className="theme-menu" id={`${ids}-menu`} data-no-shortcuts>
          <legend>Theme</legend>
          {THEME_PREFERENCES.map((value) => (
            <label key={value} className="theme-option">
              <input
                type="radio"
                name={`${ids}-theme`}
                value={value}
                checked={props.preference === value}
                onChange={() => props.onChange(value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                onClick={(event) => {
                  // A pointer click (not keyboard arrow navigation) confirms.
                  // A click forwarded from the label can report detail 0.
                  if (event.detail > 0 || pointerInside.current) {
                    pointerInside.current = false;
                    setOpen(false);
                    buttonRef.current?.focus();
                  }
                }}
              />
              <span>{LABELS[value]}</span>
              {value === "system" ? (
                <small>Light or Midnight</small>
              ) : null}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
