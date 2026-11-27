import { expect, test, type Page } from "@playwright/test";

async function chooseTheme(page: Page, label: "System" | "Light" | "Graphite" | "Midnight"): Promise<void> {
  await page.getByRole("button", { name: /^Theme: / }).click();
  await page.getByRole("radio", { name: new RegExp(`^${label}`) }).click();
}

test("System, Light, Graphite and Midnight persist; System follows the OS as Light or Graphite", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "graphite");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");

  for (const [label, theme] of [["Light", "light"], ["Graphite", "graphite"], ["Midnight", "midnight"]] as const) {
    await chooseTheme(page, label);
    await expect(html).toHaveAttribute("data-theme", theme);
    await expect(html).toHaveAttribute("data-theme-preference", theme);
    // A pointer choice closes the menu and returns focus to its button.
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Theme: ${label}` })).toBeFocused();
  }

  await chooseTheme(page, "Graphite");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "graphite");
  await expect(page.getByRole("button", { name: "Theme: Graphite" })).toBeVisible();

  await chooseTheme(page, "System");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "graphite");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("clicking an option's text, not just its radio, chooses the theme and closes the menu", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  for (const [label, theme] of [["Graphite", "graphite"], ["Midnight", "midnight"], ["Light", "light"]] as const) {
    await page.getByRole("button", { name: /^Theme: / }).click();
    await page.locator(".theme-menu").getByText(label, { exact: true }).click();
    await expect(html).toHaveAttribute("data-theme", theme);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Theme: ${label}` })).toBeFocused();
  }
  // The System row's helper text is part of the same option.
  await page.getByRole("button", { name: /^Theme: / }).click();
  await page.getByText("Light or Graphite").click();
  await expect(html).toHaveAttribute("data-theme-preference", "system");
  // A press inside the menu that is not an option leaves it open; Tab still closes it.
  await page.getByRole("button", { name: /^Theme: / }).click();
  await page.locator(".theme-menu legend").click();
  await expect(page.getByRole("radio")).toHaveCount(4);
  await page.getByRole("radio", { name: /^System/ }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("radio")).toHaveCount(0);
});

test("an unknown stored theme, including the retired Dark value, falls back to System", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("audivane.theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await expect(page.getByRole("button", { name: "Theme: System" })).toBeVisible();
});

test("under the website's header, the site's theme switch drives ABX and replaces its control", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  // The website marks <html> and sets its container width and gutter.
  const markShell = (): Promise<void> =>
    page.evaluate(() => {
      const root = document.documentElement;
      root.setAttribute("data-site-shell", "");
      root.style.setProperty("--site-shell-max", "1328px");
      root.style.setProperty("--site-shell-gutter", "40px");
      root.style.setProperty("--site-shell-h", "72px");
    });
  await markShell();
  const html = page.locator("html");
  await expect(page.getByRole("button", { name: /^Theme: / })).toBeHidden();
  await expect(page.locator(".topbar .brand")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Workspace steps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "About and diagnostics" })).toBeVisible();
  await expect(page.locator(".topbar")).toContainText("Local, nothing uploaded");
  const dispatch = (value: string): Promise<void> =>
    page.evaluate((detail) => {
      localStorage.setItem("audivane.theme", detail);
      window.dispatchEvent(new CustomEvent("audivane:theme", { detail }));
    }, value);
  await dispatch("graphite");
  await expect(html).toHaveAttribute("data-theme", "graphite");
  await dispatch("system");
  await expect(html).toHaveAttribute("data-theme-preference", "system");
  await expect(html).toHaveAttribute("data-theme", "light");
  await dispatch("sepia");
  await expect(html).toHaveAttribute("data-theme-preference", "system");
  await page.reload();
  await markShell();
  await dispatch("light");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-theme-preference", "light");
});

test("the theme menu works by keyboard: arrows choose, Escape closes and restores focus", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const button = page.getByRole("button", { name: "Theme: System" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("radio", { name: /^System/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Theme: Graphite" })).toBeFocused();
});

for (const shell of [true, false]) {
  test(`at 320px the steps never cover the About button (${shell ? "under the site header" : "standalone"})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    if (shell)
      await page.evaluate(() => {
        const root = document.documentElement;
        root.setAttribute("data-site-shell", "");
        root.style.setProperty("--site-shell-max", "1328px");
        root.style.setProperty("--site-shell-gutter", "16px");
        root.style.setProperty("--site-shell-h", "64px");
      });
    const about = page.getByRole("button", { name: "About and diagnostics" });
    const aboutBox = (await about.boundingBox())!;
    for (const name of ["Setup", "Listen", "Results"]) {
      const step = page.getByRole("button", { name, exact: true });
      await expect(step).toBeVisible();
      const box = (await step.boundingBox())!;
      const overlaps = box.x < aboutBox.x + aboutBox.width && aboutBox.x < box.x + box.width
        && box.y < aboutBox.y + aboutBox.height && aboutBox.y < box.y + box.height;
      expect(overlaps, `${name} overlaps About`).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await about.click();
    await expect(page.getByRole("dialog", { name: "About and diagnostics" })).toBeVisible();
  });
}

test("About and diagnostics holds runtime capabilities and the source offer, and restores focus", async ({ page }) => {
  await page.goto("/");
  const about = page.getByRole("button", { name: "About and diagnostics" });
  const dialog = page.getByRole("dialog", { name: "About and diagnostics" });
  await expect(dialog).toBeHidden();
  await about.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#capabilities-heading")).toHaveText("Runtime capabilities");
  await expect(dialog.getByText("Codecs and limits")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Source code (AGPL-3.0)" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(about).toBeFocused();
  // The page itself keeps a visible source offer outside the dialog.
  await expect(page.getByRole("link", { name: "Source code (AGPL-3.0)" })).toBeVisible();
});

for (const width of [320, 800]) {
  test(`${width}px keeps the stepper, setup and footer without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const name of ["Setup", "Listen", "Results"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Prepare test", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Output device" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
