---
title: "Soft Iris and Navy & Lavender: One Set of Colours for the Whole Site"
date: 2026-11-16
category: Architecture
summary: "Soft Iris in light, Navy & Lavender in dark. How one set of CSS variables and a single 44px toggle unified the theme of Web-HQ, the three hubs, and every PKPilot app."
tags: [theme, design-system, css, architecture]
lang: en
layout: post
---

Web-HQ, the three hubs, and the various PKPilot apps each carried their own colour. At first that felt natural — every app has its own character, and building them one at a time, per-app colours were faster. The problem was what came after: the same service showed a dark grey ground with an orange accent on one screen and a white ground with violet on another. Every new app meant re-deciding colour, and adding a single dark mode meant touching six screens one by one.

What I reorganised was not the colour but **the path the colour travels**: one set of tokens, one toggle, and only the differing position left to each app.

## One token set, two palettes

The light palette is **Soft Iris**: a white ground with the faintest wash of violet, and violet used as a single accent point. The dark palette is **Navy & Lavender**: the same composition, with the ground dropped to navy and the accent lifted to lavender.

Colours live in CSS variables rather than baked into components, so switching the theme is a single line: `<html data-theme="dark">`.

| Token | Soft Iris (light) | Navy & Lavender (dark) |
| --- | --- | --- |
| `--bg` | `#FAFAFD` | `#0B1020` |
| `--surface` | `#FFFFFF` | `#12192E` |
| `--panel-soft` | `#F4F1FC` | `#1A2340` |
| `--border` | `#E8E4F2` | `#253154` |
| `--text` | `#1D192B` | `#EEF2FF` |
| `--muted` | `#68627A` | `#94A3C4` |
| `--accent` | `#8B6CE8` | `#A78BFA` |
| `--accent-soft` | `#F1ECFE` | `rgba(167, 139, 250, .14)` |

There is one quiet but important decision here: the accent gets one step brighter in dark (`#8B6CE8` → `#A78BFA`). The same violet laid on a dark ground loses contrast and the button sinks into the background. The colours were split in two not to look prettier but so that **the same role reads at the same strength**.

![ApplicationHub in Soft Iris light mode: a white ground, one violet accent, and hub links at the upper right](/diary/assets/images/apphub-soft-iris.png)

## One toggle, a position per app

Every route uses the same toggle files: `assets/hd2-theme.css` and `assets/hd2-theme.js`, served from the site root's `/assets/` so that sub-apps pick them up unchanged. Copy them into each app and one copy is guaranteed to rot.

How it behaves.

- One storage key, `localStorage['hd2-theme']`, holding `light` or `dark`; the default is `light`.
- Each page applies the stored value before first paint with a one-line inline snippet in `<head>`, so a refresh in dark mode never flashes white.
- A `storage` event keeps tabs in sync, and `<meta name="theme-color">` is updated with the theme.
- The button's `aria-pressed` and `aria-label` change with the theme, and Korean pages get Korean labels. `prefers-reduced-motion` turns the transition off.
- For app scripts that need to drive it directly, `window.HD2Theme.get() / set() / toggle()` and the `hd2-theme-change` event are exposed.

What differs per app is only the position. Placement, z-index, and surface colour are adjusted through CSS variables set on `.hd2-theme-toggle`.

| Route | Toggle position | Hidden when |
| --- | --- | --- |
| Web-HQ · the three hubs | bottom right, default | never |
| PKPilot0002 Midpoint | above the map zoom stack | the sheet is pulled fully up |
| PKPilot0003 Shutterplate | bottom right of the stage (left of the inspector on desktop) | a modal or sheet is open |
| PKPilot0006 DOS Player | bottom right of the shell | playing fullscreen in landscape |

## The icon points where you are going

The toggle is a 44px circle. 44px is the smallest size a finger presses comfortably, and `env(safe-area-inset-*)` is added so it never collides with the iPhone home indicator.

The icon is a sun and a moon drawn from a 24×24 viewBox SVG at 19px. Both sit in the DOM and CSS shows only the one opposite the current theme: **a moon** in light, **a sun** in dark. Showing where the button takes you, rather than what state you are in, is less confusing for a control that flips between two states.

![Web-HQ in Navy & Lavender dark mode: navy ground, lavender accent, and a sun toggle at the bottom right](/diary/assets/images/webhq-navy.png)

## Verified screen by screen, twice over

A theme is a job where "looks like it works" and "works" differ widely. So headless Chromium opened seven routes at 1440×900 and 390×844, each in light and dark.

- 0 console errors, 0 page errors, 0 horizontal overflow
- Toggle measured 44×44, no overlap with other controls
- Clicking the toggle sets `data-theme=dark` and stores it; it survives refresh and route changes
- Pixel comparison against the light-mode baseline: the only differences are in the toggle's corner

The app test suites ran as well: Shutterplate 1,461, Midpoint 146, Photos 39 — all passing. Fixing the test paths so the shared assets are served from the site root was the hidden half of this work.

## What remains

- Map tiles and the photo canvas are not rethemed in dark. Content stays content; only the pins and controls above it were repainted.
- Replacing hardcoded colours in each app with tokens is still in progress. The structure only holds if the habit holds: never write a colour directly when adding a component.

With one set of colours in place, building a new screen became lighter work — choose a token instead of arguing with a palette. The value of a design system ends up here, in **the time it takes to make the next screen**.
