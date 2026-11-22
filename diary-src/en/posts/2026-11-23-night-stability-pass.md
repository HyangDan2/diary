---
title: "What Survives a Failure — Nine Projects, One Rule, One Night"
date: 2026-11-23T08:50:00+09:00
category: Devlog
summary: "From midday on November 22 into the early hours of the 23rd I worked through CodePlayground, SlideDeck, Lýra, DOS Player, Midpoint, CinePlate, FrameBuilder, the Markdown Editor and 青松館. The apps do different jobs, but the same three things broke: whether a save is announced as done, what happens to a response that arrives late, and what two tabs do to one workspace."
tags: [pkpilot, devlog, stability, indexeddb, qa]
lang: en
translationKey: devlog-night-stability-pass
layout: post
---

The run started on the afternoon of November 22 with a cleanup of CinePlate's filter windows and carried on through the night to 青松館 Phase 3. In about twenty hours I touched nine projects. Each one does something different, and yet the places that needed fixing were almost identical.

An app that runs in the browser has no server behind it. When a save fails, nobody tells you, and when the tab closes, the last few seconds disappear without a sound. Half of this pass was not about features at all. It was about making that quiet failure audible.

## What the night covered

| Project | What was fixed | What was checked |
| --- | --- | --- |
| CodePlayground (PKPilot0013) v2.2.0 | Git merge-conflict state, Python memory across runs, multi-tab conflicts | Vitest 158/158, live 12/12 |
| SlideDeck (PKPilot0014) | Note-save integrity, multi-tab revisions, save-status chip | Vitest 169/169, Playwright 76/76 |
| Lýra (PKPilot0019) | Ten audio-engine fixes, two-tier header and project drawer | Unit 130/130, live E2E 24/24 |
| DOS Player (PKPilot0006) v2.0.0 | 1,423 lines split into 15 modules, second QA round of 8 items | Unit 90/90, E2E 102/102 |
| Midpoint (PKPilot0002) | Theme toggle and legend sync, immediate 429 fallback, search queue | Unit 214/214 |
| CinePlate (PKPilot0011) | Dedicated windows for 58 margarine filters and 11 emblems, EXIF Auto, tone curve | Vitest 159/159, mobile E2E 3/3 |
| FrameBuilder (PKPilot0015) | Seven improvements, position-aware two-finger rotation | Vitest 148/148, Playwright 130/130 |
| Markdown Editor (PKPilot0007) | App shell matching 0008, general GitHub settings dialog | Local 25/25, live 7/7 |
| 青松館 (ADOP0001) | Phases 1–3: test generation, document conversion, code analysis | Vitest 124 → 147 → 184 |

## CodePlayground (PKPilot0013) v2.2.0 — Git and Python inside the browser

The app opens a VS Code-like screen in the browser and runs Git commands and Python for real. Because they really run, a single inconsistent state can wipe out everything you have made. This time I blocked the deleting side first.

- **Merge conflicts are treated as state.** `unmergedPaths` is tracked separately, and commits are blocked until every conflicted file is resolved and `git add`ed. Other staged files cannot be used to slip past an unresolved conflict, and once it is resolved the commit has two parents.
- **`merge --abort` returns to the pre-merge state.** It restores the staged, unstaged and untracked snapshots. `git rm` refuses when there are uncommitted changes (and proceeds with `-f`), while `git rm --cached` leaves the file on disk as untracked.
- **Running Python 120 times no longer grows the heap.** Each run clears its VFS temporary directory and calls `.destroy()` on the PyProxy. The measurement left 0 directories behind and grew the WASM heap by 0 MiB; before the fix, 120 runs added 4.8 MiB and left 125 directories.
- **Two tabs can open the same workspace.** `revision` and `updatedAt` are compared and a conflict card appears ("Save this tab / Load the other tab"). Older saved sessions without `mergeState` recover the conflict marker while keeping their untracked files.

