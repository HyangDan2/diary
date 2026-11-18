---
title: "The Cheapest Way to Put an Editor on a Static Site"
date: 2026-11-10
category: Architecture
summary: "Write in the browser with no server, then hand the post to GitHub's commit URL. The structure behind it, and what it costs."
tags: [eleventy, github-pages, editor, architecture]
lang: en
layout: post
---

> **Note, as of 2026-11-18:** this post predates the move of the diary into its own `HyangDan2/diary` repository and the separation of the `/diary/write/` editor (now PKPilot0007 and PKPilot0008).

The first decision I made when starting another blog was **not to run a server**. Every thing you have to look after is something you eventually stop looking after. The browser does the work instead, and GitHub provides the repository and the hosting.

## Structure

```text
HyangDan2.github.io/
├── index.html            # Web-HQ (static)
├── diary-src/            # Eleventy source
│   ├── index.njk         # /diary/
│   ├── categories.njk    # /diary/categories/<slug>/
│   ├── write.njk         # /diary/write/  (client-side editor)
│   ├── posts/*.md        # the posts
│   └── assets/
├── .github/workflows/deploy-pages.yml
└── (the other hub directories)
```

The build has two stages. Eleventy turns `diary-src/` into `_site/`, and the workflow drops that output next to the repository's static files under `/diary/`.

## Why no server is needed

Writing a post needs three things: input, preview, storage.

| Function | Implementation | Cost |
| --- | --- | --- |
| Input | `<textarea>` plus a Markdown parser | 0 |
| Preview | Render immediately with the same parser | 0 |
| Draft storage | `localStorage` | 0 |
| Final storage | GitHub's web commit URL | 0 |

GitHub accepts `filename` and `value` as query parameters on a `new/<branch>/<path>` URL. In other words, you can **open the empty-file screen with the content already filled in**.

```js
const url = `https://github.com/HyangDan2/HyangDan2.github.io/new/main/diary-src/posts`
  + `?filename=${encodeURIComponent(filename)}`
  + `&value=${encodeURIComponent(markdown)}`;
window.open(url, '_blank', 'noopener');
```

The writer sees a prefilled file and presses `Commit changes`. No server, no token, no upload UI.

## What it costs

It is not free. I accepted three trade-offs.

- **Long posts do not fit in a URL.** When the browser's URL limit is reached, the editor falls back to downloading a `.md` file.
- **Drafts live only on one device.** To continue on another machine, you have to move the file yourself.
- **The commit is a human click.** Publishing is not automatic — which is also the safety catch.

> Automation is convenient, but the last confirmation should be pressed by a person. That goes double when the post lands in a public repository.

## A post's front matter

Every post opens with the same six lines, and the editor writes exactly this shape.

```yaml
---
title: "The Cheapest Way to Put an Editor on a Static Site"
date: 2026-11-10
category: Architecture
summary: "Write in the browser with no server, then hand the post to GitHub's commit URL."
tags: [eleventy, github-pages, editor]
layout: post
---
```

The default taxonomy is `Devlog`, `Architecture`, `Troubleshooting`, and `Notes`. An unfamiliar value becomes a new category on its own at build time.

## Closing

The strength of this structure is that **failures are easy to undo**. If the build breaks, reset to the previous commit; if a post is wrong, fix it on GitHub. With no server, there is nothing to fall over at three in the morning.
