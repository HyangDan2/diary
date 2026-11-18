---
title: "AGPilot0006, and Pulling the HD2Lab Sites into One Place"
date: 2026-11-13
category: Devlog
summary: "Shipping AGPilot0006, reorganising the Web-HQ hub, and making a place to keep the record. A week spent making scattered things run in one spot."
tags: [pkpilot, web-hq, github-pages, devlog]
lang: en
layout: post
---

> Note: the subject of this post is `AGPilot0006`, a document-conversion pipeline. `PKPilot0006` is a DOS Player built separately on 2026-11-16 — a different app entirely.

Instead of opening a big new feature this week, I spent the time making scattered things **run from one place**. I shipped `AGPilot0006`, realigned the cards and links on the hub site, and built somewhere to keep the record.

## What changed this week

- Shipped `AGPilot0006` — tidied the document-conversion pipeline and statically hosted the build output.
- Reorganised the `Web-HQ` card layout — the hubs went from three to four, and the desktop grid became 2×2.
- Removed old scripts from the repository root and cleaned up `.gitignore`.
- Added this Diary — Eleventy for the build, with a `/diary/write/` editor to start.

## Commit log

| Date | Repository | Change |
| --- | --- | --- |
| 11-11 | `AGPilot0006` | Split the conversion pipeline into modules |
| 11-12 | `AGPilot0006` | Fixed the static publish path for build output |
| 11-13 | `HyangDan2.github.io` | Reworked Web-HQ into four hub cards |
| 11-13 | `HyangDan2.github.io` | Started building on Diary |

## The build always breaks in the same place

The failure came from the usual spot again this week: passes locally, breaks only in deployment.

```bash
# passes locally, fails in CI
npm run build
# Error: ENOENT: no such file or directory, open 'dist/index.html'
```

The cause was simple. The build script used paths **relative to the repository root**, while CI ran it from a different working directory. Switching from `process.cwd()` to paths relative to the config file fixed it.

> A path problem is far more often a working-directory problem than a code problem. The first thing to print when something fails is `pwd`.

## The structure ends up on one page

![The Web-HQ screen with four hub cards in a 2×2 grid](/diary/assets/images/2026-11-13-webhq-hubs-grid.png)

Going to four hubs meant deciding again how the sites point at each other: ApplicationHub, GameHub, TechnicalHub, and Diary. Three shared rules.

1. Every page carries a link back to Web-HQ in its header.
2. One colour scheme: `#101110` background, `#ff824f` accent, nothing else.
3. A new project gets one card. When the description grows longer than that, it is a post, not a card.

## Next week

- Keep adding posts to the Diary (right now there are only two samples)
- Measure the mobile performance of the PKPilot0002 map app again
- Check whether the 2×2 grid is actually balanced once the Diary card sits in Web-HQ

Ship small, write it down often. This was a week that kept both.
