---
title: "PKPilot0008: A Portable ZIP, and an App Shell That Fills the Viewport"
date: 2026-11-18T17:40:00+09:00
category: Devlog
summary: "Hash-addressed ZIP export for a Markdown document (posts/ plus assets/), and a 100vw × 100dvh shell with independent scroll panes. Also: the About page learned to say what the lab actually does."
tags: [pkpilot, markdown, jszip, sha-256, css, devlog]
lang: en
layout: post
---

PKPilot0008 is the Markdown viewer that was split out of this diary: open a `.md`, paste text, load from a URL, and read it as GFM. Two changes landed on it the same day. One is about **what the app hands back** — a `.zip` that a document can travel in. The other is about **what the app itself is** — a shell that fills the window instead of a page that scrolls.

## Part 1 · Export that survives the trip out

Reading Markdown is easy until the document has images. Copy the text and the pictures stay behind; save as HTML and you get one file with base64 weight inside it. What is actually portable is a folder.

So `ZIP 저장` builds this from the document currently open.

```text
{slug}-{hash8}.zip
├── posts/
│   └── {slug}-{hash8}.md
└── assets/
    ├── {hash12}.png
    └── {hash12}.jpg
```

`{hash8}` is the first eight hex characters of the SHA-256 of the **final markdown after image paths have been rewritten**, and `{hash12}` is the first twelve of the SHA-256 of the **image bytes**. Both names are content addresses rather than guesses.

- The same image appears once however often a document references it, because identical bytes hash to the same name.
- A changed document produces a different file name, so two exports never argue about which is newer.
- Two files called `image.png` from different folders cannot collide, and no filename has to be sanitised.

SHA-256 comes from `crypto.subtle.digest`, with a pure-JS fallback for pages served over plain HTTP or from `file://`, where `crypto.subtle` is unavailable. The fallback was checked against Python's `hashlib` at the empty string, at the 55, 56, and 64-byte block boundaries, and on eight PNG samples.

### Three ways an image gets in

- **`data:image/…;base64`** is decoded directly out of the document.
- **`http(s)` and relative paths** are fetched. If CORS blocks the read, the original URL stays in the body and the completion toast reports how many images were left out.
- **Local files** opened alongside the document — the file input takes `multiple` and `image/*`, and files can be dropped anywhere on the window. They are matched by file name and relative path, previewed immediately through `blob:` URLs, and placed into `assets/`.

Only real image references are touched: `![alt](url)` with an optional title, and `<img src="...">`. Anything inside a fenced code block or inline code is left exactly as written, because a document about Markdown is full of examples that look like images but are not.

JSZip 3.10.1 is vendored as `js/vendor/jszip.min.js` and loaded with the page rather than from a CDN — the rest of the site works offline and this should not be the one thing that does not.

### One regression, mine

The ZIP shipped, then a check of the other export path found a defect I had introduced. To preview local images, the body had been rewritten to `blob:` addresses; `HTML 저장` then saved those addresses into the file, so images broke outside the browser session. The fix remembers the original path in `data-origin-src` and writes local files back by that name at export time, and rewrites relative paths in URL-loaded documents to absolute ones. That went out as a second PR, and the live checks were run again from scratch.

Verification: 74 local browser checks covering base64, local files, CORS success and failure, relative and root-relative paths, SVG, duplicate elimination, code-fence protection, frontmatter preservation, and archive contents — the name inside `posts/` really does equal the hash of the bytes inside it. Then 20 live checks on the deployed site, including a real post from GitHub with three images.

## Part 2 · 100vw × 100dvh: the page becomes a shell

The viewer had been a website: a shell capped at 1344px with 96px side padding, a heading, an explanation, a notes block, a footer, and the document somewhere in the middle. Fine for reading one file; wrong for handling documents all day. The heading and notes pushed the main content down, and the window itself scrolled, so the toolbar left the screen the moment you started reading.

It is now an app shell.

