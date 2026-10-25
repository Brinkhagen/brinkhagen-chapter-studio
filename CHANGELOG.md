# Changelog

## 0.4.0 — Controlled chapter workflows (2026-10-26)

- Adds selectable processing delays: 1.5, 3, 5 or custom 1–15 seconds, persisted in Chrome and enforced between chapters across navigation.
- Adds a narrow page-context TinyMCE bridge to write chapter text through the editor's own content and change APIs; refuses ambiguous editor instances.
- Removes the dangerous blind `Update` click when discovering the chapter editor.
- Attempts recognized custom date/time picker controls, verifies the rendered GMT+8 preview and pauses for guided manual confirmation when unsupported.
- Makes deletion pause at a verification checkpoint after a native confirmation, or before removal when Inkstone's Delete control cannot be identified. No click alone counts as a confirmed deletion.
- Expands automated unit tests for chapter pacing and TinyMCE editing.
- Adds a non-destructive Inkstone UI diagnostics button for identifying missing editor, timer and deletion controls without exposing chapter text.
- **Not yet live-validated** against a signed-in current Inkstone session; authors should test with a disposable chapter first.

## 0.3.3 — Movable floating window (2026-10-25)

- Drag the Chapter Studio header to move the floating panel anywhere within the browser viewport.
- Remembers the panel position through Chrome local storage, including tab or page navigation.
- Adds a one-click ↖ button to restore the default top-right position.
- Keeps the minimize button independent of the drag gesture, and clamps positions when the window changes size.

## 0.3.2 — Single-click replacement start (2026-10-25)

- After scanning, **Back up & replace matched chapters** starts the complete process with one confirmation.
- Captures all original chapter contents in Chrome before attempting the first replacement.
- Preserves optional external safety download and mandatory external backups for deletion.
- Stops automatically if any replacement file is too short, ambiguous, or fails read-back verification.

## 0.3.1 — Replace workflow repair (2026-10-25)

- Removed the separate manual export requirement that left **Replace** disabled after the backup pass.
- Automatically starts a safety backup download when a replacement is confirmed; keeps manual downloads available.
- Distinguished backup completion from actual replacement in the panel messages.
- After submitting each replacement, reopens the chapter and checks the stored title and body before counting it as finished.
- Kept stricter backup download and confirmation requirements for deletion.
- Added clear guidance to disable a separately installed legacy v0.2.2 extension.

## 0.3.0 — BRINKHAGEN edition (2026-10-25)

- Renamed extension to BRINKHAGEN Chapter Studio.
- Added custom burgundy/champagne book-and-star logo and browser icons.
- Added a branded GitHub repository cover illustration.
- Redesigned the floating control panel and added a BRINKHAGEN copyright footer.
- Added project documentation, GitHub branding assets, and CI checks.
- Preserved the state storage key, scheduling logic, and draft workflow from v0.2.2.

## 0.2.2 — Local timer corrections

- Corrected Inkstone Publish Timer date/time semantics: local browser clock is entered into the picker; GMT+8 is shown only for verification.
- Added manual verification safeguards for custom picker controls.

## 0.2.1 — Editor compatibility

- Recognized the Inkstone chapter title and TinyMCE editor iframe.
- Improved resuming when a blank chapter editor is already open.

## 0.2.0 — Delivery choices

- Added Save as Draft, Publish Now and scheduling flows.
