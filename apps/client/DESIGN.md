# Audivane client

## Design contract

Guided mode. The approved reference is the November 2026 redesign mockup
(copper accent). The interface is a three-step flow — Setup, Listen, Results —
in one centred column. It is a presentation layer only: do not change the test
method, scoring, gating, preparation, evidence or export contracts to simplify
the UI.

Do not add explanatory copy for obvious controls or expose internal function
names, policy identifiers, hashes or raw JSON as ordinary page content. Do
not show greyed-out controls that cannot apply in the current state: hide
them, or keep them with a short visible explanation (the Setup lock banner,
the withheld-audio note in Results).

## Design system

### Themes

System, Light, Graphite and Midnight, chosen from the theme button's menu in
the top bar and stored in `localStorage["audivane.theme"]`. System follows
`prefers-color-scheme` and resolves to Light or Midnight. An unknown stored
value (including the retired `dark`) falls back to System; there is no
migration. The resolved skin is written to `html[data-theme]` before React
paints.

Background, panel, line, text and status values (`--bg`, `--panel`,
`--panel-2`, `--raised`, `--line`, `--line-strong`, `--fg`, `--muted`,
`--faint`, `--ok`, `--warn`, `--bad` and their `-soft` tints) are the DSP
app's skins (`dsp/app/src/styles/tokens.css`). Keep them in sync by copying
values, not by importing across repositories.

Light is warm paper, shared with the website and DSP: `--bg #f5f3ee`,
`--panel #fffdf9`, `--panel-2 #f0ece4`, warm greys for lines and text.

The accent is copper:

| Skin | `--accent` | `--accent-fg` |
| --- | --- | --- |
| Light | `#a9472a` | `#ffffff` |
| Graphite | `#e3875c` | `#1e1208` |
| Midnight | `#ef8a5e` | `#1a0e07` |

Contrast (WCAG 2.2 AA). Some shared values fail as small text or as a
control boundary, so the client adds AA-safe roles and uses them for text and
controls:

- `--subtle` replaces `--faint` for any text (Light `--faint` is 3.2–3.7:1).
  `--faint` is decoration only.
- `--accent-text` for accent-coloured small text (Light `#93391f`, 6.6:1 on
  `--bg`).
- `--ok-text`, `--warn-text`, `--bad-text` for status words (Light
  `#0e6c42`, `#85560f`, `#b4262b`; Graphite bad `#ff8a8d`; Midnight bad
  `#ff7378`), all ≥4.5:1 on panels and on their soft tints.
- `--control` (≥3:1 on panel, panel-2 and bg) for input, select, switch,
  tile and ghost-button borders; `--line-strong` (1.6–1.7:1) is never the
  only boundary of a control.
- `--focus` draws the 2px focus ring (accent text colour, ≥3:1).
- Graphite `--muted` is `#a3a8b1`, lifted from DSP's `#9a9fa8` so 12px muted
  text keeps 4.5:1 on `--raised` (the theme menu).
- Accent fills carry `--accent-fg` text: 5.8:1 (Light), 6.9:1 (Graphite),
  7.6:1 (Midnight).
- Disabled primary buttons turn neutral (`--panel-2` fill, `--subtle` text)
  instead of a faded accent.

### Typography

Base text is 15px Inter (400/500/600). Instrument Serif is for display
moments only: the big A/B/X letters, the trial heading ("Trial 3 of 8"), the
Results headline, big statistic numbers and the brand's "ABX". IBM Plex Mono
500 (shipped renamed as Audivane Mono Latin) is for numbers, times,
measurements and keyboard hints. All three are self-hosted Latin subsets in
`src/assets/fonts`; nothing is fetched at runtime. `npm run check:fonts`
verifies them against `third_party/fonts.json` (see
`docs/font-licensing.md`). Glyphs outside the Latin subsets (α, ✓, ✗, →)
fall back to system fonts.

### Layout and components

- Content column: `min(1180px, 100% − 2 × gutter)`, gutter 32px, 24px at
  ≤1000px, 16px at ≤720px.
- Cards: `--panel`, 1px `--line`, 14px radius, 20–22px padding. Card titles
  are 13px uppercase `--muted` with an optional right-aligned meta.
- Buttons: `primary` (accent fill), `ghost` (control border), `quiet` (text),
  `small`. The round transport button and A/B/X tiles use the accent when
  selected.
- Disclosures (`details.card.disclosure`) show a summary line with the current
  choices and a ▸/▾ marker.

## Page hierarchy

### Top bar

Left: brand mark, "Audivane" and "ABX" (serif, accent). On the website demo
the brand links home. Centre: the stepper, 1 Setup → 2 Listen → 3 Results.
Each step is a button with `data-state`:

