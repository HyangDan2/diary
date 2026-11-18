---
title: "One Header for Five Sites: Tabs, a Drawer, and the Diary Accordion"
date: 2026-11-18
category: Architecture
summary: "Web-HQ, the three hubs, and the Diary each had their own navigation. One title bar with tabs removed the scrolling, and one mobile drawer with a Diary accordion removed the guessing. Two rebuilds, thirty minutes apart."
tags: [navigation, design-system, accessibility, css, architecture]
lang: en
layout: post
---

Web-HQ, ApplicationHub, GameHub, TechnicalHub, and HD2's Diary. Five sites of the same service, with five different navigations. Moving between hubs meant scrolling to the bottom of a page to find a row of cards or links, and About was a modal rather than a page, so it had no address, no back button, and no search presence.

This work fixed **how you move**, not how a page looks. One title bar sits above the page, and on narrow screens the same list folds into a drawer on the right. It took two rebuilds, and the second was put up thirty minutes after the first.

## The problem: navigation lived inside the content

| Site | Previous navigation | Cost of moving |
| --- | --- | --- |
| Web-HQ | Header held a `Diary ↗` link and an `About` button; hubs were cards below the hero | Scroll to switch hubs |
| ApplicationHub | A row of links inside the hero | Wording and order differed per page |
| GameHub | Same | Same |
| TechnicalHub | Same, and the four profile pages had yet another set of links | Same |
| HD2's Diary | Brand plus a single `HQ ↗` link | One way out of the Diary |

Layered on top of that: About was a modal (`#about-dialog`). It opened only on a click, left no address behind, made the back button close the page, and could not be found by search. Presenting the introduction as a "dialog" looked lightweight at first, but it was the wrong container for the face of the site.

## Direction: one bar above the page, one layer on narrow screens

Three decisions.

- **Tabs in a title bar on desktop.** `Web-HQ · Apps · Play · Tech · Diary · About` in the same order everywhere, with the current place highlighted. The header is `position: sticky`, so it survives scrolling.
- **On mobile, `≡` at the upper right opens a right-hand sliding sidebar.** The same list, stacked, with the current item marked by a left accent bar.
- **Only one site has a submenu: the Diary.** It has four categories (Devlog, Architecture, Troubleshooting, Notes) and five drawer entries (Top plus the categories), so only that row got one level of depth — an accordion on mobile, a dropdown on desktop.

What matters is the contract, not the appearance. All six routes use the **same class names**: `.nav-tab`, `.nav-dropdown`, `.drawer-item`, `.drawer-group`, `.drawer-toggle`, `.drawer-sub`. With the same names, one stylesheet and one script run everywhere, and one fix propagates.

## First pass · Tabs on top, About as a page (PR #69 · `7c04064`)

The first PR added the title bar and the drawer, and moved About to its own page.

- **The `Explore the hubs` button was removed from the Web-HQ hero.** With a route to the hubs in the title bar, the hero had no reason to ask again.
- `About` became a real page at `/about/`, carrying the introduction, the founder, why the space exists, the four hubs, contact, and the logo, using the same tabs and drawer (About active).
- Old links were kept alive: entering with `?about=1` or `#about` redirects to `/about/`. Three lines to avoid breaking addresses that exist elsewhere.

```js
if (/[?&]about=1(&|$)/.test(location.search) || location.hash === '#about') {
  location.replace('/about/');
}
```

- The Diary's `base.njk` received the same tabs and drawer. Before, there was a single `HQ ↗` next to the brand, so there was effectively no way out of the Diary to another hub.
- While the sidebar is open, the floating theme toggle is hidden. A circle hovering over the drawer reads as one more button that cannot be pressed.

```css
body.drawer-open { overflow: hidden; }
body.drawer-open .hd2-theme-toggle { opacity: 0; pointer-events: none; }
```

