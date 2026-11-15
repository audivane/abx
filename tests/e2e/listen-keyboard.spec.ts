import { expect, test, type Page } from "@playwright/test";

import {
  chooseWav,
  collectPageErrors,
  configure,
  expectNoRemoteOrUpload,
  guardNetwork,
  makePcm16Wav,
} from "./fixtures.js";

async function openApp(page: Page, origin: string) {
  const guard = await guardNetwork(page, origin);
  await page.goto(origin);
  await expect(page.locator("#codec-a option[value=opus]")).toBeEnabled({ timeout: 90_000 });
  return guard;
}

async function startTest(page: Page, trials: number): Promise<void> {
  await chooseWav(page, `keyboard-${trials}.wav`, makePcm16Wav({ sampleRate: 48_000, channels: 1, seconds: 0.8 }));
  await configure(page, { a: "noop_passthrough", b: "opus", bitrateB: 64 });
  await page.locator(".listening-test-plan > summary").click();
  await page.getByLabel("Planned scored trials N (1–1000)").fill(String(trials));
  await page.getByRole("button", { name: "Prepare test", exact: true }).click();
  await expect(page.locator(".listening-trial")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled({ timeout: 60_000 });
}

const tile = (page: Page, label: "A" | "B" | "X") =>
  page.getByRole("button", { name: `Monitor playback label ${label}` });

test("Space, A/B/X and 1/2 drive the same enabled controls and stay silent while typing, in dialogs or outside Listen", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const guard = await openApp(page, origin);
  const errors = collectPageErrors(page);
  await startTest(page, 3);

  // Focus is on the page, not on a control.
  await page.locator("#listening-heading").click();

  // A/B/X select the playback label, exactly like the tiles.
  await page.keyboard.press("a");
  await expect(tile(page, "A")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("B");
  await expect(tile(page, "B")).toHaveAttribute("aria-pressed", "true");
  await expect(tile(page, "A")).toHaveAttribute("aria-pressed", "false");

  // Space toggles playback through the transport's own enabled state.
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeEnabled();

  // Modifier chords never trigger a shortcut.
  await page.keyboard.press("Control+x");
  await expect(tile(page, "B")).toHaveAttribute("aria-pressed", "true");

  // Typing in a field never triggers a shortcut.
  await page.getByRole("button", { name: "Enable loop", exact: true }).click();
  const loopStart = page.getByLabel("Loop start (s)");
  await loopStart.focus();
  await page.keyboard.press("x");
  await page.keyboard.press("1");
  await expect(tile(page, "B")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Answer A", exact: true })).toBeEnabled();
  await expect(page.locator(".answer-status")).toBeEmpty();
  await page.getByRole("button", { name: "Disable loop", exact: true }).click();

  // An open dialog owns the keyboard.
  await page.getByRole("button", { name: "About and diagnostics" }).click();
  await page.keyboard.press("x");
  await page.keyboard.press("Escape");
  await expect(tile(page, "B")).toHaveAttribute("aria-pressed", "true");

  // Outside the Listen view nothing fires.
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.locator("#setup-view").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("x");
  await page.keyboard.press("2");
  await page.getByRole("button", { name: "Listen", exact: true }).click();
  await expect(tile(page, "B")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".answer-status")).toBeEmpty();

  // 1 answers once. The next trial needs an explicit pick before answers
  // re-enable, so an immediate 2 is ignored rather than answering it.
  await page.locator("#listening-heading").click();
  await page.keyboard.press("x");
  await expect(tile(page, "X")).toHaveAttribute("aria-pressed", "true");
  const firstToken = await page.locator(".listening-trial").getAttribute("data-token");
  await page.keyboard.press("1");
  await expect(page.locator(".answer-status")).toHaveText(/^(Correct|Incorrect)$/);
  await expect.poll(async () => page.locator(".listening-trial").getAttribute("data-token"), { timeout: 60_000 })
    .not.toBe(firstToken);
  await page.keyboard.press("2");
  await expect(page.locator(".progress-label")).toHaveText("1 of 3 answered");
  await expect(page.getByRole("button", { name: "Answer B", exact: true })).toBeDisabled();

  // The keyboard path finishes the run like the buttons.
  for (let index = 2; index <= 3; index += 1) {
    await expect(tile(page, "X")).toBeEnabled({ timeout: 60_000 });
    await page.keyboard.press("x");
    await expect(page.getByRole("button", { name: "Answer A", exact: true })).toBeEnabled();
    await page.keyboard.press("2");
    await expect(page.locator(".progress-label")).toHaveText(`${index} of 3 answered`, { timeout: 60_000 });
  }
  await expect(page.locator('.run-results[data-lifecycle="completed"]')).toBeVisible({ timeout: 60_000 });
  // Terminal: no shortcut hints and no way to answer again.
  await expect(page.locator(".key-hints")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Answer A", exact: true })).toHaveCount(0);

  expectNoRemoteOrUpload(guard);
  expect(errors).toEqual([]);
});

test("the Keyboard shortcuts switch turns every single-key shortcut off and remembers it", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const guard = await openApp(page, origin);
  const errors = collectPageErrors(page);
  await startTest(page, 2);

  const toggle = page.getByRole("checkbox", { name: "Keyboard shortcuts" });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.locator(".key-hint-list")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("audivane.shortcuts"))).toBe("off");

  await page.locator("#listening-heading").click();
  // A trial starts on X, so "a" is the visible test: it must not move off X.
  await page.keyboard.press("a");
  await expect(tile(page, "A")).toHaveAttribute("aria-pressed", "false");
  await expect(tile(page, "X")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#listening-heading").click();
  await page.keyboard.press("1");
  await expect(page.locator(".answer-status")).toBeEmpty();
  await expect(page.getByRole("button", { name: "Answer A", exact: true })).toBeEnabled();

  await toggle.check();
  await page.locator("#listening-heading").click();
  await page.keyboard.press("a");
  await expect(tile(page, "A")).toHaveAttribute("aria-pressed", "true");

  expectNoRemoteOrUpload(guard);
  expect(errors).toEqual([]);
});

