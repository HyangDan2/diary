---
title: "Three Days of Red CI: The App Was Fine, the Engine Was Missing"
date: 2026-11-18
category: Troubleshooting
summary: "Six AGPilot0003 E2E specs were timing out on Engine Offline. The fix was letting Playwright start the backend itself — which then exposed a readiness race, and left one Pages deploy job still failing."
tags: [github-actions, playwright, e2e, fastapi, ci]
lang: en
layout: post
---

AGPilot0003 is a CAD app that opens and edits drawings in the browser. The front end is Vue 3 + Vite, and the geometry work is done by the **CoverFilm geometry engine**, a FastAPI service. Unit tests stayed green the whole time. Meanwhile `main`'s CI had been red for more than three days.

## Symptoms

- The `build` job dies at `Run E2E tests`.
- The engine status badge on screen (`data-testid="cf-backend-status"`) keeps reading **Engine Offline**.
- All six E2E specs covering CoverFilm and the CAD core time out.
- Jest unit tests are fine: 352 of 354 suites passing (2 skipped), 2,463 tests passing (2 skipped).

So **the code was not broken; the environment the specs expected was missing.** The failure in the CI log looked like this.

```text
19 × locator resolved to <span data-testid="cf-backend-status" class="cf-backend-tag is-offline">Engine Offline</span>
  - unexpected value "Engine Offline"
```

## Cause: those specs require a real engine

The six specs do not merely check the screen. They confirm `Engine Online`, then **actually upload a DXF file to the engine at `127.0.0.1:8000`** and read the drawing back. That is also why the local run instructions in the README and in `docs/USER_GUIDE.md` begin with "start the backend first".

On a developer's machine, an engine started by hand was sitting there. In CI nobody started one, because `playwright.config.ts` listed only the Vite server in `webServer`. Not an app defect — **a missing piece of configuration**.

## Fix 1 · Let Playwright start the engine too (PR #2 · `918fd17a`)

Editing the workflow file was an option, but that splits the local and CI conditions apart again. Instead `webServer` became an array, so **the app and the engine come up together from one command**.

```ts
webServer: [
  {
    command: `pnpm dev --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  {
    command: backendCommand,               // scripts/start-e2e-backend.sh | .ps1
    url: 'http://127.0.0.1:8000/api/v1/health',
    timeout: 300_000,                      // the first run creates a venv and installs deps
    reuseExistingServer: !process.env.CI
  }
]
```

The startup script is the manual procedure from the README, moved into code.

- Create `backend/.venv` if it is missing, then install `backend/requirements.txt`.
- Reinstall when the requirements file changes, by comparing against a hash left in `.requirements.sha`.
- Finally start `uvicorn app.main:app` on `127.0.0.1:8000`.
- Windows uses `start-e2e-backend.ps1`, which does the same thing.

Because of `reuseExistingServer: !process.env.CI`, local runs reuse an engine already running and CI always starts a fresh one. **Not one line of any spec changed. No mocking, no skips.**

Numbers measured locally:

| Situation | Time |
| --- | --- |
| First run (venv, install, uvicorn) | about 140 s |
| Once prepared | about 9 s |

In this PR's verification run (`44195201490`), all 36 E2E tests passed in 5 minutes 42 seconds. The engine badge read `Engine Online`.

## Fix 2 · The race the engine exposed (PR #3 · `82acca1d`)

With the engine problem out of the way, a waiting defect surfaced. On `main` after the merge (`44200297047`), one spec — `nested INSERT Off vs Freeze follows AutoCAD layer semantics` — failed with `null` on **all three attempts**. The other 35 passed.

The cause was the spec's readiness wait.

```ts
await expect(page.locator('.ml-cad-container')).toBeVisible({ timeout: 30_000 })
await page.waitForTimeout(1500)   // waited 1.5 s, then read
```

`window.AcApDocManager.instance` only exists after `App.vue`'s `initialize()` finishes the dynamic import of `@mlightcad/cad-simple-viewer`, and the uploaded INSERT reaching model space is a separate matter again. Nothing guarantees the gap between "container visible" and "ready", so on a loaded runner the value read 1.5 seconds later was `null`. The classic flake that mostly passes locally and collapses only in CI.

The fixed wait became **readiness polling**.

```ts
await expect
  .poll(
    async () => (await readNestedInsertSceneState(page))?.insertObjectId,
    { timeout: 30_000 }
  )
  .toBeTruthy()
```

What is verified and what is covered stayed the same; only the waiting changed. When there is a condition to wait for, wait for the condition instead of naming a duration.

## Fix 3 · The last red light was not a test (`8ff203e9`)

After both PRs were merged, CI was still red. This time a different job was the problem: `build` was green while `deploy-pages` failed.

```text
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions...
Error: Not Found - https://docs.github.com/rest/pages/pages#get-a-pages-site
```

This repository needs a backend engine, so it does not use static Pages deployment. But the workflow still carried the old configuration and attempted a deploy every run, and a job unrelated to the tests kept marking the whole CI run as a failure.

I removed the `upload-pages` and `deploy-pages` jobs from `ci.yml` (27 lines deleted), leaving the guide build step inside the build job untouched.

## Result

On the final commit `8ff203e9` (`44209661363`), the `build` job ran green end to end.

| Item | Result |
| --- | --- |
| Jest unit tests | 2,463 passed · 2 skipped (352 suites passed · 2 skipped) |
| Playwright E2E | 36 passed · 1 skipped |
| `build` job | success |
| Whole CI | success |

The three commits, and what each one did.

| Commit | Change | Outcome |
| --- | --- | --- |
| `918fd17a` (PR #2) | Playwright starts the CoverFilm engine with the app | Engine Offline resolved, six E2E specs restored |
| `82acca1d` (PR #3) | Fixed wait in the nested INSERT spec → 30 s polling | Flake removed |
| `8ff203e9` | Removed the Pages upload and deploy jobs | Whole CI green |

## What I learned

- **Red CI is not always a code problem.** First ask what the test assumes. Here it was one engine process, and its absence killed six specs at once.
- **A failure that appears after a fix is progress.** The race was hidden while the engine was missing and showed up the moment it started. Uncovering hidden defects one at a time is faster than counting them.
- **A fixed wait will break eventually.** `waitForTimeout(1500)` passes fine locally. When the condition is clear, wait for it — `expect.poll` and the like.
- **Read jobs, not the rollup.** Tests can all be green while a stale workflow configuration keeps CI red. Reading the name of the failing job first saves time.
