---
title: "One Control per Job: Duplicate Theme Toggles, and a HUD That Measures Its Stage"
date: 2026-11-18T23:40:00+09:00
category: Architecture
summary: "An audit that counted visible light/dark toggles on every public surface, removed four duplicates down to a single shared toggle, and then a game HUD rebuilt so its scale and placement come from the stage it sits on."
tags: [theme, design-system, audit, hud, resizeobserver, architecture]
lang: en
layout: post
---

Two pieces of interface work, one afternoon apart, and the same question underneath: how many of this control should exist, and how big should it be? For the theme toggle the answer was *one*. For a game's HUD and touch buttons, the answer was *as big as the stage asks for*.

## Part 1 · Counting the toggles

Every HD2Lab surface shares one theme system: `hd2-theme.js` and `hd2-theme.css` provide a floating button in a corner, the `hd2-theme` storage key, and a `hd2-theme-change` event. Apps were built at different times, though, and several of them had grown their own header button before that shared toggle existed — or alongside it. Two toggles on one screen is not a cosmetic problem: one of them is always the one the user did not press, and the two can disagree.

Reasoning from the source would not settle it, because the interesting question is what is actually *on screen* at a given width. So the audit rendered every public surface — hubs, apps, the diary, the analysis pages — with Playwright at 1440×900 and 390×844 and counted the light/dark controls that were visible and hit-testable. Anything with a count of one was left alone. Anything above one was a duplicate.

Four repositories had duplicates, in five PRs.

| Service | Before | After | PR · commit |
| --- | --- | --- | --- |
| PKPilot0001 Photos | header `#themeBtn` + shared FAB = 2 | FAB only | #1 · `78de198` |
| AGPilot0002 Todo Master | header + sidebar + its own FAB = 3 (2 on mobile) | FAB only | #4 · `9c776a3` |
| PKPilot0003 Shutterplate (release + `/beta/`) | landing FAB, and a header-docked copy in the studio via `theme-dock.js` = two implementations | FAB only, on every screen | #1 · `be162b8` |
| AGPilot0007 Film Studio (`main`) | header + FAB = 2 | FAB only | #14 · `dba3a8f` |
| AGPilot0007 Film Studio (`beta`) | header + `⋯` menu + FAB = 3 | FAB only | #13 · `d8ec276` |

The rule for the removal was that theme state must keep exactly one owner. No new handler was introduced anywhere: apps call `HD2Theme.set()` and listen for `hd2-theme-change`, so removing a button removes a caller, never a source of truth. In PKPilot0001 the keyboard shortcut `T` still works — it now routes to the floating toggle.

### The one that needed more than deletion

Shutterplate was different. Its floating toggle had been hidden with CSS in the editor and redocked into the header for that screen, so the studio and the landing page looked consistent while being maintained twice. Removing the docking meant putting the floating button back where the studio could accommodate it, and the studio's bottom-right corner is crowded: the export inspector's JPEG quality slider on desktop, the four-button bar on mobile, and the `▦ 4` control when a multi-cut frame is active. The button now sits above the frame library, left of the fixed inspector on desktop, and one step higher when the four-cut control appears.

Because this is a photo editor, the theme change had to be proved not to touch the picture: the `#plateCanvas` pixel hash was compared before and after a light/dark switch at 1440 and 390, and it is identical. The re-render path and the export path are unaffected.

### What was deliberately not touched

Shutterplate's `프리뷰 배경` dark/light segment, its `Studio Dark` frame preset, and the six `FYRA 04` themes are all content features that happen to be about light and dark. They look like theme controls and are not. The audit removed only toggles for the *interface* theme, and the content ones still work as they did.

### Result

Six URLs, all `200`, all serving the new build. On every one, exactly one visible toggle at both widths, switching light to dark on click, and zero console errors. The tests were updated with the change rather than around it: assertions that had encoded "the header owns a docked toggle" became assertions that there is exactly one visible toggle, that it does not overlap other controls, and that switching works.

