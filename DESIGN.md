# Interface design

Audivane is a local audio comparison workbench. Make choosing a source,
configuring A/B and listening the primary path.

- Guide the work through three steps — Setup, Listen, Results — in a
  stepper, in one centred column. A session strip shows the locked setup
  during and after a run; there is no permanent sidebar.
- **Prepare test** prepares, verifies and stages paused; **Play** is explicit.
- Put technical reports and exports in Results, runtime capabilities in the
  About and diagnostics dialog. Keep actionable errors, ambiguity and session
  locks visible.
- Offer persisted System, Light, Graphite and Midnight themes sharing the DSP
  app's colours and its blue accent. Use self-hosted Inter, Instrument Serif
  (display) and IBM Plex Mono (numbers).
- Don't show greyed-out controls that cannot apply; hide them or explain why.
- Preserve accessible names, contrast, focus indicators, keyboard use and
  reduced-motion behavior.

Scientific wording must distinguish validity from audibility. Early-ended,
sealed and completed runs must remain visibly distinct. See
[scientific policy](docs/methodology.md) for the behavioral constraints and
[the client design system](apps/client/DESIGN.md) for details.
