import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_SOURCE_REPOSITORY_URL,
  DEMO_SOURCE_OFFER_PATH,
  SOURCE_OFFER_LABEL,
  WEBSITE_DEMO_BASE,
  sourceOfferLink,
} from "../src/source-offer.js";

test("sourceOfferLink points to /sources/ only for the hosted /abx/demo/ browser build", () => {
  assert.equal(WEBSITE_DEMO_BASE, "/abx/demo/");
  assert.deepEqual(
    sourceOfferLink({ desktop: false, baseUrl: "/abx/demo/" }),
    {
      href: DEMO_SOURCE_OFFER_PATH,
      label: SOURCE_OFFER_LABEL,
      external: false,
    },
  );
  assert.deepEqual(
    sourceOfferLink({ desktop: false, baseUrl: "/demo/" }),
    {
      href: DEFAULT_SOURCE_REPOSITORY_URL,
      label: SOURCE_OFFER_LABEL,
      external: true,
    },
  );
  assert.deepEqual(
    sourceOfferLink({ desktop: false, baseUrl: "/" }),
    {
      href: DEFAULT_SOURCE_REPOSITORY_URL,
      label: SOURCE_OFFER_LABEL,
      external: true,
    },
  );
  assert.deepEqual(
    sourceOfferLink({ desktop: true, baseUrl: "/abx/demo/" }),
    {
      href: DEFAULT_SOURCE_REPOSITORY_URL,
      label: SOURCE_OFFER_LABEL,
      external: true,
    },
  );
  assert.deepEqual(
    sourceOfferLink({ desktop: true, baseUrl: "/" }),
    {
      href: DEFAULT_SOURCE_REPOSITORY_URL,
      label: SOURCE_OFFER_LABEL,
      external: true,
    },
  );
});

test("App renders the visible AGPL-3.0 source offer link in the page footer and the About panel", async () => {
  const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(source, /sourceOfferLink\(\{\s*desktop,\s*baseUrl:\s*import\.meta\.env\.BASE_URL,?\s*\}\)/);
  // The in-flow footer at the end of every view keeps the offer visible
  // without opening anything; the About and diagnostics dialog repeats it.
  assert.match(source, /<footer className="app-footer">[\s\S]*<a[\s\S]*href=\{sourceOffer\.href\}[\s\S]*\{sourceOffer\.label\}[\s\S]*<\/footer>/);
  assert.match(source, /about=\{[\s\S]*\{sourceOffer\.label\}[\s\S]*<CapabilitiesPanel/);
});