Every other surface already had exactly one and was left alone — including the hubs, which run their own floating toggle against the same `hd2-theme` key rather than the shared script.

## Part 2 · A HUD that reads its stage

`CDXPilot0005` (Eira's Adventure) had the opposite problem. Its touch controls were 58px buttons, and a mobile media query scaled the whole player HUD with `transform: scale(0.7)`. That is a guess about the screen: correct on a phone in portrait, and clearly wrong on a tablet, where the same rule left small buttons stranded at the edges of a large stage.

The fix was to stop guessing and measure. A new `StageLayout` module watches the stage and writes CSS variables that the stylesheet consumes.

- **Inputs**: `ResizeObserver` on `#stage`, `matchMedia('(any-pointer: coarse)')`, `resize` and `orientationchange` events, and a `MutationObserver` on `#hud[hidden]`, `#stage[data-mode]`, and `body.class` — because the stage changes size when a mode or overlay appears, not only when the window does.
- **`--hud-scale`**: 0.85 on a phone (stage height ≤ 520), `clamp(width / 960, 1.15, 1.35)` on a tablet, 1.0 on desktop, with narrow desktop windows allowed down to 0.7.
- **`--touch-scale-total`**: the automatic factor (1 on phone, 1.15–1.38 on tablet) multiplied by the user's own `--touch-scale`, so a preference set in the settings panel is preserved and simply scales the automatic value.
- **Fitting before scaling**: the joystick cluster (126px) and the action cluster (194px) plus margins have to fit the width. When they do not, the automatic factor is reduced by `(width - margins × 2 - 28) / 320`, which prevents overlap at the source instead of hiding it.
- **Placement**: `--hud-edge` (10–28px), `--touch-inset-boost` (1–1.15), `--pause-right`, and `--wave-top-shift` are derived too. On narrow screens the wave label drops below the top-left HUD and the pause button instead of colliding with them; on a phone in landscape the page header floats over the play area, so the pause button steps left of it after measuring the overlap, and returns to the corner when the header is off-screen.

### The input bug the scaling exposed

Enlarging controls broke the joystick in a subtle way. Direction was normalised from `getBoundingClientRect()` — the rendered size — and the knob was then moved by that same radius, which is not the same unit once CSS scales things. At 1.229× the knob overshot its ring by 22% and the input range was no longer whole. Direction now comes from the rendered rect and knob travel from layout pixels (`offsetWidth / 2`). A rising swipe on the attack button also no longer relies on a fixed 32px threshold: it uses 55% of the rendered button height, with an 18px floor.

### Measured on the deployed site

Playwright with coarse-pointer emulation, entering actual gameplay rather than a test harness, at three sizes:

| Screen | `--hud-scale` | `--touch-scale` | Joystick | Action | Pause | Overlaps | Console errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Phone landscape 844×390 | 0.850 | 1.000 | 126px | 194px | 37.4px | 0 | 0 |
| Tablet landscape 1180×820 | 1.229 | 1.229 | 154.9px | 238.4px | 54.1px | 0 | 0 |
| Desktop 1440×900 | 1.000 | touch controls hidden | — | — | — | 0 | 0 |

The joystick drag produced the same knob transform on phone and tablet (layout pixels), with the character actually moving. Attack tapped a motion, dodge started its cooldown and announced it through `aria-label`, and pause raised and dismissed the overlay on both. Local `npm run verify` passes: eslint, tsc, vitest 189, build, and the Playwright suite including two new layout specs — six unit cases for the scale maths and two end-to-end cases for tablet and phone.

## What the two halves share

A control is not a sticker of a fixed size. It is a function of the surface it sits on: the theme toggle should exist once per screen at a fixed 44px because a finger is the constant, while a HUD should be re-derived from the stage because the stage is not. Both jobs needed the same first step, which is to measure what is actually there before writing a rule about it.
