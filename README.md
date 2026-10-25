# BRINKHAGEN Chapter Studio — for Inkstone (v0.3.0)

![BRINKHAGEN Chapter Studio](assets/github-banner.svg)

**A BRINKHAGEN project.** Independently developed Chrome Manifest V3 extension for managing *your own* WebNovel Inkstone chapters. It is **not** an official WebNovel tool and does **not** contain or redistribute code from the public `Eisenheim-00/inkstone-uploader` project.

<img src="assets/logo.svg" width="92" alt="BRINKHAGEN Chapter Studio logo">

## Highlights

- Chapter import from individually numbered Markdown files (`.md`).
- Save as Draft (confirmed working in an author-account test), publish immediately, or prepare timed releases.
- Match existing chapters before replacement/deletion; back up the original chapter data first.
- Release planning for Berlin time, with a GMT+8 verification preview.
- Local Chrome storage for interrupted queues; no service-specific API keys required.
- Branded BRINKHAGEN interface and Chrome toolbar icon in burgundy and champagne.

**Version:** `0.3.0` · **Status:** technical preview · **Ownership:** © 2026 BRINKHAGEN. All rights reserved. See [NOTICE.md](NOTICE.md).

## Status and limitations (read before using)

- **Local source/package:** installable and syntax-tested. Chapter-number parsing and matching have automated unit tests.
- **Live Inkstone compatibility:** a user verified the **Save as Draft** flow. Replace, Delete, and automatic timing still lack complete signed-in end-to-end verification. The site may use different buttons or editor markup than the extension can recognize. A paused operation is safer than guessing.
- **Editor fix v0.2.1:** recognizes Inkstone's chapter title input and the TinyMCE rich-text area inside its iframe. Also recognizes an already open blank editor when resuming a stopped import. `Debug Editor` reports whether both fields are detected without changing chapter content.
- **Scheduling fix v0.2.2:** Inkstone's current Publish Timer dialog asks for **LOCAL date/time**, then converts automatically to GMT+8. Earlier versions incorrectly instructed users to enter GMT+8 values. Enter Berlin time in the dialog; the resulting red GMT+8 time is only a verification value.
- **Backup:** captures title, plain body, and (where applicable) original HTML from a published chapter editor, and exports them to a JSON file. The backup is not an official WebNovel export format.
- **Replace:** attempts to update published chapters using the existing Inkstone editor's `Update`/`Save` actions. Each chapter requires unique chapter number matching and an unchanged existing body after backup. Updates are submitted but not independently verified by a second WebNovel fetch.
- **Delete:** attempts to use an explicitly labeled chapter-delete button and confirmation dialog, only after backing up every target. Whether Inkstone exposes that control for your chapter type must be checked on your account. **Do not use this mode with contracted/premium chapters without confirming platform rules.**
- **Upload:** supports fill-only and attempted auto-publish. Site-specific navigation/confirmation must be tested. For reliable live bulk uploading today, your existing uploader may remain preferable.
- **Upload delivery modes:** Save as Draft, Publish Now, and Schedule via Inkstone Publish Timer. Draft saving has been confirmed on a live account; the other actions need further testing with your Inkstone UI.
- **Scheduling:** generate and export a CSV plan using release times in `Europe/Berlin`, converted to Inkstone's documented `GMT+8` publishing clock. German summer/winter time is handled, including a deliberate rejection of ambiguous/nonexistent times during the clock change.
- **Scheduled publication confirmations:** custom site date/time picker controls cannot safely be assumed to accept programmatically typed values. The extension pauses for manual confirmation if it cannot verify standard native fields; even when the fields visually match, automated final confirmation is **off by default**. Batch scheduling may therefore need some manual steps until live-tested.
- **Only visible titles are scanned.** If your Published list has multiple pages or virtual scrolling, expose all desired chapter rows before scanning, or process a smaller batch. Missing or duplicate chapter numbers block Replace/Delete.
- A browser restart is designed to pause active work rather than silently continue publishing or deleting. You can use Resume only after checking the current WebNovel screen.
- The extension keeps imported text and backups in your local Chrome profile, not on our servers. **Clear local queue** removes those copies from extension storage.

## Install on Windows Chrome

1. Unzip `BRINKHAGEN_Chapter_Studio_v0.3.0.zip` to a **permanent folder** such as `Documents\BRINKHAGEN-Chapter-Studio`. Do not load the ZIP itself, and do not delete or move the extracted folder after installation.
2. Open `chrome://extensions` in Chrome.
3. Turn **Developer mode** on (top right).
4. Choose **Load unpacked** (German: *Entpackte Erweiterung laden*).
5. Select the extracted folder that **directly contains `manifest.json`**.
6. Open WebNovel Inkstone and a book's **Published** chapter list. The floating panel will appear on supported Inkstone pages.
7. If you have the older `Chapter Uploader` installed, disable it while testing PRO so the two floating panels do not interfere.

### Updating from the old PRO version

Unzip the updated files **over your existing extension folder**, then open `chrome://extensions`, click **Reload** on the extension, and reload your Inkstone tab. The local queue uses the same storage key, so branding does not reset your current settings or imported chapters. Before resuming a paused publication job, inspect the active editor and selected novel.

## File names

Accepts Markdown file names such as:

```text
CH01 - The Awakening.md
CH02 - The Storm.md
Chapter 003 - A New Rule.md
```

The leading `CH` / `Chapter` number identifies the published chapter. The **full filename without `.md`** becomes the title if replaced. A first Markdown heading like `# Chapter 01 - The Awakening` is omitted from the chapter body. Markdown is simplified to plain text and paragraphs. Markdown hyperlinks are converted to readable text with URLs.

## Safest Replace test