- `.shell`'s width cap and side padding are gone; the frame runs edge to edge.
- `body` is `height: 100dvh; overflow: hidden` in a column flex (with a `100vh` fallback for older browsers), so the window never scrolls.
- Four bands stack at the top: the 52px slim header (brand, `?` help, Web-HQ), then `io-bar`, `url-bar`, and `doc-bar`. Below them `.doc-layout` takes every remaining pixel with `flex: 1; min-height: 0`.
- Measured at 1440×900: 52 + 134 + 714 = 900, `window.scrollY` stays 0, and there is no overflow on either axis. At 1919×992 in a real browser: 52 + 134 + 806 = 992.

`min-height: 0` is the small line that makes it work. Without it, a flex child refuses to shrink below its content and the layout pushes past the viewport.

### Two scroll panes, and code that no longer assumes `window`

The table of contents and the document now scroll independently: `.toc` and `.doc` each get `overflow-y: auto` with `overscroll-behavior: contain`, and the TOC header stays fixed while only the list moves.

That change invalidated code assuming a page scroll, so `app.js` was rewritten around the new container:

- Clicking a TOC entry measures against `.doc` and lands the heading 14px below the panel top, preventing the default anchor jump so the `#md=` share hash is preserved.
- The scroll spy uses `IntersectionObserver` with `root: .doc`, plus a position-based decision, so a long document highlights exactly the section clicked and scrolls the TOC itself when the active entry falls outside the visible list.
- A `Back to top` button appears in `doc-bar` after 320px of scroll and returns `.doc` to 0.
- Opening a new document resets both panes.

Reading width is handled separately from the frame: backgrounds and borders run to the viewport edge, while the text column inside `.doc-inner` is capped at 960px and centred. `overflow-wrap` moved from `anywhere` to `break-word`, which stopped inline code from breaking mid-identifier into unmatched fragments.

### The help that used to push the page

The old `.page-head` line and the three notes blocks (CORS, ZIP, share links), plus the footer, moved into a `?` dialog in the header. It opens on demand, closes with Esc, and no longer occupies vertical space. The page still has its `<h1>`, visually hidden, for structure.

### Verification, including the parts that usually break

Printing is the classic casualty of a fixed-height layout, so `@media print` unwinds it: `height: auto; overflow: visible; display: block` on the html, body, layout, and document. In print media the document measured 1521px against a 900px viewport and came out as two A4 pages with nothing clipped.

Everything else was checked for regressions on the live site: opening a file, pasting, loading a GitHub `raw` URL, ZIP export, HTML save, restoring a `#md=` share link, and the light/dark toggle. Mobile: no horizontal overflow at 320, 390, 768, or 844×390, and the TOC drawer opens, navigates, and closes itself. Console errors: zero.

## Part 3 · The About page stops being a brochure

The same week, `/about/` on Web-HQ was rewritten. It had existed as a page only since the navigation rebuild, and it still read like a description of a design studio. Its opening line is now **"Beyond Dimensions, Built for Real."**, over a lab statement rather than a slogan: AI systems, computer vision, and workflow automation converging into production software.

Three paragraphs carry the story.

- **One builder, amplified by AI.** — work that used to need a team, from CAD parsers to browser-native image studios to multi-agent pipelines, can now be designed, tested, and shipped end to end.
- **Built to be used, not just shown.** — every project starts from real friction: zero-server EXIF frames, local-first Markdown publishing, transit-aware meeting points, monitors that run unattended.
- **Open by default.** — code, architecture decisions, failures, and notes live together, so each shipped system becomes the ground for the next.

The four hub descriptions were rewritten to match what each hub actually holds, the contact block became an invitation to technical collaboration, and the meta, Open Graph, and footer copy now repeat the same phrase as the hero. The artwork above it was swapped twice in the same afternoon, which is a reminder that a headline is easier to get right than an image.

## What this pair of changes has in common

A viewer that only displays Markdown is a page. A viewer that can take a document in, keep it, hand it back as a portable folder, and fill the window while doing it is a tool. The ZIP work asked *what leaves this app*; the shell work asked *what this app is while the document is open*. Neither is a feature, and both changed how the app feels to use.
