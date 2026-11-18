---
title: "Shutterplate: Thirteen Frames and the Four-Cut FYRA 04"
date: 2026-11-15
category: Devlog
summary: "A studio that reads EXIF inside the browser and lays a film frame over the photo — never uploading the picture. Thirteen single-frame presets, plus a four-cut strip."
tags: [shutterplate, exif, canvas, devlog]
lang: en
layout: post
---

Shutterplate is a studio that takes one photo, lays a film frame over it, and hands it back. Precisely: **inside the browser only**. The photo is never transmitted anywhere. EXIF, canvas work, and saving all finish on the visitor's device.

## Three rules

**1. The photo never leaves the browser.** EXIF is read locally with `exifr`, and compositing happens on `<canvas>`. With no server, there is nowhere for the original to be left behind. The output resolution follows the original. For four-cut output the cap is 7200px (about 10 MP); anything larger is redrawn at 4096 → 3072 → 2048px in turn, because canvas limits differ between browsers and the steps keep a single failure from ending the run.

**2. The EXIF text is never edited.** Once I fixed this rule, the code changed with it. Camera maker strings are not normalised. `SAMSUNG` stays `SAMSUNG`, because lowercasing it turns original information into information I invented. So the device line in `Clean Horizon` stopped rendering text and started placing **a brand emblem plus the model name**. The source string stays as it is; only the way it is shown was refined.

**3. Output at the original resolution.** Preview light, save at full size. That is also why the pixel count of the result sits next to the save button at all times.

## Thirteen frames

The frames divide into eleven single-cut and two multi-cut presets.

| Group | Frames |
| --- | --- |
| Eight originals | Clean Horizon, Classic Gallery, Dual Deck, Strap Bar, Film Sprocket, Studio Dark, Minimal Edge, Pro Studio |
| Three newer single-cut | Instant Polaroid, Frosted Glass, Editorial Cover |
| Two multi-cut | Contact Sheet, FYRA 04 |

The multi-cut presets sit at the end of the list. Working with one photo and working with four are different flows, and mixing them into the same row means someone picks the four-slot layout by accident.

![The Shutterplate editor: Clean Horizon on the canvas at left, the EXIF inspector at right, the thirteen-frame library along the bottom](/diary/assets/images/shutterplate-editor.png)

## FYRA 04

`FYRA 04` binds four cuts into a single strip of film. The name comes from the word for four, and pressing the frame again opens six themes.

| Theme | Character |
| --- | --- |
| Classic Strip | The orthodox four-cut with white margins |
| Nordic Grid | A grid with generous margins |
| Dark Studio | Photos floating above a dark ground |
| Film Strip | A film strip with sprockets |
| Editorial Grid | Laid out like a magazine page |
| Minimal Twin | A minimal 2×2 |

The four slots fill in order, and you can replace a slot or swap positions with `⇄`. Choosing a multi-cut hides the standard slot UI and raises a `▦ 4` floating control at the bottom right. The `4-CUT` badge stays at the top right; only the theme label that opens on a second press moved to the bottom left, because two pieces of information in one corner leave you unsure which one to press.

Sprocket holes line up **against the edge of the photo** in both the single-cut and the `FYRA 04` strip. Holes pasted on top of the frame can be pretty, but they do not read as film.

![FYRA 04 in Navy & Lavender dark mode, four cuts bound into one film strip](/diary/assets/images/fyra04-frames.png)

## Type is part of the frame too

Caption and photographer slots split into `frame default | custom`. Custom offers a sans, a serif, a mono, and a script face, with bold and italic. The EXIF figures (aperture, shutter, ISO) keep their font, though: shooting data is a record, not a design element.

## Verification and what remains

1,460 tests passed at the point the build was promoted to the regular release: all thirteen frames, four-cut compositing, the resolution fallback, and caption rendering.

- Saving on iOS Safari and in the Android KakaoTalk in-app browser still needs a check on real devices. In-app browsers sometimes block `data:` URL downloads, so there is a separate workaround path.
- Script captions depend on one external font. Producing the same result offline means shipping the font with the app.

What I learned most from building a photo app was not a feature list but an order. Set the rule that the original stays untouched first, and after that you can add as much decoration on top as you like.
