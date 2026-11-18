---
title: "Solver and the Markdown Tools: A Reading App, and Why Writing Left the Diary"
date: 2026-11-17
category: Devlog
summary: "PKPilot0005 reads a problem and lays out a step-by-step solution. PKPilot0007 Editor and 0008 Viewer take writing out of the public diary. What both narrowed was the one job an app has to do."
tags: [pkpilot, solver, markdown, devlog]
lang: en
layout: post
---

This post covers two groups of apps. One is **PKPilot0005 Solver**, which reads a problem and produces a worked solution. The other is **PKPilot0007 Markdown Editor** and **PKPilot0008 Markdown Viewer**, built by taking writing out of the diary. What the two have in common is narrowing down "what this app really has to do".

## PKPilot0005 · Solver

Solver reads a problem and builds a solution. Input arrives three ways: pasted text, a dragged screenshot, or a clipboard paste. The problem type is detected automatically by default, and multiple choice, short answer (written), coding/debugging, and language questions can be chosen by hand. In the extra-hints field, a range like "grade 10 maths, linear equations" makes the reading noticeably more accurate.

The result screen does not just give the answer.

- **Answer card** — the chosen option and a one-line check
- **Step-by-step solution** — each step: transposition, simplification, coefficient arithmetic, verification, and the options
- **Option elimination** — why each wrong option is wrong
- **Key points** — where this problem type usually falls apart
- **Copy the answer / solve another**

![PKPilot0005 Solver: input on the left, step-by-step solution on the right](/diary/assets/images/solver-desktop.png)

For now **demo mode** is the default. The solution is computed inside the browser; connecting a real model means entering a gateway address under `[API connection]`. The real-model path was designed to go through `/api/solver/solve` on a personal server and is not connected yet — front end first, back end attached afterwards. Solution history stays in browser storage only.

## Why writing left the diary

`/diary/` originally carried a static editor: write, preview, then hand off to a GitHub commit URL. It was the cheapest way to write without a server, and that judgement still holds. What grew awkward was having the public reading pages and the writing page on the same site.

- A reader has no use for a write button.
- The writing screen handles tokens, and sharing a page with the reading side widens the room for a mistake.
- As the editor grew, code unrelated to the diary build kept touching the diary repository.

So the direction changed: **`/diary/` stays a place to read.** The write links in the header, the buttons, and the footer of posts were all removed, and `/diary/write/` was closed. The writing tools moved out into apps of their own.

## PKPilot0007 · Markdown Editor

The editor speaks GFM. The screen has three tabs — edit, split, preview — and split shows the same document on both sides at once. The toolbar carries headings (H1–H3), bold, italic, strikethrough, code, quote, lists, links, images, and tables, with a shortcut cheat sheet underneath. Preview is filtered through DOMPurify, so a script mixed into a document never runs on screen.

![PKPilot0007 Markdown Editor: editing at left, preview at right, and the Diary publish panel below](/diary/assets/images/markdown-editor.png)

What was added this time is the **load-and-edit** flow. An editor that can only start a new post is half an editor.

- **Open a local file** — pick a `.md`, `.markdown`, or `.txt`, or drop one anywhere on the screen. UTF-8 is tried first, then EUC-KR.
- **Front matter split** — the YAML block is parsed to fill title, category, date, slug, tags, and summary into the form, and only the body goes into the editor. The category keeps the spelling in the file (`Architecture` is not lowercased).
- **Load a post from the repository** — the `diary-src/posts` listing comes from the GitHub API, newest first, and a pick opens immediately. The file bar then shows an `editing` badge and a `[Switch to new post]` button.
- **Overwrite commit** — the original `sha` is read first and sent with the PUT. On success the new `sha` from the response updates the state, so the next edit updates the same file. If the original is gone (404), nothing is overwritten and a notice is shown instead.

A PAT is entered once and then `[Commit]` is the whole action. The token stays in browser `localStorage` and never goes to a server. Export comes in four forms: download `.md`, copy Markdown, copy HTML, and save standalone HTML.

## PKPilot0008 · Markdown Viewer

The viewer is the other side of the tool. Open a `.md` file, paste text, or load from a URL, and it reads as GFM. A table of contents sticks to the left, every code block has a copy button, and printing and PDF saving are supported.

![PKPilot0008 Markdown Viewer: table of contents at left, document in the middle, file/URL/paste inputs on top](/diary/assets/images/markdown-viewer.png)

Share links work with no server: the whole document is compressed into the URL hash.

```text
https://hyangdan2.github.io/PKPilot0008/#md=<compressed document>
```

The document is compressed with LZString into a URI-safe string. One link carries an entire document, though a long one runs into URL length limits — for big documents, sending a file is better.

Loading from a URL depends on CORS: a file on another site opens only if that site allows it. GitHub's `raw.githubusercontent.com` does not open CORS, so posts in a repository are fetched through the API path instead.

## Closing

Put reading and writing on one page and both become awkward. Reading should be light; writing should be a tool. Solver followed the same principle: reading, solving, and history on one screen, with a boundary drawn so a model can be attached behind it later. Drawing boundaries lasts longer than adding features.