- `current` (`aria-current="step"`), `done` (✓), `available`, or `locked`
  (`aria-disabled="true"`, a description saying why; clicks do nothing).
- Setup is always available and is done while a test holds it.
- Listen opens once something is preparing, staged, terminal or needs a
  retry; it is done when the run is terminal.
- Results opens once prepared audio or a run exists. During a running test it
  stays reachable for redacted exports and run management.

Right: "Local · nothing uploaded" badge (shortened, then hidden, on narrow
widths), the theme menu and the ⓘ About and diagnostics dialog. The dialog
holds the runtime, the source offer link and Runtime capabilities (codecs and
limits). Nothing is pinned to the page bottom; an in-flow footer at the end of
the column repeats "Source code (AGPL-3.0)".

### Session strip

Shown under the top bar while a test is preparing or held (any view): file,
A chain vs B chain, plan summary and output device, then either "Locked
during the test" with End test (running), "Preparing · setup locked"
(preparing), or the lifecycle chip (terminal), with View results when on
Setup. It keeps one row down to 720px (plan
and output drop out first). On phones it wraps: the file on its own line,
then the chains, then the End test row, whose height is reserved so the
player does not move when preparing turns into running.

### Setup

Two columns (main + 340px side) that collapse below 1000px.

- Source card: the file (name, format from the extension, size, and once
  prepared the delivered rate, channels and length) with Replace…; with no
  file, a drop zone that is also the file picker label. The file input is
  visually hidden but focusable (`#source-file`, "Audio file"). Formats and
  limits sit in a disclosure that contains exactly: “WAV, FLAC, MP3, AAC, M4A,
  Ogg and Opus.”
- "What are you comparing?": two side cards, A vs B, each with a big serif
  letter, the chain label, codec and bitrate selects per stage and
  "+ Add stage" up to the advertised limit (hidden at the limit).
- Advanced processing and diagnostics: collapsed card whose summary states
  the rate and preparation policy; it keeps the rate and manual policy
  selects, diagnostic artifact preparation, Cancel (only while preparing) and
  Reset (only when there is something to reset).
- Side column: Test plan (summary, readiness switch with About, Edit plan
  disclosure, validation and Apply plan when a run is configured), Output
  device (select, Refresh, chooser when exposed, Routing details), and
  Prepare test → with its hint or the reason it is blocked.
- Shared test links (`#a=opus-128&b=aac-256&trials=16&labels=blind`) fill the source-free setup on load and show
  a banner (summary, the sharer's file when included, unavailable codecs,
  Clear); the fragment is then removed. Nothing prepares or plays until the
  user picks a file and presses Prepare test. "Copy test link" sits under
  Prepare test; Results offers "Share this test".
- While a test holds the setup, a lock banner explains it; controls stay in
  place, disabled, and Replace becomes "Locked during the test".

### Listen

Max 900px wide.

- Head: "Trial N of M" (serif) with the reserved Correct/Incorrect slot, a
  one-line subline (readiness check or preparation message), "K of M
  answered" and a segmented bar (answered / current / pending only — never
  correctness) or a continuous bar above 40 trials. Segments stay on one
  row, shrinking from 30px inside a 420px slot. Cancel preparation
  replaces the count while preparing. Heights are reserved so the stage does
  not move between loading and the first trial.
- Stage status line, then the transport card (round play/pause, scrubber,
  times, loop chip and loop range), three A/B/X tiles with key hints and a
  Playing/Selected indicator on the selected tile, and "Is X A or B?" with
  two answer buttons. Next trial appears only when it applies.
- Key hints row, then Session details (plan, labels, readiness, gates,
  output, lifecycle) behind a disclosure.
- Terminal runs replace the player with the score, the per-trial ✓/✗ chips
  and View results.
- Not prepared: an empty state ("Prepare a test first", Back to Setup), never
  a disabled player. Cancelled or stopped preparation uses the same empty
  state with its own title and Retry prepare test.

Feedback during a run: the Correct/Incorrect slot after each answer, nothing
cumulative. Per-trial chips appear only once the run is terminal.

### Keyboard shortcuts

Space play/pause, A/B/X select, 1/2 answer X is A / X is B. Each fires only
when the matching on-screen control is enabled and calls the same controller
method. They never fire while typing in an input, select, textarea or
editable region, with Ctrl/Meta/Alt, on key repeat, while a dialog is open,
inside a menu (`data-no-shortcuts`) or when Listen is not the visible view.
Space on a focused button, link, summary, checkbox or slider keeps its native
activation. Shortcuts reveal nothing the screen does not already show.