1. Prepare **one** Markdown file for a chapter you can safely modify.
2. In Inkstone, open the correct book, go to **Published**, and make sure the target chapter appears in the list.
3. Choose **Replace**, import the file, and click **Scan visible chapter list**.
4. Carefully inspect the matched existing chapter title and the filename. If matching is incomplete, stop.
5. Click **Capture original chapters**. This reads the original title and content. It should not change them.
6. Click **Download backup JSON** and verify that the file exists on your PC and contains the original chapter.
7. Click **Apply replacements** and confirm. If the extension pauses, inspect the screen; do not blindly retry a submitted update.
8. Open the published chapter as a reader and verify its title, paragraph breaks, complete text and Author's Note.
9. Only after this succeeds, try a small multi-chapter batch.

## Delete flow

You can import `.md` filenames to select individual deletion targets, **or** scan the Published list and click **Use ALL scanned chapters as delete targets**. That selects only the chapters currently visible in your list, not necessarily every chapter in the novel. Confirm that pagination and virtual scrolling did not hide additional chapters.

The same scan → backup → export steps are mandatory. Afterwards you must type **`DELETE N`** where `N` is the number of matched chapters, then confirm a final dialog. The extension refuses to delete if it sees a different chapter number or changed chapter body. Deleted chapters may be recoverable in Inkstone Trash for a limited period, but **do not rely on this as the only backup**.

## Upload flow

- Open the novel's chapter overview (recommended), or a blank chapter editor.
- Import your `.md` files, select **Upload**.
- Choose one delivery mode:
  - **Save as Draft**: attempt to fill and click Inkstone **Save/Save Draft**, then create the next chapter. Drafts should not be publicly visible. If Save is not recognized, the run pauses with text still in the editor.
  - **Publish Now**: click Publish, then Confirm. This can make chapters publicly visible immediately.
  - **Schedule**: set the first publishing date, number of chapters per day, and *exactly that many* local Berlin time slots (for example `08:00, 12:00, 16:00, 20:00`). Review the generated preview and export the schedule CSV before starting. The extension attempts to enable **Publish Timer** and fill **local Berlin** date/time. Inkstone displays the converted GMT+8 date/time below in red. If a custom date picker is detected, the extension pauses and tells you the precise LOCAL fields to select manually. Only after you have confirmed the chapter *in Inkstone* and checked that it appears scheduled should you choose **I confirmed; next**.
- `Fill first file only` copies the first file into the editor without saving or publishing; use this to test title/body selectors.
- The **BETA: Auto-confirm native timer dialogs** checkbox is off by default and should be used only after a successful test chapter. It still refuses to auto-confirm nonnative/ambiguous date-time controls.

### Example: 100 chapters at 4 per day

Choose **Schedule**, set `4` chapters/day, enter four Berlin times, and select the start date. The extension creates a 25-day plan and displays both German time and GMT+8 for each chapter. As soon as WebNovel accepts a scheduled chapter, the server manages its later release; this does not require leaving Chrome open until release time. **Chrome must stay open while the initial uploading/scheduling operation is running.**

### Scheduling time zones

Inkstone documentation and publisher guides describe a **GMT+8** clock for timers, but the live Inkstone dialog (observed October 2026) says its date/time input fields are based on the **user's local time** and are *automatically converted* to GMT+8. This extension plans from `Europe/Berlin`, puts BERLIN values in the picker, and displays GMT+8 purely for verification. Example for October 26, 2026:

| Where | Date | Time |
| --- | --- | --- |
| Inkstone picker (Berlin local) | `2026/10/26` | `08:00` |
| Red converted preview (GMT+8) | `2026-10-26` | `15:00` |

**Never enter `15:00` in the local picker for the example above**, since Inkstone would add the seven-hour timezone conversion again. Chrome must use Europe/Berlin as its local timezone for this scheduling workflow, and the extension refuses scheduling if it detects another timezone. The final red GMT+8 preview must match the planned converted value before confirmation.

## Stop, resume, troubleshoot

- Press **Pause** any time to stop automatic progression.
- `Resume` continues the last stored step; **first verify** that the current page is the expected book/chapter and no operation was already completed.
- If the panel is missing: reload the page, check `chrome://extensions`, and navigate to the Inkstone editor or Published list.
- If you see `Create Chapter button not found` while already on the blank editor, update to v0.2.1 and click **Debug Editor**. Both `title` and `body` should be detected; if not, share the diagnostic text so the selectors can be adjusted.
- If an editor or button is not detected, it pauses. Take a screenshot of the *relevant Inkstone UI* (hide private information) so selectors can be adjusted safely.
- Clear the queue only after exporting backups and finishing the task; it removes imported text, scan metadata, backups, and progress.

## Engineering notes

Chrome MV3 content script, no external network services, dependencies, remote code, or credentials. Source files are intentionally included. `src/core.js` holds the chapter parser/matcher and Markdown conversion for unit testing. The UI automation is intentionally conservative about unique matches, book IDs when available, existing-content changes, and save/delete button ambiguity.

**Not affiliated with WebNovel. Use on chapters you own or are authorized to manage. Test with one non-premium chapter before using in bulk.**

### Repository structure

```text
assets/             Brand logo, GitHub cover art, Chrome extension icons
src/core.js         Pure chapter parsing, matching, scheduling
src/content.js      Inkstone interactions and user interface
src/panel.css       BRINKHAGEN theme
tests/              Logic and optional browser smoke tests
manifest.json       Chrome Manifest V3
NOTICE.md           Copyright and non-affiliation notice
```

Run `node --test tests/core.test.cjs tests/branding.test.cjs` to execute the self-contained logic and branding tests. The optional UI smoke test requires a locally installed browser runtime and is not a substitute for signed-in Inkstone testing.
