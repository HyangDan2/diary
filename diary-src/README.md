# HD2's Diary (diary-src)

Eleventy source for **HD2's Diary** — the devlog published at
`https://hyangdan2.github.io/diary/` from the sibling repository
[`HyangDan2/diary`](https://github.com/HyangDan2/diary).

Everything in this folder is built into `_site/`, and then copied to the repository root, which is
what GitHub Pages serves.

## Commands

```bash
cd diary-src
npm ci               # once (outside this repo: `npm ci --prefix diary-src`)
npm run build        # writes _site/  (Eleventy)
npm run serve        # local preview at http://localhost:8080/diary/ (pathPrefix /diary/)
```

Local preview is served under the `/diary/` prefix, so `npm run serve` opens the diary at
`http://localhost:8080/diary/`.

## Writing a post

The site is **read-only**: there is no writing page. A post is one Markdown file in `posts/`,
written either by hand or in the sibling Markdown editor at `/PKPilot0007/` (its
*Diary 발행 · GitHub 커밋* panel fills this frontmatter and commits the file through the GitHub API).

By hand, create `posts/<YYYY-MM-DD>-<slug>.md`:

```yaml
---
title: "제목"
date: 2026-11-16
category: Devlog          # Devlog | Architecture | Troubleshooting | Notes | anything custom
summary: "한두 문장 요약"
tags: [eleventy, github-pages]
layout: post
---
```

`posts.11tydata.js` fills in the permalink (`/posts/<file-name>/`) and the category name/slug, so a
post never needs those in its frontmatter. A brand-new category value automatically appears as its
own category page and card.

## Structure

```
eleventy.config.js       markdown-it + highlight.js, filters, collections
lib/utils.js             slug/date helpers
lib/categories.js        the four default categories
_data/site.js            site name, repo, post directory
_includes/base.njk       header (HD2Lab | HD2's Diary), footer, shell
_includes/post.njk       post layout
_includes/parts/…        post list + empty state macros
index.njk                /diary/          category cards + recent posts
categories-index.njk     /diary/categories/  all four drawers
categories.njk           /diary/categories/<slug>/
posts/*.md               the posts
assets/diary.css         diary theme (mirrors Web-HQ tokens)
assets/hd2-theme.css/js  shared HD2Lab light/dark toggle
assets/favicon*          favicons (self-contained copy)
assets/images/           post screenshots
```

## Deploy

The repository publishes through the **legacy branch build** (Settings → Pages → Source:
Deploy from a branch, `main` / root), which serves the committed files as-is; `.nojekyll` in the
repository root turns Jekyll off. There is no workflow in the repo: the GitHub App used here cannot
push files under `.github/workflows/` (`without workflows permission`).

So the build output is **committed** at the repository root. After adding or editing a post, run
the root build and push both sides:

```bash
node build.mjs                      # or: npm run build   (from the repository root)
git add -A && git commit -m "post: …" && git push
```

`build.mjs` runs `eleventy` here, then replaces the root `index.html`, `posts/`, `categories/`, and
`assets/` with the fresh `_site/` contents — the published URLs (`/diary/`, `/diary/posts/…`,
`/diary/categories/…`, `/diary/assets/…`) stay exactly the same. `_site/` and `node_modules/` are
in `.gitignore`; the root output is committed.
