# HD2's Diary

**HD2's Diary** — the HD2Lab build log. Devlog, Architecture, Troubleshooting, Notes: what I made,
why it works, and what broke on the way.

[Live website](https://hyangdan2.github.io/diary/)

This repository is the diary's own home, separate from
[`HyangDan2/HyangDan2.github.io`](https://github.com/HyangDan2/HyangDan2.github.io) (Web-HQ).
The URLs are unchanged: this repository is published as a **project page** under `/diary/`, so the
repository root *is* `https://hyangdan2.github.io/diary/`.

## Layout

```
index.html            /diary/                    (built)
search.json           /diary/search.json         (built: the search index)
posts/<slug>/         /diary/posts/<slug>/       (built)
categories/           /diary/categories/…        (built)
assets/               /diary/assets/…            (built: css, js, favicons, post images)
diary-src/            Eleventy source — posts, templates, styles
build.mjs             build diary-src/ and publish it into the repository root
.nojekyll             serve the committed files as-is (no Jekyll processing)
```

Everything at the root except `diary-src/`, `build.mjs`, and the dotfiles is **generated**. Edit
`diary-src/`, then rebuild — never hand-edit the published HTML.

## Build & publish

```bash
npm ci --prefix diary-src     # first time only
npm run build                 # Eleventy -> diary-src/_site, then copied to the repo root
npm run serve                 # local preview at http://localhost:8080/diary/
```

`npm run build` replaces the published `index.html`, `posts/`, `categories/`, and `assets/`, so a
deleted or renamed post also disappears from the site. After building, commit both sides:

```bash
git add -A && git commit -m "post: <title>" && git push
```

GitHub Pages (`Settings → Pages → Deploy from a branch → main / (root)`) serves the committed
files. Because `.nojekyll` is present, no Jekyll build runs — the HTML, `_data/`, and
`_includes/` under `diary-src/` are served exactly as committed.

## Writing a post

Add one Markdown file to `diary-src/posts/`:

```yaml
---
title: "제목"
date: 2026-11-18
category: Devlog          # Devlog | Architecture | Troubleshooting | Notes | anything new
summary: "한두 문장 요약"
tags: [eleventy, github-pages]
layout: post
---
```

The file name becomes the URL (`2026-11-18-my-post.md` → `/diary/posts/2026-11-18-my-post/`), and a
new `category` value becomes a category page of its own at build time. Images go in
`diary-src/assets/images/` and are referenced from Markdown as `/diary/assets/images/<file>`.
The sibling Markdown editor at `https://hyangdan2.github.io/PKPilot0007/` commits posts to this
repository through the GitHub API.

## Search and tags

There is no search service. Every build writes `search.json` (title, summary, category, tags,
date, url and a `keywords` blob of subheadings plus the opening of each post — roughly 12 KB), and
`diary-src/assets/diary-search.js` filters it in the browser.

- **Home (`/diary/`)**: the search box sits above the recent list; while a query or a category
  chip is active, the list switches to matching posts from the whole index.
- **Category pages**: the same box filters the rows already on the page, so it only searches
  inside that category.
- **Tag chips**: every list row ends with its `#tags`. Pressing one drops `#tag` into the search
  box (pressing it again removes it) and the list narrows immediately. A `#tag` term matches the
  tag exactly; free words match title, summary, category, tags, and keywords, all terms at once.

`Enter` opens the top match, `Escape` (or the `×`) clears the search.

## Theme and navigation

The shared HD2Lab light/dark theme (`hd2-theme.css`, `hd2-theme.js`), favicons, and the
`Diary` stylesheet all live in `diary-src/assets/`, so this site needs nothing from Web-HQ to
render. The header still links out to Web-HQ (`/`), Apps, Play, Tech, and About — those pages
belong to the `HyangDan2.github.io` repository.
