import assert from "node:assert/strict";
import test from "node:test";

import type { ExperimentSnapshot } from "@codec-abx/contracts";
import { oneTailedPValue } from "@codec-abx/experiment";

import {
  describeChance,
  resultExplanation,
  resultHeading,
  resultKicker,
} from "../src/listening/explanation.js";
import {
  isActivatable,
  isTextEntry,
  parseShortcutsEnabled,
  resolveShortcut,
  type ShortcutContext,
  type ShortcutKey,
} from "../src/listening/shortcuts.js";
import {
  THEME_PREFERENCES,
  parseThemePreference,
  resolveTheme,
} from "../src/workspace/ThemeSwitcher.js";

// --- Themes ---------------------------------------------------------------

test("the theme set is System, Light, Graphite and Midnight; System resolves to Light or Midnight", () => {
  assert.deepEqual([...THEME_PREFERENCES], ["system", "light", "graphite", "midnight"]);
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("system", true), "midnight");
  assert.equal(resolveTheme("graphite", false), "graphite");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("midnight", false), "midnight");
});

test("unknown stored theme values, including the retired dark, fall back to System", () => {
  for (const stored of ["dark", "", "Light", "sepia", null]) {
    assert.equal(parseThemePreference(stored), "system", String(stored));
  }
  for (const stored of THEME_PREFERENCES) assert.equal(parseThemePreference(stored), stored);
});

// --- Keyboard shortcuts ---------------------------------------------------

test("single-key shortcuts default on and only a stored off turns them off", () => {
  assert.equal(parseShortcutsEnabled(null), true);
  assert.equal(parseShortcutsEnabled("on"), true);
  assert.equal(parseShortcutsEnabled("garbage"), true);
  assert.equal(parseShortcutsEnabled("off"), false);
});

const body = { tagName: "BODY" } as const;

function key(value: string, overrides: Partial<ShortcutKey> = {}): ShortcutKey {
  return {
    key: value,
    code: value === " " ? "Space" : value.length === 1 && /\d/.test(value) ? `Digit${value}` : `Key${value.toUpperCase()}`,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    target: body,
    ...overrides,
  };
}

const ready: ShortcutContext = {
  active: true,
  playing: false,
  playEnabled: true,
  pauseEnabled: false,
  selectEnabled: true,
  answerEnabled: true,
};

test("Space toggles playback, A/B/X select and 1/2 answer when their controls are enabled", () => {
  assert.deepEqual(resolveShortcut(key(" "), ready), { kind: "toggle-playback" });
  assert.deepEqual(resolveShortcut(key(" "), { ...ready, playing: true, pauseEnabled: true }), { kind: "toggle-playback" });
  for (const label of ["A", "B", "X"] as const) {
    assert.deepEqual(resolveShortcut(key(label.toLowerCase()), ready), { kind: "select", label });
    assert.deepEqual(resolveShortcut(key(label), ready), { kind: "select", label });
  }
  assert.deepEqual(resolveShortcut(key("1"), ready), { kind: "answer", answer: "A" });
  assert.deepEqual(resolveShortcut(key("2"), ready), { kind: "answer", answer: "B" });
  // Layouts where the digit needs Shift still report the physical key.
  assert.deepEqual(resolveShortcut(key("&", { code: "Digit1" }), ready), { kind: "answer", answer: "A" });
  assert.deepEqual(resolveShortcut(key("2", { code: "Numpad2" }), ready), { kind: "answer", answer: "B" });
  assert.equal(resolveShortcut(key("c"), ready), null);
  assert.equal(resolveShortcut(key("3"), ready), null);
});