test("completed Results label each unblinded player A or B on the player itself and play one side at a time", async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const guard = await openApp(page, origin);
  const errors = collectPageErrors(page);
  await startTest(page, 1);
  await tile(page, "X").click();
  await page.getByRole("button", { name: "Answer A", exact: true }).click();
  const done = page.locator('.run-results[data-lifecycle="completed"]');
  await expect(done).toBeVisible({ timeout: 60_000 });
  await done.getByRole("button", { name: /View results/ }).click();
  await expect(page.locator("#evidence-view")).toBeVisible();
  await expect(page.locator(".run-record .kicker")).toHaveText("Test complete · 1 of 1 trial");
  await expect(page.locator(".run-record .verdict-text")).toContainText(/You got [01] of 1 right/);

  const sideA = page.locator('.track-card[data-side="a"]');
  const sideB = page.locator('.track-card[data-side="b"]');
  await expect(sideA.locator(".player .player-side")).toHaveText("A");
  await expect(sideB.locator(".player .player-side")).toHaveText("B");
  await expect(sideA).toContainText("PCM16 passthrough");
  await expect(sideB).toContainText("Opus · 64 kbps");
  await expect(sideA.getByRole("button", { name: "Download WAV A" })).toBeEnabled();
  await expect(sideB.getByRole("button", { name: "Download WAV B" })).toBeEnabled();

  await sideA.getByRole("button", { name: "Preview A" }).click();
  const audioA = sideA.locator("audio");
  await expect(audioA).toHaveAttribute("aria-label", "Side A preview");
  await expect(audioA).toHaveAttribute("src", /^blob:/);
  await audioA.evaluate((element) => { (element as HTMLAudioElement).muted = true; });
  await expect(sideA.getByRole("button", { name: /^(Play|Pause) A$/ })).toBeVisible();

  await sideB.getByRole("button", { name: "Preview B" }).click();
  const audioB = sideB.locator("audio");
  await expect(audioB).toHaveAttribute("aria-label", "Side B preview");
  await audioB.evaluate(async (element) => {
    const media = element as HTMLAudioElement;
    media.muted = true;
    await media.play().catch(() => undefined);
  });
  // Starting B pauses A, so the two are never heard together.
  await expect.poll(() => audioA.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await expect(page.locator(".track-card audio")).toHaveCount(2);

  expectNoRemoteOrUpload(guard);
  expect(errors).toEqual([]);
});
