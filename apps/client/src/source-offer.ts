export interface SourceOfferLink {
  readonly href: string;
  readonly label: string;
  readonly external: boolean;
}

export const DEFAULT_SOURCE_REPOSITORY_URL = "https://github.com/audivane/abx";
/** Base path of the hosted browser app on audivane.app (see tools/website-demo). */
export const WEBSITE_BASE = "/abx/";
export const DEMO_SOURCE_OFFER_PATH = "/sources/";
export const SOURCE_OFFER_LABEL = "Source code (AGPL-3.0)";

/** Returns the visible AGPL-3.0 corresponding-source target for the active build. */
export function sourceOfferLink(options: {
  readonly baseUrl: string;
}): SourceOfferLink {
  if (options.baseUrl === WEBSITE_BASE) {
    return {
      href: DEMO_SOURCE_OFFER_PATH,
      label: SOURCE_OFFER_LABEL,
      external: false,
    };
  }
  return {
    href: DEFAULT_SOURCE_REPOSITORY_URL,
    label: SOURCE_OFFER_LABEL,
    external: true,
  };
}