test("every disabled state blocks its shortcut", () => {
  assert.equal(resolveShortcut(key(" "), { ...ready, playEnabled: false }), null);
  assert.equal(resolveShortcut(key(" "), { ...ready, playing: true, pauseEnabled: false }), null);
  assert.equal(resolveShortcut(key("x"), { ...ready, selectEnabled: false }), null);
  assert.equal(resolveShortcut(key("1"), { ...ready, answerEnabled: false }), null);
  assert.equal(resolveShortcut(key("2"), { ...ready, answerEnabled: false }), null);
  // Outside the visible Listen view, or with a dialog open, nothing fires.
  for (const value of [" ", "a", "x", "1"]) {
    assert.equal(resolveShortcut(key(value), { ...ready, active: false }), null, value);
  }
});

test("typing, modifiers, key repeat and menus never trigger shortcuts", () => {
  const typingTargets = [
    { tagName: "INPUT", type: "number" },
    { tagName: "INPUT", type: "text" },
    { tagName: "INPUT" },
    { tagName: "TEXTAREA" },
    { tagName: "SELECT" },
    { tagName: "DIV", isContentEditable: true },
  ];
  for (const target of typingTargets) {
    assert.equal(isTextEntry(target), true, JSON.stringify(target));
    for (const value of [" ", "a", "x", "1", "2"]) {
      assert.equal(resolveShortcut(key(value, { target }), ready), null, `${value} in ${JSON.stringify(target)}`);
    }
  }
  for (const modifier of ["ctrlKey", "metaKey", "altKey"] as const) {
    assert.equal(resolveShortcut(key("x", { [modifier]: true }), ready), null, modifier);
    assert.equal(resolveShortcut(key("1", { [modifier]: true }), ready), null, modifier);
  }
  assert.equal(resolveShortcut(key("1", { repeat: true }), ready), null);
  assert.equal(resolveShortcut(key(" ", { repeat: true }), ready), null);
  assert.equal(resolveShortcut(key("b", { target: { tagName: "INPUT", type: "radio", insideNoShortcuts: true } }), ready), null);
});

test("Space on a focused button keeps the button's own activation; letters still work there", () => {
  for (const target of [
    { tagName: "BUTTON" },
    { tagName: "A" },
    { tagName: "SUMMARY" },
    { tagName: "INPUT", type: "checkbox" },
    { tagName: "INPUT", type: "range" },
    { tagName: "DIV", role: "switch" },
  ]) {
    assert.equal(isActivatable(target), true, JSON.stringify(target));
    assert.equal(resolveShortcut(key(" ", { target }), ready), null, JSON.stringify(target));
  }
  assert.deepEqual(resolveShortcut(key("x", { target: { tagName: "BUTTON" } }), ready), { kind: "select", label: "X" });
  assert.deepEqual(resolveShortcut(key("1", { target: { tagName: "BUTTON" } }), ready), { kind: "answer", answer: "A" });
});

// --- Result explanation ---------------------------------------------------

function snapshot(options: {
  readonly correct: number;
  readonly scored: number;
  readonly planned: number | null;
  readonly alpha?: number;
  readonly lifecycle?: ExperimentSnapshot["lifecycle"];
  readonly isFinal?: boolean;
  readonly significant?: boolean;
  readonly gates?: Partial<ExperimentSnapshot["gates"]>;
  readonly calibrationEnabled?: boolean;
}): ExperimentSnapshot {
  const pValue = oneTailedPValue(options.scored, options.correct);
  const alpha = options.alpha ?? 0.05;
  const isFinal = options.isFinal ?? options.scored === options.planned;
  return {
    lifecycle: options.lifecycle ?? (isFinal ? "completed" : "running"),
    plan: {
      version: 1,
      plannedTrials: options.planned,
      alpha,
      labelMode: "blind_random",
      calibrationEnabled: options.calibrationEnabled ?? false,
    },
    statistics: {
      scoredTrials: options.scored,
      correctTrials: options.correct,
      plannedTrials: options.planned,
      requiredCorrect: null,
      pValue,
      ability: null,
      abilityCi95: [0, 1],
      significant: pValue < alpha,
      isFinal,
      significantVerdict: options.significant ?? (isFinal && pValue < alpha),
    },
    gates: {
      nullStatus: "not-applicable",
      preparationStatus: "passed",
      preparationClassification: null,
      preparationReason: null,
      preparationDisclosure: null,
      calibrationStatus: "not-configured",
      reasons: [],
      ...options.gates,
    },
  } as unknown as ExperimentSnapshot;
}