Checks: clean `tsc`, Vitest 158/158, local 20/20, live smoke 12/12, and Python actually executing in the live build.

## SlideDeck (PKPilot0014) — a note is saved only after the save finishes

Slides and handwritten notes share one screen, and the notes are written to IndexedDB stroke by stroke. The trouble was that a failed save and a failed read looked the same: an empty page. The user assumes their notes are gone when the app simply could not read them.

- `savedStrokes` is updated after the transaction completes, not when the request is sent.
- A stroke that fails stays `dirty` and is retried with backoff. If it keeps failing, a "Try again" button and a notice appear.
- `loadAllStrokes()` separates a read failure from an absence of data. If any note store cannot be read, sample-deck refresh and workspace saving stop immediately.
- Deleting a deck or a slide deletes its notes in the same transaction, or rolls the whole thing back.
- Tabs compare `workspace:revision` and the notes' `{ revision, strokes }`. Saving notes also publishes on `BroadcastChannel`, and a tab with unsaved changes gets a banner: "Save this tab / Load the saved copy."
- Writes are serialised through a single queue and flushed immediately on `pagehide`. The chip at the top shows exactly five states: saved, saving, save failed, saving paused, conflict.

Checks: Vitest 169/169, Playwright 76/76 on desktop and mobile, and a live round trip in which notes were saved, the page reloaded and the notes came back, with zero console errors.

## Lýra (PKPilot0019) — sound does not come back

This is a multi-track loop station. Once a take drifts, the only fix is to perform it again. Most of the ten fixes here came down to two questions: who owns this take, and when can we be sure it has finished?

- `RecSession.token` is now part of the ownership check in asynchronous finalisation, and commits on the same track are serialised through `commitChain`. A recording that finishes late can no longer overwrite another session's take.
- `importFile` checks `generation`, `epoch` and `token` on both sides of `decodeAudioData`. An import that lands after the project changed is discarded.
- Changing the BPM no longer cuts the PCM. Until time stretching arrives, length is matched through `playbackRate`, and the screen says plainly that the pitch moves with it.
- An instrument's direct monitor and its recording input are separated, which removes the doubled output and the feedback.
- `stopAsync` used to wait 150ms and assume it was done. It now waits for a flush ACK and throws `RecorderFlushTimeoutError` when none arrives.
- Negative latency (-150 to 0ms) is applied to the actual capture correction, and a failed device switch keeps the previous device selection and permission state.
- Autosave no longer serialises to Base64 on the main thread. A `Float32Array` goes straight into IndexedDB, which brought a save from **765ms to 2.7ms**.

In the same app, the header now folds into two tiers and a project drawer sits behind it. The waveform and drawer accordion that overlapped in iPhone Safari were cleaned up at the same time.

Checks: the seven known defects were reproduced and made to fail first; then unit tests 130/130, live E2E 24/24, zero console errors.

## DOS Player (PKPilot0006) v2.0.0 — 1,423 lines into 15 modules

This one runs classic DOS games in the browser through js-dos. Booting, input and session shutdown were tangled in one file, so fixing one corner shook another.

- `app.js`, 1,423 lines long, became 15 modules, and `js-dos` is pinned at 8.5.4. Each boot carries a generation ID so a late boot can be cancelled.
- Physical keys are counted per input source (`kbd:KeyJ`, `kbd:KeyZ`). The same key pressed through two sources is tracked separately, so releasing one does not release the other.
- Keyboard capture is released before a game starts, and cards take focus with Space and Enter.
- Session shutdown is serialised in `SessionManager`, and the `target` snapshot is frozen while shutdown runs.
- The second QA round of eight items covered independent physical keys, serialised shutdown, a frozen target during shutdown, card replacement during boot, preserved volume and mute, per-generation input queues, stale requests blocked after cancel or error, and overlapping elements in dark landscape mode.
- The screen is now Player-first, with a game bar in mobile landscape, and contrast was raised to WCAG AA.

