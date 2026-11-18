---
title: "PKPilot0001 and 0002: A Photo Studio Inside the Device, and a Fair Midpoint"
date: 2026-11-11
category: Devlog
summary: "An EXIF photo app that never uploads a picture, and a meeting-point finder that weighs driving and transit. Two opposite apps that kept running into the same question."
tags: [pkpilot, photos, exif, map, devlog]
lang: en
layout: post
---

The first two apps in the PKPilot series are opposites. One **quietly collects** photos; the other **measures the distance** between two people. Building them, though, I kept hitting the same question. Does this app really need a server?

## PKPilot0001 · Photos

The first rule for the photo app was that a picture never leaves for anywhere. Photos are handled inside the browser and the library is stored as Base64 in `localStorage`. No server, no account, no destination for a photo to travel to. The add button puts one image into the on-device library and nothing more. The flip side is that clearing browser storage clears the photos with it.

The layout follows the grain of the iOS Photos app. Photos are grouped by year, month, and day, and tapping one shows the original together with its EXIF. Camera and lens, aperture, shutter, ISO, and capture time sit beside the photo, and the picture looks a little more like a photograph for it.

Splitting guests from members was another decision this app made. A guest can browse the library and read EXIF; adding, editing, and the private album open with membership. Authentication is a single passcode rather than an account, because the moment you attach a membership system to a toy project, the maintenance doubles.

![The PKPilot0001 library in Soft Iris, with year/month/day views and the guest notice](/diary/assets/images/pkpilot0001-photos.png)

The remaining work is obvious. `localStorage` is per device and not especially roomy, and when you change phones the photos do not come along. Moving to server-side storage is the next task, deliberately left there.

## PKPilot0002 · Midpoint

The midpoint app is the opposite: calculation is the whole app. Give it two or more starting points and it finds the meeting place that is as fair as possible to everyone. How you define "middle" decides the character of the app.

- **Driving** is measured on road distance. A straight-line midpoint can put the meeting point on the far side of a mountain.
- **Transit** treats stations and terminals as candidates and compares how far each origin has to travel to reach them.
- The driving mode has a `[🎯 Exact center | 🛣️ IC & rest stop]` toggle. Under 50 km the exact center is the default; over longer distances, interchanges and rest areas come up as waypoint candidates.

The result screen reports a fairness score. It rates the largest gap between origins, so a smaller spread scores higher. The two origins in the screenshot sit 164 km and 165 km away — an 818 m spread, a fairness score of 100.

![PKPilot0002 on desktop: origins and mode on the left, Naver Maps and candidate points on the right](/diary/assets/images/pkpilot0002-midpoint.png)

On mobile the same information is split into a three-step bottom sheet. Mini (134px) shows as much of the map as possible, half (48dvh) shows the summary and one candidate, and full (80dvh) shows the whole candidate list. The sheet steps by dragging as well as by button.

![Mobile, half state: the fairness score of 100 and a candidate station over the map](/diary/assets/images/pkpilot0002-mobile-half.png)

## When immediacy becomes the feature

On a map app, waiting is failure. So the performance work mattered as much as the features.

- Reverse geocoding results are cached for 7 days, and nearby places (POI) for 30 minutes.
- Searches time out after 8 seconds so a stalled request cannot hold the screen hostage.
- Adding an origin refreshes the map and the summary immediately — 78 ms measured, close to zero by feel.

On top of that I added Naver and Kakao rating badges and sorting by recommendation and by distance. A map app is only finished when the user can get past "where is the middle" to "so where do we meet". 146 unit tests pass.

## What the two apps left open

- The photos still live only on the device. Syncing across devices is a question of where the storage lives, and adding features while that decision is deferred only makes it harder to move later.
- On the map app, caching is performance. The next question is how long to keep showing the last result seen while offline.
