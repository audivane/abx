import { expect, type Page } from "@playwright/test";

/**
 * Run management belongs to Results. Open it through the stepper, click the
 * action, then return to the task view after a download or a restart.
 */
export async function clickRunAction(page: Page, name: string): Promise<void> {
  const previousView = await page.locator(".main-content > .view:not([hidden])").getAttribute("id");
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const hiddenAware = page.getByRole("button", { name, exact: true, includeHidden: true });
  await hiddenAware.evaluate(element => {
    const disclosure = element.closest("details");
    if (disclosure) disclosure.open = true;
  });
  await page.getByRole("button", { name, exact: true }).click();
  if (name === NEW_TEST) {
    // Closing the run returns the app to Setup by itself, and Listen locks.
    await expect(page.locator("#setup-view")).toBeVisible();
    return;
  }
  if (previousView !== "evidence-view" && await page.locator("#evidence-view").isVisible()) {
    const tab = previousView === "setup-view" ? "Setup" : "Listen";
    await page.getByRole("button", { name: tab, exact: true }).click();
  }
}

/** Results action that restarts the same run (the controller's reset). */
export const RUN_AGAIN = "Run again with the same setup";
/** Results action that closes the run and unlocks Setup. */
export const NEW_TEST = "New test";
