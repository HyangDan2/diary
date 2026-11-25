---
title: "Sigrún: From a Chart Engine to v1.0.0-rc.1 in Twenty-Two Hours"
date: 2026-11-25T21:10:00+09:00
category: Devlog
summary: "Sigrún's first chart-engine commit landed at 09:59 on November 24 and the frozen release candidate was built at 07:50 the next morning. In between: a rewritten contour renderer, three stages of statistical modelling with corrective QA, a guided tutorial system, and a single-file offline build whose every hash can be recomputed. Twenty-six pull requests, 58 commits, and unit tests that went from 661 to 1,240."
tags: [sigrun, pkpilot0018, devlog, statistics, webgl, qa, release]
lang: en
layout: post
---

Sigrún (`HyangDan2/PKPilot0018`) is a statistical and quality workspace that runs entirely in the browser. It has no server, no account and no upload: the worksheet, the fitted models, the charts and the saved projects all live on the reader's machine. That constraint decided almost everything below.

The first commit in this stretch, `5986f8a`, landed at 09:59 on November 24. The release candidate was built from `91382d3` at 07:50:52 on the 25th and frozen by the artifact commit `3cdce23` six minutes later. Twenty-two hours, 58 commits and 26 pull requests (#10 through #35) separate the two.

## What the twenty-two hours covered

| Stage | What it added | Merged as | Tests at that point |
| --- | --- | --- | ---: |
| Phase 1–2 · chart engine | 16-case Marching Squares, asymptotic decider, per-render clip, 7 style presets, 7-tab properties drawer, DPI export | `5986f8a` → `9a00f7f` (no PR) | 661 |
| 3A · guards and models | `chartGuards.ts`, PNG `pHYs` DPI, Stored Model Manager, polynomial regression | `9b2ad4e` (#10), `dd64e22` (#11) | 749 |
| 3B · 3D and overlap | 3D surface (WebGL mesh, static projection fallback), overlaid contour, then corrective QA F-01…F-08 | `4eeb481` (#12), `fca4e6f` (#18) | 953 |
| 3C · optimization | Multi-response optimizer, prediction profiler, then corrective QA F-3C-01…13 | `99e37de` (#15), `816f34c` (#23) | 1,001 |
| 3D · figures | Graph Layout Editor, advanced axes, chart interaction | `22d0e30` (#19–#21) | 913 → 953 |
| 3E · portable | Whole app as one HTML file that runs from `file://` | `7ad939a` (#26) | — |
| WO-3E-11 · tutorials | 12 guided lessons, 68 steps, sample library, help center | `b3a792f` (#32) | 1,096 |
| Tutorial QA · T-01…T-13 | Original-project guard, strict step verification, per-session practice slots | `7c5234d` (#34) | 1,139 |
| WO-FINAL · stabilization | Minitab gap audit, save/restore integrity, edition record, RC artifacts, CI gate | `91382d3` (#35) | 1,240 |

The test count on the right is the number the stage left behind in `npm test`, so it wobbles where stages merged in a different order than they were written. It is still the cheapest summary of the arc: 661 to 1,240 unit tests, and `npm run qa:stats` — the Python reference suite that checks the engine against SciPy and statsmodels — from 156 to 225 cases.

## Phase 2 — a contour is not a grid of rectangles

The Phase 1 audit of `ee1dafe` found that filled contours were drawn one rectangle per grid cell. The band edge therefore stepped by a whole cell, and on a wide plot the staircase was the first thing a reader saw. Three more defects sat behind it: only 8 of the 16 Marching Squares cases were handled, with no asymptotic decider, so saddle cells lost a segment and lines stopped at cell borders; chart width and clip ids lived in module scope, so a second chart could inherit the first one's geometry; and tick formatting looked only at magnitude, which printed `0.0000` for `1.2e-6` and `1.0M` for values spanning `1,000,000.001` to `1,000,000.005`.

What replaced it, in `src/lib/contour.ts`:

- **All 16 cases**, including the four single-corner ones and the full/empty cells.
- **An asymptotic decider**: a saddle cell compares its bilinear saddle value with the iso-level, so `Z = X² − Y²` at level 0 draws two crossing segments instead of one arbitrary line.
- **Segment stitching** with a tolerance relative to the axis span, so a contour is one path rather than hundreds of fragments.
- **Band polygons** that interpolate the level boundary along cell edges — this is what removes the staircase.
- **A per-render clip path** (`sigrun-clip-<render>-<n>`), so a band that leaves the plot box no longer paints over axes or labels.
- **A stated constant surface**: a flat surface has no iso-lines, so the frame is filled with the mid colour and annotated, not left blank.

Geometry tests compare the output against analytic planes, paraboloids, saddles, interaction surfaces, constant surfaces and NaN masks, rather than against stored screenshots.

![Filled contours at 101 × 101 after the rewrite: interpolated bands, a 60–80 colour bar, the range badge 57.392 – 80.837, and the stationary point marked](/diary/assets/images/2026-11-25-sigrun-contour-filled-lines.png)

The resolution ladder was measured rather than assumed (median of five runs, 560 × 300 SVG, `filled-lines`, 10 bands):

| Grid | Median | Fastest | SVG bytes |
| ---: | ---: | ---: | ---: |
| 41 × 41 | 8.5 ms | 4.7 ms | 57,935 |
| 101 × 101 | 30.2 ms | 19.7 ms | 135,063 |
| 201 × 201 | 50.7 ms | 33.9 ms | 263,130 |
| 401 × 401 | 100.9 ms | 96.2 ms | 519,965 |

A 401 × 401 grid produces 160,801 predicted values, and the first Ultra render died with `Maximum call stack size exceeded` because the extent was computed with `Math.min(...values)`. That is now a loop. On top of the engine went seven style presets (Sigrún Classic, Engineering, Scientific, Corporate, Monochrome, High contrast on an Okabe–Ito series, Dark), a seven-tab properties drawer that docks at the right above 1024 px and becomes a bottom sheet below it, a 60-step undo bound to Ctrl/Cmd+Z, double-click routing from an SVG region to a drawer tab, a right-click chart menu, and export at 160 × 100 mm / 300 DPI, which is 1890 × 1181 px.

## Stage 3A–3C — the part that has to be right

Charts are visible, so their defects are visible. Statistics do not announce themselves; a wrong prediction looks exactly like a right one. The three modelling stages therefore shipped with a corrective pass each, and the corrective passes are the interesting part.

### 3B — per-model coding, honest intervals, isolated state

The 3D surface and the overlaid contour went in as `4eeb481`. The corrective pass (`fca4e6f`, F-01…F-08) then took the eight defects that only appear once two fitted models share one plot, and measured each one on a probe script run against both the baseline worktree and the fixed tree:

| Defect | Probe | Before | After | Reference |
| --- | --- | ---: | ---: | ---: |
| F-01 | Prediction at A=2 for a second model centred at 10 with half-range 5 | 106 | 95.2 | 95.2 |
| F-03 | Evaluate a point on an aliased term, then evaluate (0,0) | NaN | 5 | 5 |
| F-04 | Predict at A = 1e200 where A³ overflows | 1e+200 | null | invalid |
| F-04 | Standard error from a covariance containing NaN | 0.2828 | null | invalid |
| F-05 | Extrapolation flag where model 1 covers the range and model 2 does not | false | true | true |
| F-06 | Convergence at Ultra: \|ratio(401) − ratio(201)\| | 0 (self-compare) | 0.0010394261468677 | same |
| F-07 | Prediction-interval width for a model with no `mse` | 0.8913 | null | null |
| F-02/F-08 | Overlaid contour requested with one model | no throw | `feasible.minModels` | error |

The root causes were all one mistake wearing different clothes: `computeGrid` converted axis values into design coordinates using `models[0]`'s predictors and then handed that single coding to every evaluator. Two models with different centres and half-ranges were being evaluated in someone else's units. The fix builds **one actual-coordinate grid and converts it per model** (`designFromActual`, `axisActualValue`), makes `Coded` display follow a declared reference model, and states `factorBounds` in actual units so the 2D view, the 3D extrapolation check and the plotted design points all agree.

Two more of those defects were failures of candour rather than arithmetic. `effectiveBasis = basis !== 'mean' && !interval.ok ? 'mean' : basis` silently answered a confidence-interval request with a mean-based surface when a model had no covariance; the fallback is gone, and `basisAvailability()` now returns per-model reasons that the engine, the chart recomputation, the model manager and project restore all read. `mse = model.residual?.mse ?? 0` invented a residual variance to produce a prediction interval; a model without one now gets a confidence interval and no prediction interval, and the drawer says that intervals are pointwise, not simultaneous. That last one is not implemented — it is stated.

Alongside the fixes came 19 new reference cases (QA-V), each computed by an independent NumPy implementation rather than a TypeScript copy: design-matrix coding, mask intersection, 4× grid quadrature, convergence comparison. The suite caught its own over-strictness, too — four stored-model cases looked like regressions until the negative eigenvalue turned out to be −2e-8 against a diagonal of 0.86, a relative 2e-8 produced by inverting `X'X`. The PSD tolerance moved to a relative 1e-7; a genuine negative variance (−0.5 on the diagonal) is still rejected.

### 3C — one definition of a prediction, exact decimal domains

The optimizer and the profiler arrived in `99e37de` (Derringer–Suich desirability, multi-response), and the corrective pass `816f34c` rewrote thirteen defects. Three of them are worth spelling out because they changed what the screen is allowed to claim.

**The optimizer had its own prediction arithmetic.** `optimizer.ts` compiled its own evaluator, separate from the model manager, the contour and the surface. Every path now goes through `src/lib/predictionAdapter.ts`, which takes actual coordinates, converts per model, and returns value, SE, CI, PI, non-estimability and problem codes in one shape; the tests assert that `optimizer.ts` no longer contains `compilePointEvaluator` or `tInv`. The compiled path is 1.7× faster (23.7 µs → 14.0 µs per evaluation on a six-term model), and the difference between the two paths is compared against zero at 1e-12 rather than assumed away.

**A discrete domain is a decimal problem.** The old grid accumulated `lower + k × step`, so a 0–0.001 range at step 1e-4 carried `0.00015000000000000001` as its fourth value instead of `0.0003`, and a 0–1 range at step 0.6 produced 21 points because the step was ignored. `factorDomain.ts` builds values from an integer index and a `10^d` scale, so `Lower + k × Step` is exact for 0.3 and 1e-4 alike; `discreteAxis()` refuses to emit a value above the upper bound (0…1 at step 0.6 is `[0, 0.6]`, two points); and fixed values are validated as on-step and in-range instead of being merged into the "all fixed" error. Every consumer — grid, enumeration, random start, local search, profiler, UI — reads the same module.

**Seven states instead of "optimal".** A local search that converged was reported as `optimal`, which is a claim it had not earned. The states are now `global-optimal` (only when every free factor is discrete or categorical and every combination was evaluated inside budget), `local-converged` (with `search.basins[]` recording each start), `best-found`, `limit` (budget, time or cancel, with `search.stoppedBy`), `feasible-not-found`, `infeasible`, and `invalid`. Hard specification compliance is computed separately from desirability, and `recommended` is true only when every hard limit is met.

Search became a generator: `optimize()` consumes it synchronously for the QA adapters and tests, while `optimizeAsync()` returns control to the host every `chunkSize` evaluations and honours an `AbortSignal`. The window's Stop button stops at the next candidate and reports `search.stoppedBy = 'cancel'`. Measured on Node 24.11: 598 evaluations in 17.8 ms for a two-factor multi-start search; 2,304 enumerated combinations in 63.7 ms; a 2,304-evaluation async run in 116.6 ms with 25 host yields; ten profiler redraws (5 responses × 2 factors × 21 points) in 34.1 ms. Five batches of 100 repeated runs left the heap at 30.7 / 29.4 / 28.1 / 58.2 / 40.6 MB — not monotonic.

The reference side grew 20 new cases (QA-W), including the ones that are easy to get wrong in a way nobody notices: model-order invariance, a target set to the lower limit (desirability 1 at that limit, 0 at the other), a weight of `Infinity`, and a profiler-to-optimizer prediction comparison that must agree to the last digit.

## 3E — the whole application as one HTML file

`npm run build` emits ES modules, and module scripts need an origin; opened from `file://` the browser blocks them. That is fine for GitHub Pages and useless for a plant floor, an air-gapped PC or a USB stick.

`npm run build:portable` builds the same source as an IIFE with `inlineDynamicImports`, `assetsInlineLimit: Infinity`, `cssCodeSplit: false`, `modulePreload: false` and `base: './'`. The result is one HTML file with the JS, CSS and icons inlined. The offline E2E opens it through a real `file://` URL with the network blocked: **63 / 63 checks pass, and the request monitor sees zero requests outside `file:`/`data:`/`blob:`**.

The build is also reproducible. `SOURCE_DATE_EPOCH` is the single clock for the ZIP entry timestamp, the read-me, the manifest and the hashes; two builds at the same epoch produce the same SHA-256. That property is what made the release verification at the end of the day possible at all.

## WO-3E-11 — a tutorial that can fail

Twelve lessons, 68 steps, covering descriptive statistics to DOE and multi-response optimization, with a flagship twelve-step lesson on a synthetic display-optics experiment (four responses, three factors) that runs a reader from "load the data" to a saved project read back and verified.

The design decision that mattered: **the tutorial is declarative content, and the assertions are checked against the real workspace**. Nothing is a React component per lesson; adding a lesson is a data file. Between the app and the lesson there is exactly one bridge, and it passes an allow-list of 13 actions — no `eval`, no dynamic import, no arbitrary JavaScript. Sixteen validation rules read the actual worksheet, output cards, stored models, figures and project files, comparing floating point in an absolute 1e-9 / relative 1e-6 band rather than comparing formatted strings. `checkPredictionConsistency()` cross-checks the optimizer's solution against the stored model, the profiler's saved condition against the same model, and a 3D surface's centre node against the stored prediction — and the unit tests move a coefficient and shift a surface to prove that this check actually fails.

A step that once passed does not stay passed: the rules are re-evaluated whenever the workspace changes, so evidence that has disappeared takes the step back to `IN_PROGRESS`.

![The tutorial library: 12 lessons, 68 steps, each step verified against the workspace, and a footer that says a lesson starts a separate practice project](/diary/assets/images/2026-11-25-sigrun-tutorial-library.png)

The corrective pass T-01…T-13 (`7c5234d`) was almost entirely about one thing: **the reader's own project**. The baseline wrote a snapshot into a window variable; a refresh lost it. Now `guardOriginalProject()` writes the project and a fingerprint to `sigrun.tutorials.original.v1`, reads it back, and compares — and if the read-back does not match, the lesson does not start at all. Instead a dialog offers an explicit backup download, and the practice opens only after that file exists on disk. Autosave is flushed before the swap and paused during the practice; settings, custom chart styles, undo/redo history and figures are part of the snapshot; practice slots are keyed per tutorial and session (`practice.v2`) so discarding one lesson no longer removes another's work. Completion is separated into `verified` / `manual` / `skipped`, and the status bar reads its phase from `APP_PHASE` instead of a hard-coded `PHASE 1`.

The proof was written in the direction that is uncomfortable: the corrective suite imports only APIs that exist in the baseline, so the baseline fails with 19 assertion failures and 0 module-load errors, and the same file passes 24/24 afterwards. For the two defects that live in a running app rather than a function, a browser probe does the same job: 5 of 9 at the baseline, 10/10 after.

## WO-FINAL — stabilization, and the audit that says what is missing

Two things are easy to fake at the end of a project: a gap analysis and a release. Both were written so they could be checked.

**The gap audit** (`docs/MINITAB_MASTER_FEATURE_GAP.md`) counted 289 features from Minitab 22.6's public documentation, gave every row an official reference URL, and requested all 284 distinct URLs — all returned HTTP 200. Sigrún provides 70 of them in some form (24.2%): FULL 2, PARTIAL 65, DIFFERENT 3, MISSING 218, NOT_APPLICABLE 1, UNKNOWN 0. Priority: P0 0, P1 73, P2 199, P3 17; Phase 4–6 backlogs were written from that list (85 / 179 / 25 features). `tools/verify_audit.mjs` recomputes the document, CSV, JSON and dashboard totals from the same source and refuses to pass when they disagree. The document states plainly that **Minitab was never executed**, so numerical equivalence is not claimed anywhere — only that the same statistical definition was chosen, checked against an independent NumPy/SciPy/statsmodels reference.

**The release** (`v1.0.0-rc.1`) is defined by a single clock. `SOURCE_DATE_EPOCH` sets the build time; Vite, the portable builder and the ZIP writer all receive the same value, so the About year, the ZIP timestamp, the manifest and the hashes point at one instant. Eleven files in `release/v1.0.0-rc.1/`, a `SHA256SUMS.txt` that does not list itself, and `build-info.json` that does not hash itself:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `Sigrun-v1.0.0-rc.1.html` | 1,605,775 | `db4dad0d…c2071441` |
| `Sigrun-v1.0.0-rc.1-Portable.zip` | 469,961 | `6b652902…a32c191d87` |
| `Sigrun-v1.0.0-rc.1-Web.zip` | 616,244 | `5f76c821…5770b42ce4` |
| `build-info.json` | 975 | `815ecfab…504376638` |
| `VERSION.txt` | 161 | `8b031c73…49c3412763` |
| `LICENSES.txt` | 383,480 | `46eaa067…c9370459` |

All ten hashes recompute. The verification also rebuilds the portable HTML from the recorded epoch and requires it to be **byte-identical**; it checks that the HTML inside `Portable.zip` equals the release HTML, that no external script is loaded, that no product token is left unresolved, and that no build input has changed since the build commit — a later documentation or CI commit does not invalidate the artifacts, but a later source change does.

`LICENSES.txt` grew from 8.5 KB to 383 KB because the full license text and NOTICE of all 115 packages are now included, with the packages that have no license file saying so. `release:check` fails the build outright when any package is `UNLICENSED`; this build has zero unknown licenses.

## The edition record — one place for every name

The public build had its product name, canonical URL and storage keys scattered across `index.html`, the Vite config and individual modules. Deriving a second build meant hunting them all, and missing one would mix the public site's brand or storage keys into an enterprise install.

Now two records under `src/config/editions/` are the only source. The public record reproduces today's strings and keys exactly; the enterprise record is complete except for the brand and copyright, which stay empty until the owner supplies them — and an enterprise build with an empty brand is blocked on purpose. The engine under `src/lib` does not know which edition it is in. Every persistence key is namespaced (`sigrun.enterprise.…`), so both editions can run on one origin without reading or deleting each other's data.

## Where the honesty costs

Four things were left as they are, and said out loud:

- **The macOS clipboard failures were not this branch's.** stage1 lost 15 checks and stage3 lost 4, all on `navigator.clipboard`, and the same 15 and 4 reproduced at the baseline `52e8a79`, on the Phase 3E tree, and against the live Pages site. They were never counted as passes. WO-FINAL-002 then ran those suites on a Linux runner as a CI job, where they pass 77/77 and 176/176 — which settles the question the local machine could not.
- **The first CI run of the portable suite failed**, on a browser flag that only makes sense on macOS. It was fixed by splitting the flag per platform without touching a single check, and the failure is recorded in the corrective review rather than overwritten by the green re-run.
- **A restored project is only restored once it is on disk.** WO-FINAL-002 changed restore so it writes the guarded copy to autosave, reads it back and compares every record, and removes the backup only when the read-back is identical.
- **Range slack had to come from the ULP, not the offset.** A design bound of `2^(1/4) = 1.189207115002721` arriving as `1.189207115` from a 9-digit column was being classified as extrapolation, failing 10 of 225 statistical QA cases on a 1.14e-12 difference. The width-proportional term moved from `1e-12` to `1e-9`, while the 4-ULP term keeps a genuinely out-of-range value out of domain — Lower 100000000, Upper 100000000.001, Value 100000000.05 is still OUTSIDE.

## Final numbers

At `91382d3`, on the build that produced the release artifacts:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 0 errors |
| `npm test` | 1,240 / 1,240 (57 files) |
| `npm run qa:stats` (SciPy 1.18.1, statsmodels 0.15.0) | 225 / 225, 0 FAIL / REVIEW / UNVERIFIED / ERROR |
| Tutorial E2E, all 12 lessons | 28 / 28 checks |
| Portable offline, `file://` | 63 / 63 |
| Portable tutorials | 8 / 8 |
| Tutorial guard probe | 10 / 10 |
| Network audit (public, portable, enterprise) | 13 / 13 |
| Release verify `--repro` | PASS · 11 files · portable HTML byte-identical |
| CI gate on PR #35, run `45500479639` | every stage green, deploy skipped |
| macOS browser regression | 505 / 524 executed · 19 clipboard failures, reproduced at baseline |
| Linux CI browser regression | stage1 77 / 77 · stage3 176 / 176 |

## What is not in it

Minitab was not run, so no number here is claimed to match it to the last digit; where the definition differs — the Anderson–Darling p-value is an approximation, proportion power uses a normal approximation — the QA report marks those cases REVIEW instead of passing them. Two tabs on one origin is a stated limitation, not a solved problem: the newer save is reported rather than silently overwritten. A portable file opened from `file://` may get an opaque origin, so anything that must survive belongs in Save Project. Phase 4–6 (new analyses, new chart families, server features) is not in this release, and the `v1.0.0` tag is deliberately not created — this is `-rc.1`.

The release is public at [hyangdan2.github.io/PKPilot0018](https://hyangdan2.github.io/PKPilot0018/), and the single HTML file needs nothing but a browser.