Checks: static checks, unit 90/90, E2E 102/102 (60 desktop plus 42 under an iPhone 13 profile), and `Digger` running live with zero console errors.

## Midpoint (PKPilot0002) — a map will not wait for you

This app finds a fair meeting point by alternating between two geocoders, Nominatim and Photon. If a rate-limited server is allowed to hold on for 120 seconds, the user can do nothing for those 120 seconds.

- The light and dark slide toggle moved into the titlebar, and the legend bar, Naver speech bubble, marker labels and map tool buttons — all of which stayed charcoal in light mode — now follow the theme variables.
- When Nominatim answers `429` with `Retry-After: 120`, the app switches to Photon instead of waiting; the live response took 1.32–1.39s. `cooldownStreak` resets once the service recovers.
- Changing the query, closing the list or pressing Escape invalidates the token, so a late response cannot overwrite newer results.
- Duplicate POIs are no longer judged by distance alone; OSM id, name, address and coordinates are weighed together. When OSM returns nothing, a late Overpass response still gets 2.5–6 seconds to arrive.
- A search the user typed moves to the front of the queue, and leaving the screen removes reverse-geocode work from the queue and aborts it. With 12 participants being registered, a search went from **13,165ms to 1,052ms**.

Checks: unit 214/214, local and live E2E, zero console errors.

## CinePlate and FrameBuilder — work that ends at the fingertips

One is a photo-plate studio, the other a four-cut frame workbench. Here, more of the work went into places where a finger slips than into numbers.

**CinePlate (PKPilot0011)**

- The 58 margarine filters moved into their own window, with group chips, search, a thumbnail grid and a strength slider.
- Emblems moved out of the three-way toggle in the frame panel into a dedicated window with 11 official logos, plus `Auto`/none and `Original`/`All Black` switching.
- EXIF `Auto` used to fall back to HD2Lab every time because `resolveEmblem` read `Make` and never passed `Model`. It now reads both, so a photo whose EXIF carries only a model name still prints with the right maker's logo.
- The tone curve closes when you tap outside it, and the `X` at the top right is larger. The purple badge that was judged by point count now uses an exact identity check.
- The bottom-left and top-right endpoints were pinned to x = 0 and x = 1 and could not move sideways. That is fixed, and the horizontal segments at both ends now appear in the graph and the spline.

**FrameBuilder (PKPilot0015)**

- Six dual-squircle favicons; a matte cotton finish (0.55 by default) and an archival paper texture.
- The iPhone long-press menu is blocked (`-webkit-touch-callout: none`), and each slot's photo can be deleted on its own.
- Arrow keys rotate by 1°/5° and scale by 2%/10%. Double-click and double-tap open a slot-only `SlotModal`.
- The dock now separates `Shutterplate · 4-cut print` from `CinePlate · film and video`.
- A two-finger gesture starts rotating and scaling as soon as the fingers land on the frame, and becomes a viewport zoom when they land on the surrounding space. The app used to wait briefly to tell a quick pinch apart; that wait is gone.

Checks: CinePlate — Vitest 159/159, mobile E2E 3/3, a live Apple EXIF upload and zero console errors. FrameBuilder — Vitest 148/148, Playwright 130/130, and a measured 390×844 run that rotated a frame from 0° to 24° and pinched the viewport from fit to 0.729.

## Markdown Editor (PKPilot0007) — the writing window in the same shape as the reading one

The shell no longer looks different from 0008 Viewer; it follows the 0008 spec, and GitHub settings now live in one dialog.

- The titlebar is down to four places: `? · ⚙ · ☾ · ⋮`.
- A single `#ghDialog` holds two presets, three image paths, a category and the PAT.
- The publish dialog shows the target repository as a badge and an `Include YAML frontmatter` toggle.
- Loading and image upload both follow the configured repository; change the repository and both paths change with it.

