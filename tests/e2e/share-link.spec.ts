import { expect, test } from "@playwright/test";
import { encodeSharedTest, type SharedTest } from "@codec-abx/contracts";

import { chooseWav, makePcm16Wav } from "./fixtures.js";

test("opening a test link fills the setup, clears the address bar and never starts the test", async ({ page }) => {
  const wav = makePcm16Wav();
  const shared: SharedTest = {
    a: [{ codecId: "opus", bitrateKbps: 128 }],
    b: [{ codecId: "aac", bitrateKbps: 256 }, { codecId: "mp3", bitrateKbps: 320 }],
    sampleRateMode: "force_48k",
    canaryEnabled: false,
    plan: { version: 1, plannedTrials: 16, alpha: 0.01, labelMode: "fixed", calibrationEnabled: false },
    source: { title: "sharer.wav", durationSeconds: 3 },
  };
  await page.goto(`/#${encodeSharedTest(shared)}`);

  const banner = page.locator(".share-banner");
  await expect(banner).toContainText("Shared test: Opus 128 vs AAC 256 → MP3 320, 16 trials, fixed labels, 48 kHz");
  await expect(banner).toContainText("Sharer's file: sharer.wav (3.0 s)");
  expect(new URL(page.url()).hash).toBe("");

  await expect(page.locator("#codec-a")).toHaveValue("opus");
  await expect(page.locator("#bitrate-a")).toHaveValue("128");
  await expect(page.locator("#codec-b")).toHaveValue("aac");
  await expect(page.locator("#codec-b-2")).toHaveValue("mp3");
  await expect(page.locator("#bitrate-b-2")).toHaveValue("320");
  await expect(page.locator("#rate-mode")).toHaveValue("force_48k");
  await expect(page.locator("#plan-trials")).toHaveValue("16");
  await expect(page.locator("#plan-alpha")).toHaveValue("0.01");
  await expect(page.locator("#plan-label-mode")).toHaveValue("fixed");
  await expect(page.getByRole("button", { name: /^Prepare test/ })).toBeDisabled();

  await chooseWav(page, "mine.wav", wav);
  // Choosing a file still waits for an explicit Prepare test.
  await expect(page.locator("#setup-view")).toBeVisible();
  await expect(page.locator("#listen-view")).toBeHidden();

  await banner.getByRole("button", { name: "Clear" }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.locator("#codec-a")).toHaveValue("noop_passthrough");

  await page.goto("/#a=nope-1&b=opus-128&trials=8&labels=blind");
  await expect(page.getByRole("alert").filter({ hasText: "This test link could not be opened." })).toBeVisible();
});

test("sharing with the file name adds it to the link", async ({ page }) => {
  const wav = makePcm16Wav();
  await page.goto("/");
  await chooseWav(page, "mine.wav", wav);
  await page.getByRole("button", { name: "Copy test link" }).click();
  const link = page.getByRole("textbox", { name: "Test link" });
  await expect(link).toHaveValue(/#a=lossless&b=aac-128&/);
  await page.getByRole("checkbox", { name: /Include file name/ }).check();
  await expect(link).toHaveValue(/&file=mine\.wav$/);
});