test("the chance wording is derived from the computed p-value", () => {
  assert.equal(describeChance(0.36328125), "about 36% of the time");
  assert.equal(describeChance(0.035), "about 3.5% of the time");
  assert.equal(describeChance(0.00390625), "about 0.39% of the time");
  assert.equal(describeChance(0.00001), "less than 0.01% of the time");
  assert.equal(describeChance(1), "every time or nearly so");
});

test("a non-significant final result shows only its heading", () => {
  const value = snapshot({ correct: 5, scored: 8, planned: 8 });
  assert.equal(resultHeading(value), "No significant difference detected");
  assert.equal(resultKicker(value), "Test complete · 8 of 8 trials");
  assert.equal(resultExplanation(value), "");
});

test("a significant final result is evidence from this run, not a certification", () => {
  const value = snapshot({ correct: 8, scored: 8, planned: 8 });
  assert.equal(resultHeading(value), "Significant difference detected");
  const text = resultExplanation(value);
  assert.match(text, /^You got 8 of 8 right\. Guessing alone scores 8 or more about 0\.39% of the time\. That is below your planned threshold of α 0\.05/);
  assert.match(text, /not a certification/);
  assert.doesNotMatch(text, /identical|told the sides apart|weak evidence/);
});

test("a significant result at a lenient α does not claim the listener told the sides apart", () => {
  // 4 of 8 has p = 0.63671875: "significant" only because α 0.9 was planned.
  const text = resultExplanation(snapshot({ correct: 4, scored: 8, planned: 8, alpha: 0.9, significant: true }));
  assert.match(text, /about 64% of the time\. That is below your planned threshold of α 0\.9/);
  assert.match(text, /weak evidence/);
  assert.doesNotMatch(text, /unlikely to be guessing|told the sides apart/);
});

test("ended-early, void, failed-check and running runs never read as a verdict", () => {
  const sealed = snapshot({ correct: 3, scored: 3, planned: 8, lifecycle: "sealed", isFinal: false });
  assert.equal(resultHeading(sealed), "Test ended early");
  assert.equal(resultKicker(sealed), "Ended early · 3 of 8 trials");
  assert.match(resultExplanation(sealed), /not a final result and no verdict is drawn/);
  assert.doesNotMatch(resultExplanation(sealed), /Guessing alone/);

  const voided = snapshot({ correct: 0, scored: 0, planned: 1, lifecycle: "void", isFinal: false, calibrationEnabled: true, gates: { calibrationStatus: "failed" } });
  assert.equal(resultHeading(voided), "Test checks failed");
  assert.match(resultExplanation(voided), /no valid result/);

  const voidOnly = snapshot({ correct: 0, scored: 0, planned: 1, lifecycle: "void", isFinal: false });
  assert.equal(resultHeading(voidOnly), "Test invalid");
  assert.match(resultExplanation(voidOnly), /void and has no scored result/);

  const failed = snapshot({ correct: 8, scored: 8, planned: 8, gates: { nullStatus: "failed" } });
  assert.equal(resultHeading(failed), "Test checks failed");
  assert.doesNotMatch(resultExplanation(failed), /Guessing alone/);

  const running = snapshot({ correct: 2, scored: 2, planned: 8, isFinal: false });
  assert.equal(resultHeading(running), "Test in progress");
  assert.equal(resultKicker(running), "Test in progress · 2 of 8 trials answered");
  assert.match(resultExplanation(running), /decided only after every planned trial/);
  assert.doesNotMatch(resultExplanation(running), /Guessing alone/);
});