Checks: local Playwright 25/25, live 7/7, zero console errors.

## 青松館 (ADOP0001) Phases 1–3 — five tools sharing one document

This is a workbench where five tools sit on one screen: test generation, document conversion, code analysis and more. It went from Phase 1 to Phase 3 between the night of the 22nd and the small hours of the 23rd.

**Phase 1 — Haruhi (tests) and Takane (code generation)**

- A shared `TestCase` IR now keeps boundary values, exceptions, async cases and method inputs consistent with what actually runs.
- The generators for five frameworks — Vitest, Jest, Pytest, JUnit 5 and Go — were rewritten.
- Static branch mapping and execution coverage are reported separately instead of being blended into one number.
- Takane checks Python argument and field order, and splits C/C++/MCU output into header and implementation.

**Phase 2 — Kotoha (document conversion) and APP-001 (workspace persistence)**

- Every OOXML ZIP part and namespace is preserved. Unsupported blocks (text boxes, footnotes, tracked changes, merged tables) survive as byte slices, and the app warns before converting.
- Table headers are detected from `w:tblHeader`, and PNG, JPEG, GIF and BMP keep their real dimensions and `wp:extent` aspect ratio. Lists with several `numId`, `ilvl` and `startOverride` values stay intact.
- Inputs and options survive switching between the six tools and reloading — `localStorage` for small values, IndexedDB for large ones — and `⋮ → 下書きをすべて破棄` clears them.
- Files are capped at 25MB, with limits on entry count and uncompressed size, and an error leaves the existing document untouched.

**Phase 3 — ANA-001, UI-001–002, DATA-001**

- The ANA-001 parser was rewritten. It ignores comment markers inside strings and template literals, and reads multiline signatures, generics, Go receivers, Java `throws` and Python decorators. Unsupported syntax is not swallowed; it shows up as a diagnostic.
- UI-001 puts a request gate in front so only the newest request lands, and `ExportModal` reports success only after the download has actually finished. Exporting to `.docx` after editing in Kotoha without rebuilding is now blocked.
- UI-002 counts workspace files through nested folders, and on screens narrower than 1024px it does not mount the desktop-only rail and prompt pane at all.
- DATA-001 validates the bundle schema and the `toolId` allowlist, and keeps a backup so an import can be undone. Three realistic samples were added, bringing the total to seven.

Checks: Phase 1 — Vitest 124/124 and 38/38 on generated output; Phase 2 — 147/147; Phase 3 — 184/184. Playwright passed through all 14 phase-3 cases; only the gcc step of REG-11 was skipped, because the sandbox has no C compiler.

## The same four places kept collapsing

Different apps, the same conclusion. Written down so the next pass makes fewer of the same mistakes.

1. **A save is called successful only after it finishes.** `savedStrokes` is not updated before the transaction completes, and export success appears only after the download.
2. **Responses that arrive late are thrown away.** The recording session's `token`, the import's `generation`, the search token and the boot generation ID all do the same job.
3. **Two tabs can open the same workspace.** `revision` and `BroadcastChannel` let them see each other, and the app asks instead of overwriting quietly.
4. **Failures are not shown as a blank page.** A read failure is separated from missing data, a flush that never finishes throws, and a geocoder's rate limit is reported as its own state.

## What is left

- I have no permission to push workflow files, so the CI workflows are kept as YAML under each repository's `docs/`. Moving them into place once in the web UI will make checks run on every pull request from then on.
- Real iOS Safari, a real microphone and a real audio interface could not be checked in this environment. Verified as far as 390×844 and an iPhone 13 profile.
- Midpoint's server proxy was not built, because the site is static. Only the operations document exists.
- 青松館 still has Phase 4: the full 18-case regression pass.

Half of what gets fixed at night is only finished when it is opened again the next morning. This time too, opening the apps in the morning turned up a few more things to fix.