The same specification went to the three hubs as separate PRs (ApplicationHub #20 · GameHub #11 · TechnicalHub #17). The hubs share one `js/nav.js`, and TechnicalHub got the same markup on both the hub and its four profile pages.

ApplicationHub's PR carried one small repair as well. When PKPilot0001, 0002, 0003, and 0006 moved to separate repositories, four evidence links in its catalogue had become 404s, and the link checker (`check-links`) caught them. Fixing navigation also revived four dead links next door.

![About went from a modal to /about/: same tabs and drawer, with the About tab active](/diary/assets/images/2026-11-18-nav-about-page.png)

## Second pass · One line per item, one level for the Diary (PR #70 · `016d177`)

With the first pass live, looking again at the screen showed the mobile drawer was heavy. Every entry was a card with a meta line like `00 / HQ` and a descriptive sentence, so each took two or three lines; six entries filled half the sidebar with prose. What a navigation list needs is not description but **a place to press**.

### Mobile drawer — a 46px single-line list

The card boxes and the meta and description lines came out, and each entry became a single 46px row. The order is fixed at `Web-HQ · Apps · Play · Tech · Diary · About` on every site, with the current entry marked by background and a left accent bar. 46px is a comfortable thumb height and the value that fits six entries on one screen without scrolling.

### Diary accordion — a link and a toggle sharing a row

The Diary has four categories and five drawer entries, so making the whole row a link would leave no way into the submenu. The row was split in two: **a link to `/diary/` on the left, a 44×44 expand toggle on the right**.

```html
<div class="drawer-group is-open">
  <div class="drawer-row">
    <a class="drawer-item is-current" href="/diary/" aria-current="page">Diary</a>
    <button class="drawer-toggle" type="button"
            aria-expanded="true" aria-controls="drawer-diary-sub">…</button>
  </div>
  <div class="drawer-sub" id="drawer-diary-sub">
    <div class="drawer-sub-inner">
      <a class="drawer-subitem is-current" href="/diary/" aria-current="page">Top</a>
      <!-- Devlog · Architecture · Troubleshooting · Notes -->
    </div>
  </div>
</div>
```

- Inside the Diary it is **expanded by default**. Making someone who moves between categories open a collapsed menu every time is one more chore.
- The category currently in view is highlighted in the sub-list with `aria-current="page"`. On any site, the Diary link resolves the current section and marks it.
- Expansion animates with `max-height`, immediately when `prefers-reduced-motion` is set.

```css
.drawer-item   { min-height: 46px; }
.drawer-toggle { width: 44px; height: 44px; }
.drawer-sub {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  visibility: hidden;
  transition: max-height .3s cubic-bezier(.22, 1, .36, 1), opacity .2s,
              visibility 0s linear .3s;
}
.drawer-group.is-open .drawer-sub {
  max-height: 340px;
  opacity: 1;
  visibility: visible;
  transition: max-height .3s cubic-bezier(.22, 1, .36, 1), opacity .2s,
              visibility 0s linear 0s;
}
```

A collapsed sub-list was not removed with `display: none`, because the transition needs it present. While collapsed it must also leave the tab order, so the hub script sets `inert` and `aria-hidden` on the sub-list, and the Diary and Web-HQ achieve the same with `visibility: hidden`. If focus lands on an invisible link, a keyboard user loses track of where they are.

![The mobile drawer: six single-line entries, with the Diary's sub-list expanded and the current category (Top) highlighted](/diary/assets/images/2026-11-18-nav-mobile-diary-drawer.png)

### Desktop — hover and focus through the same door

On desktop, hovering the Diary tab or focusing it from the keyboard opens the submenu, handled in CSS alone with no script.

Two quiet but important details sit here.

- **`visibility` is a step, not a gradual value.** Opening makes it visible immediately; only closing hides it after the fade (0.2 s). That way the moment Tab reaches the menu the links are already in the tab order, and during closing they disappear only after focus has left.
- **There is a 12px gap between tab and panel.** So that the mouse crossing that gap does not drop the hover and close the menu, an invisible 14px bridge (`::before`) sits on top of the panel.

```css
.nav-dropdown:hover .nav-dropdown-panel,
.nav-dropdown:focus-within .nav-dropdown-panel {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translate(-50%, 0);
  transition: opacity .18s, transform .2s, visibility 0s linear 0s;
}
```

The tab itself is a link. To go straight from the submenu to the Diary list, press the tab; to jump to one category, press the entry in the dropdown.

![The Diary dropdown in the desktop title bar, in dark mode, with Top marked as the current location](/diary/assets/images/2026-11-18-nav-pc-diary-dropdown.png)

## Specification

These values are shared by all six routes. Fix the numbers and the hand lands in the same place on every site.

| Item | Value |
| --- | --- |
| Title bar tab height | 38px (pill, `border-radius: 999px`) |
| Drawer row minimum height | 46px |
| Diary toggle | 44 × 44px |
| Sub-item height | 40px |
| Sub-list indent | 21px + 10px, 1px vertical rule |
| Desktop dropdown panel | 198px minimum width, 12px below the tab |
| Hover bridge | 14px |
| Tab → `≡` switch | hubs and About at 820px and below, Diary at 880px and below |

The Diary alone switches 60px higher because its brand lockup (`HD2Lab | HD2's Diary`) is longer. At the same value, the brand and the tabs collide in that band.

## Scope

- `Web-HQ` (root)
- `/about/`
- `HD2's Diary` (list, category, and post pages alike)
- `ApplicationHub`
- `GameHub`
- `TechnicalHub` — the hub and its four profile pages

## Verification

- Opened at 1440×900 and 390×844, in light and dark. 0 console errors, 0 page errors, 0 horizontal overflow.
- Hub tests now assert that drawer rows measure between 44 and 48px, that the accordion opens and closes, and that collapsed sub-links leave the tab order (ApplicationHub 19 passing, GameHub 18).
- The dropdown was checked opening on hover and on focus, and closing when focus leaves.
- Link checking (`check-links`) passes on every hub. That check is what found the four dead PKPilot links in the first pass.
- The stylesheet cache key was bumped to `v=20261118-accordion`. This repository commits its build output, so without the bump the old CSS lingers for a while.

## What I learned

- **When navigation lives inside the content, the cost of moving scales with scroll length.** The same link pinned above the page becomes "somewhere you can always go"; below the hero it is "somewhere you have to find". Moving links does more than adding them.
- **Two sets of headers will always drift.** While each site maintained its own header, wording and order diverged little by little. Share the class names and the markup structure as a contract, and the next added entry appears in the same shape in six places.
- **A link and a toggle in one row need separate roles.** The label navigates, the caret expands. Give the caret a full 44px and have it say its state with `aria-expanded`.
- **Collapsed is not gone.** Keeping a transition rules out `display: none`, which means the tab order has to be handled separately. `visibility` and `inert` satisfy both at once.
- **Hover is a bonus; focus is the baseline.** A menu that opens only on mouse hover does not exist for a keyboard user. `:focus-within` plus the `visibility` transition covers both with the same code.

Rebuilding thirty minutes after the first attempt was not wasted. Seeing it on screen once made the problem obvious, and the second version had almost nothing left to deliberate. To save those thirty minutes, though, I should have drawn the mobile screen before building it.
