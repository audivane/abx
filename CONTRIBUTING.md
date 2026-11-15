# Contributing to Audivane ABX

Thanks for helping. Bug reports, codec findings, documentation fixes and pull
requests are all welcome.

## Reporting a problem

Open an [issue](https://github.com/audivane/abx/issues) with:

- what you did, what you expected and what happened;
- browser or desktop, with OS and version (and browser name);
- the source file's format, rate and length, plus the codec settings for both sides;
- if you can, the results download (it holds the preparation record).

Security problems: see [SECURITY.md](SECURITY.md) instead of opening an issue.

## Pull requests

1. For anything bigger than a small fix, open an issue first so we can agree
   on the approach.
2. Keep each pull request focused on one change, and update the docs it affects.
3. Run the quick checks before you push:

   ```sh
   npm ci
   npm run verify:quick
   ```

   [Development](docs/development.md) and the
   [verification workflow](docs/verification-workflow.md) cover desktop
   builds, native codecs and the full suites.

## Contributor License Agreement

Before your first pull request can be merged, you need to sign the
[Audivane Contributor License Agreement](CLA.md). The CLA bot comments on your
pull request; reply with the sentence it shows. You sign once per repository.

You keep the copyright in your work. The CLA lets the maintainer ship your
contribution under the project's AGPL-3.0-only license and, if needed, under
other licenses as well, so that Audivane can be dual-licensed. Every public
version that includes your work stays available under an open-source license.
