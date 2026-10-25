# BRINKHAGEN Chapter Studio

![BRINKHAGEN Chapter Studio](assets/github-banner.svg)

<p align="center"><img src="assets/logo.svg" width="96" alt="BRINKHAGEN Chapter Studio logo"></p>

<p align="center"><strong>Professional chapter management for WebNovel Inkstone.</strong><br>Import. Organize. Schedule. Publish.</p>

**BRINKHAGEN Chapter Studio** is a Chrome extension that helps authors manage Markdown chapter uploads, draft queues, scheduled releases and published chapter revisions from one workspace.

## Features

| Workflow | Capabilities |
| --- | --- |
| **Markdown Import** | Import multiple numbered `.md` chapters, automatically ordered by chapter number. |
| **Draft Management** | Save imported chapters as unpublished drafts. |
| **Publication** | Publish immediately or prepare releases through the Inkstone Publish Timer. |
| **Release Planner** | Set a start date, chapters per day and daily publishing times. Export a CSV schedule. |
| **Chapter Editing** | Match existing chapter numbers with local Markdown files before applying replacements. |
| **Backup & Recovery** | Capture original chapter data and download backups before editing or deleting. |
| **Session Continuity** | Store imported chapters and queue progress locally in Chrome; resume a paused workflow. |

## Installation

1. Download and extract `BRINKHAGEN_Chapter_Studio_v0.3.0.zip` into a permanent folder on your computer.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted `inkstone-uploader-pro` folder containing `manifest.json`.
5. Open your WebNovel Inkstone chapter management page. The **Chapter Studio** panel appears automatically.

**Updating from an earlier version:** Copy the new files into the same extension folder, reload the extension in `chrome://extensions`, then refresh the Inkstone tab. The Chrome storage key remains unchanged, so imported files and settings stay available in the same browser profile.

## Chapter filenames

Use clear sequential names:

```text
CH01 - The Awakening.md
CH02 - The Storm.md
Chapter 003 - A New Rule.md
```

The chapter number determines processing order and matches existing chapter records. The filename without `.md` becomes the chapter title; a matching first Markdown heading is removed from the body.

## Publishing workflows

### Save as Draft

1. Open the appropriate novel in Inkstone and choose **Upload** in Chapter Studio.
2. Import one or more `.md` files.
3. Select **Save as Draft** and start the import.
4. Review the resulting drafts in Inkstone.

### Publish immediately

Select **Publish Now** when the imported chapters are approved for immediate release. Check the novel and chapter sequence before starting.

### Schedule a release plan

1. Select **Schedule — Publish Timer**.
2. Choose the first publication date, chapters per day and the local Berlin times.
3. Review the generated preview and optionally export the plan as CSV.
4. Confirm the date and time in Inkstone when prompted; the extension can pause for manual verification of custom calendar controls.

Default example for four chapters per day:

```text
Start date: 2026-10-26
Chapters/day: 4
Release times: 08:00, 12:00, 16:00, 20:00
Timezone: Europe/Berlin
```

Inkstone's Publish Timer accepts **local browser time** and displays its automatically converted GMT+8 value. For example, `2026-10-26 08:00` Berlin time is shown as `2026-10-26 15:00 GMT+8` in the converted preview. Enter the Berlin time in the picker, not the converted GMT+8 time.

### Replace or delete chapters

For existing chapters, use the guided workflow:

1. Open the relevant chapter list.
2. Import the target `.md` files or select visible chapters for deletion.
3. **Scan** and verify exact chapter-number matches.
4. **Capture original chapters**, then **Download backup JSON**.
5. Apply the requested changes after checking the backup and confirmation screen.

Chapter matching is intentionally strict. Missing or duplicate chapter numbers stop the operation rather than risking changes to the wrong chapter. Scanning covers the visible list, so check pagination when working with large novels.

## Development

```bash
node --check src/core.js
node --check src/content.js
node --test tests/core.test.cjs tests/branding.test.cjs
```

The project uses Chrome Manifest V3 with JavaScript and CSS; it does not require a build step or a separate server.

```text
assets/                 Logo, icon files and GitHub banner
src/core.js             Chapter parsing, matching and release planning
src/content.js          Inkstone workflow and panel logic
src/panel.css           BRINKHAGEN visual theme
tests/                  Automated logic and branding checks
.github/workflows/       Continuous integration
manifest.json           Chrome extension manifest
CHANGELOG.md            Version history
```

---

<p align="center">© 2026 <strong>BRINKHAGEN</strong> · All rights reserved.</p>