A "Keyboard shortcuts" checkbox under the Listen controls turns all
single-key shortcuts off (WCAG 2.1.4). The choice is kept per device in
`localStorage` (`audivane.shortcuts`); the key hints on the tiles, answer
buttons and hint row are hidden while shortcuts are off.

### Results

- Kicker (lifecycle · trial count) and the serif verdict from the existing
  wording (`resultHeading`), then a plain-language explanation derived from
  the computed exact one-sided p-value and α (`listening/explanation.ts`):
  a non-significant result never proves the sides identical, a significant
  one is evidence from this run and not a certification, and ended-early,
  void, failed-check and running runs draw no verdict.
- Kicker colour and dot distinguish completed, ended early (warn), void and
  failed checks (bad) and in progress (muted), always with words.
- Per-trial chips (terminal only), the stats card (Correct, Accuracy,
  p-value (one-sided), 95% confidence interval), preparation disclosure and
  gate reasons.
- Listen to each side: A and B cards with the big letter, chain and delivered
  format, a labelled player (the side letter is on the player; buttons read
  Preview/Play/Pause A or B; one side plays at a time) and Download WAV A/B.
  While a run is active the players and downloads are withheld with a note,
  exactly where they were disabled before. Measurements row (loudness A/B,
  loudness difference, peak A/B, timing difference, null depth) and Files and
  diagnostics (canary material).
- Test details disclosure, then actions: Download results (primary), Run
  again with the same setup (the existing run reset), New test (the existing
  close), and Clear prepared audio when no run holds the audio.
- With prepared audio but no run, Results says so and offers Prepare test.

## Responsive behaviour

Works from 1440 down to 800px (desktop minimum) and on phones (320px without
horizontal overflow). At ≤720px the stepper moves to its own row, A vs B and
Results cards stack, tiles shrink and answers stay side by side. Disclosures
grow in normal flow; nothing animates layout or scrolls automatically.

## Behavior and accessibility

Prepare test performs aligned preparation, exact-pair binding and paused
staging. It never autoplays. Reset clears the run and stages trial 1 paused
in one command. Readiness remains an explicit opt-in. The first trial selects
X. Between trials, previous audio can continue while no new label is
selected; answers remain disabled until the new trial is ready and selected.
Pause stays available.

Use semantic headings, native controls, accessible names, visible keyboard
focus, polite announcements (answer status, stage status) and alert roles for
actionable failures. Colour is always paired with text. Preserve stable
control IDs used by keyboard flows and tests (`source-file`, `codec-a`,
`bitrate-b-2`, `plan-trials`, `canary-enabled`, `rate-mode`,
`preparation-policy`, the `#setup-view`, `#listen-view` and `#evidence-view`
sections). Respect reduced motion.

## Component ownership

- `App.tsx`: runtime/workflow orchestration and Setup/Listen/Results
  composition, stepper state and the session strip inputs.
- `workspace/TopBar.tsx`: brand, stepper, local badge, theme menu and the
  About and diagnostics dialog.
- `workspace/ThemeSwitcher.tsx`: theme preference, resolution and menu.
- `workspace/SessionStrip.tsx`: the run's fixed setup and End test.
- `workspace/OutputDevicePanel.tsx`: device selection and route facts.
- `setup/SourceCard.tsx`, `setup/StageEditor.tsx`, `setup/PlanCard.tsx`:
  Setup cards.
- `listening/ListeningSection.tsx`: Listen head, transport, tiles, answers,
  completion and the empty state.
- `listening/shortcuts.ts`: shortcut resolution and the window listener.
- `listening/useRunTally.ts`, `listening/TrialTally.tsx`: per-trial chips.
- `listening/RunRecord.tsx` and `listening/explanation.ts`: verdict,
  explanation, stats and Test details.
- `listening/RunActions.tsx`: Results actions.
- `share/ShareDialog.tsx`, `share/qr.ts`, `share/summary.ts`: the share
  dialog (link, QR code with the brand mark, PNG/SVG) and the setup summary.
  The link format lives in `@codec-abx/contracts`
  (`shared-test.ts`).
- `evidence/AudioComparison.tsx`: labelled A/B players, downloads,
  measurements and diagnostic files.
- `styles.css`: tokens, layout, components and responsive rules.

Keep component props limited to values actually consumed. Remove styles and
helpers when their final consumer disappears.

## Verification

Tests follow the current interface rather than requiring removed copy or
panels. Check numerical provenance and detailed reports through diagnostics
downloads; check run records through listening exports. `tests/ui/run-actions.ts`
reaches run management through Results. Keep coverage for the theme set,
keyboard shortcuts, labelled A/B players, the locked Listen step and its
empty state, paused staging, answer feedback, completion, and 320/800px
widths.
