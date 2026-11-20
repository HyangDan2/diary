---
title: "Naming What Went Wrong: Web UI, CSS and Layout, End to End"
date: 2026-11-20T12:40:00+09:00
category: Notes
summary: "When the bottom of a screen is clipped, the page spills sideways, or the page behind a modal keeps scrolling, we usually cannot name the symptom — so we fix the same thing over and over. Eight groups of terms and CSS essentials: viewport, spacing, page regions, controls, layers, typography and mobile quirks, written to be used in a bug report or a fix."
tags: [css, ui, layout, frontend, responsive, mobile, notes]
lang: en
translationKey: notes-web-ui-css-layout-glossary
layout: post
---

Fixing a screen almost always starts with words. "It's cut off at the bottom." "It slides off the side." "There's a button floating in the wrong place." None of those statements are wrong. They are just too wide. The same sentence can point at ten different bugs, which is why every fix ends up touching a different line.

If you build web apps for a while, you keep getting stuck in the same places: height math, safe areas, horizontal overflow, the ordering of overlapping layers, the size of a touch target, Korean line breaking. Knowing the name makes it searchable. Searchable narrows the cause. A narrow cause means one fix instead of five.

This is a note that collects those names. It is split into eight groups, and each group follows the same order: **the term → how it actually breaks → the CSS that matters → a comparison table**. They come from work on Shutterplate's frame editor, Nordlys's video workspace and TechnicalHub's document views, where these exact things came back repeatedly.

## The eight groups

| Group | Covers | Symptom you hear |
| --- | --- | --- |
| 1. Screen frame | Viewport height, safe area, overflow, breakpoints | Cut off at the bottom, spills sideways |
| 2. Placement | Flex·Grid, margin·padding·gap, position, z-index | Misaligned, elements overlapping |
| 3. Regions | Topbar·Hero·Rail·Stage·Utility bar·Drawer | Content under the header, double scroll |
| 4. Controls | Badge·Tag·Chip·Pill, toggle·checkbox·radio, FAB | Button won't press, nothing looks pressable |
| 5. Layers | Modal·Sheet·Overlay·Popover·Toast | Page behind the modal scrolls, toast hidden |
| 6. Type & theme | Tokens, keep-all, ellipsis, radius·shadow | Words break mid-word, old screen after deploy |
| 7. Mobile | 16px inputs, touch-action, in-app browsers | Page zooms on focus, no save in KakaoTalk |
| 8. Cheat sheet | Symptom → term → first check | — |

## 1. Screen frame, viewport and responsiveness

### 100vh is not the height of the screen

On a mobile browser the address bar and the bottom toolbar collapse and expand as you scroll. So there is not one "screen height". CSS splits it into three.

| Unit | Meaning | Does it change? | Where to use |
| --- | --- | --- | --- |
| `100vh` | Viewport height. On mobile it behaves like `lvh` | No (fixed at first layout) | Legacy code, desktop only |
| `100lvh` | Large viewport, toolbars **collapsed** | No | Background images, full-bleed hero |
| `100svh` | Small viewport, toolbars **expanded** | No | App frames that must always fit |
| `100dvh` | The viewport right now | Yes (on every scroll) | App shell filling the screen |

Set an app frame to `100vh` and the bottom disappears behind the toolbar. To the user that reads as "cut off at the bottom"; to us it reads as "the scroll doesn't reach the end". `100dvh` fixes that but changes value while scrolling, so on a screen with a canvas or a map the layout twitches by a frame.

In practice: the outer shell uses `100dvh`; anything whose height must not move (a fixed bottom bar, a canvas wrapper) uses `100svh` or a fixed `px` value.

```css
/* Order matters. Browsers that don't understand a line ignore it. */
.app-shell {
  height: 100vh;   /* very old browsers */
  height: 100dvh;  /* current browsers */
  min-height: 100svh;
}
```

One caveat. On iOS the software keyboard barely affects `dvh`, because the keyboard is drawn by the OS, not by the browser chrome. An input bar that must sit on the keyboard needs `visualViewport` directly.

```js
const vv = window.visualViewport;
const stick = () => {
  document.documentElement.style.setProperty('--kb', `${window.innerHeight - vv.height}px`);
};
vv?.addEventListener('resize', stick);
vv?.addEventListener('scroll', stick);
```

### Safe area — the notch and the home bar

With `viewport-fit=cover` the page extends under the notch and the home indicator. In exchange, leaving that space empty becomes our job. The values come from `env(safe-area-inset-top·right·bottom·left)`.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
/* Bottom bar: whichever is larger, the safe inset or a minimum padding */
.utility-bar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  padding-top: 12px;
}
```

`max()` is the point. With `env()` alone, a device without a home bar gets zero padding and the buttons stick to the edge of the screen. For browsers without `env()`, give it a fallback: `max(12px, env(safe-area-inset-bottom, 0px))`.

[![100vh vs 100dvh vs 100svh, and the four safe-area insets](/diary/assets/images/en/2026-11-20-ui-viewport-safe-area.png)](/diary/assets/images/en/2026-11-20-ui-viewport-safe-area.png)

### Overflow — the four usual causes of a page spilling sideways

Horizontal scroll is almost always one of these four.

1. **A fixed width** wider than the screen. A `width: 420px` card on a 390px phone overflows. Add `max-width: 100%`.
2. **A flex or grid child that refuses to shrink.** A flex item's default `min-width` is `auto`, so it never gets narrower than its content. Set `min-width: 0`. Grid needs `minmax(0, 1fr)`.
3. **`100vw` includes the scrollbar.** With a vertical scrollbar present, `100vw` is wider than the content box. Use `width: 100%`, or `scrollbar-gutter: stable`.
4. **Negative margins or absolute positioning** reaching outside the parent. Give the parent `position: relative` and `overflow: clip`.

Do not start by adding `overflow-x: hidden` to `body`. That hides the symptom and leaves the offender in place. Measure instead.

```js
const wide = [...document.querySelectorAll('*')]
  .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1);
console.table(wide.map((el) => ({ tag: el.tagName, cls: el.className })));
```

If `document.documentElement.scrollWidth > window.innerWidth`, there is horizontal overflow. Putting that single line in a pre-deploy check catches it for good.

### Breakpoints, media queries and container queries

A media query looks at **the screen** (the viewport). A container query looks at **the parent box**. If the same card component should look different in a sidebar than in the main column, media queries can only split on screen width. Container queries split on the width of wherever the card is placed.

```css
.card-host { container-type: inline-size; container-name: card; }

@container card (min-width: 420px) {
  .card { grid-template-columns: 96px 1fr; }
}
@container card (max-width: 419px) {
  .card { grid-template-columns: 1fr; }
}
```

Set breakpoints where **the layout breaks**, not at device names. Three were enough for our apps: 640px (single column), 1024px (rail becomes a sidebar), 1440px (wider stage). Splitting on `iPhone` and `iPad` just adds rules every time a device ships.

### Scroll lock and overscroll

If the page behind a modal scrolls, the user feels they are operating the page rather than the modal. `body { overflow: hidden }` is unreliable on iOS. Pinning the current scroll position is the dependable route.

```js
function lockScroll() {
  const y = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${y}px`;
  document.body.style.width = '100%';
  document.body.dataset.lockY = String(y);
}
function unlockScroll() {
  const y = Number(document.body.dataset.lockY || 0);
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, y);
}
```

`overscroll-behavior: contain` stops an inner scroll area from handing the scroll to the page when it reaches the end. Bottom sheets, drawers and code blocks all need it. On iOS, `overscroll-behavior-y: none` reduces the rubber-band bounce.

## 2. Placement, spacing and alignment

### Flexbox or Grid

Both align things, on different axes. Flexbox flows in **one direction**; Grid places across **rows and columns at once**.

| | Flexbox | Grid |
| --- | --- | --- |
| Direction | One dimension | Two dimensions |
| Sizing | Content and `flex` ratios | Track definitions (`fr`, `minmax`) |
| Typical use | Toolbars, button rows, card interiors | Page skeletons, card grids, dashboards |
| Overflow fix | `min-width: 0` | `minmax(0, 1fr)` |
| Gap | `gap` | `gap`, `row-gap`, `column-gap` |

When it is unclear, ask this: "do the children line up and share the leftover space?" — Flex. "do the children sit in defined cells?" — Grid.

```css
/* A toolbar that shares out the leftover space */
.topbar { display: flex; align-items: center; gap: 12px; }
.topbar .spacer { flex: 1 1 auto; min-width: 0; }

/* A card grid whose column count follows the width */
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
```

`justify-content` works on the **main axis**; `align-items` works on the **cross axis**. Switching to `flex-direction: column` swaps those directions. A lot of "vertical centering doesn't work" comes from reaching for `justify-content: center` while the main axis is already vertical.

### Margin, padding and gap

| Property | Where | Behaviour | Watch out |
| --- | --- | --- | --- |
| `margin` | Outside the element | Distance to neighbours; vertical margins collapse | No background painted |
| `padding` | Inside the element | Between border and content; background is painted | Needs `box-sizing: border-box` |
| `gap` | Between children | Never after the last child | Flex and Grid only |

With `li { margin-bottom: 12px }` the last row keeps its margin and the container looks bottom-heavy. `gap` removes that. Margin collapsing happens vertically, and never between flex or grid children.

```css
*, *::before, *::after { box-sizing: border-box; }

.stack > * + * { margin-top: 16px; }      /* vertical rhythm without collapsing */
.row { display: flex; gap: 8px; flex-wrap: wrap; }
```

### The five positions

| Value | Reference | In flow | Where |
| --- | --- | --- | --- |
| `static` | Default | Yes | Most things |
| `relative` | Its own original spot | Yes | Anchor for absolute children, nudges |
| `absolute` | Nearest positioned ancestor | No | Badges, close buttons, decoration |
| `fixed` | The viewport | No | Top bar, FAB, toast |
| `sticky` | The scroll container | Yes | Table headers, section headings |

When `sticky` does nothing, an ancestor almost always has `overflow: hidden` or `auto`. That ancestor becomes the scroll container, and with nothing to scroll there is nothing to stick to. `top` is also required.

```css
.panel { overflow: clip; }              /* clipping that doesn't kill sticky */
.panel-head { position: sticky; top: 0; z-index: 2; background: var(--surface); }
```

### Z-index and stacking contexts

`z-index` is not "bigger number wins". Numbers are only compared **inside the same stacking context**, and more things create one than people expect: `position` plus `z-index`, `transform`, `filter`, `opacity < 1`, `will-change`, `isolation: isolate`, `contain: paint`.

That is why `z-index: 9999` sometimes stays underneath. If the parent is already inside a lower context, a 9999 inside it cannot climb over its parent's siblings. The fix is not a bigger number but tidier contexts. Use `isolation: isolate` to keep an element's ordering local.

```css
.app { --z-topbar: 100; --z-drawer: 300; --z-modal: 400; --z-toast: 500; }

.modal { position: fixed; z-index: var(--z-modal); }
.toast { position: fixed; z-index: var(--z-toast); }
.card-stage { isolation: isolate; }   /* keep card z-index inside the card */
```

### Aspect ratio and object-fit

```css
.thumb { aspect-ratio: 4 / 3; width: 100%; overflow: hidden; border-radius: 12px; }
.thumb img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
```

`cover` fills the box and crops the rest. `contain` shows everything and leaves empty space. Photo lists want `cover`; an original-view or editor screen wants `contain`. A screen that places a photo inside a frame, like Shutterplate, mixes them: the outer box fills with `cover`, and the step where the user chooses the crop shows the whole photo with `contain`.

[![Margin·padding·gap, and how position and z-index stack](/diary/assets/images/en/2026-11-20-ui-spacing-position.png)](/diary/assets/images/en/2026-11-20-ui-spacing-position.png)

## 3. Page regions and navigation

A web app screen is usually a combination of the same regions. Once they have names, a request like "shrink the hero and grow the stage" fits in one line.

| Region | Job | Implementation note |
| --- | --- | --- |
| Topbar / Header | App name, main nav, account | `position: sticky; top: 0`, offset the body by its height |
| Hero | First-screen intro and call to action | `min-height: 60svh`, background image `object-fit: cover` |
| Sidebar / Rail | Section navigation. A rail is the icon-only narrow version | Below 1024px it becomes a drawer |
| Stage / Canvas | The actual work area | `min-height: 0` inside a flex column is mandatory |
| Utility bar / Status bar | Bottom status and tools | `padding-bottom: max(12px, env(safe-area-inset-bottom))` |
| Footer | Copyright, links | Collapse or shorten on mobile |
| Drawer | A panel that slides in from off-screen | Scrim + focus trap + close on Esc |

[![Web app anatomy: topbar, hero, rail, stage, utility bar, drawer, FAB](/diary/assets/images/en/2026-11-20-ui-page-anatomy.png)](/diary/assets/images/en/2026-11-20-ui-page-anatomy.png)

### When the topbar covers the content

A `position: fixed` top bar leaves the flow, so the body slides underneath. The usual patch is `padding-top: 64px`, which drifts as soon as the bar's height changes. Keep the height in a variable and move both together.

```css
:root { --topbar-h: 60px; }
.topbar { position: sticky; top: 0; height: var(--topbar-h); z-index: var(--z-topbar); }
main { padding-top: var(--topbar-h); }
:target, .anchor { scroll-margin-top: calc(var(--topbar-h) + 16px); }
```

`scroll-margin-top` stops a heading from hiding under the bar after an anchor jump. That matters most on document screens with a table of contents, like TechnicalHub.

### When the stage overflows its flex column

```css
.app { display: flex; flex-direction: column; height: 100dvh; }
.stage { flex: 1 1 auto; min-height: 0; overflow: auto; }
```

Without `min-height: 0`, the stage tries to keep its content height and the whole page scrolls instead. The topbar scrolls away and the bottom bar is pushed off-screen. That is usually what "there are two scrollbars now" really means.

### Drawer, accordion, tab, segmented control, breadcrumb

| Pattern | What it does | Accessibility | Commonly confused with |
| --- | --- | --- | --- |
| Drawer | Slides a panel in from off-screen | `aria-modal`, focus trap, Esc | Modal (does it fully block the background?) |
| Accordion | Expands content under a heading | `aria-expanded`, `hidden` panel | Tabs (can several be open?) |
| Tab | Swaps the content of one region | `role="tablist"`, `aria-selected` | Segmented control |
| Segmented control | A row of mutually exclusive choices | `role="radiogroup"` | Tabs |
| Breadcrumb | The path to the current page | `aria-label="Breadcrumb"`, `aria-current="page"` | Navigation menu |

Tabs and segmented controls look alike and behave differently. A tab **changes the content below**; a segmented control is **an input that picks one**. So a tab gets `role="tab"` and arrow-key movement, while a segmented control behaves like radios. For screen-reader users that difference is substantial.

### Icon names: kebab, meatball, hamburger

| Glyph | Name | Meaning |
| --- | --- | --- |
| `⋮` | Kebab | Three vertical dots = more options |
| `⋯` | Meatball | Three horizontal dots = more options |
| `☰` | Hamburger | Open the main menu |
| `⋯` with four dots | Just "four dots" | Don't |

Say "the three dots at the top right" and you will be asked again whether they are vertical or horizontal. Kebab and meatball settle it in one word. Vertical kebabs usually belong to per-card or per-row menus; horizontal meatballs to toolbars.

## 4. Buttons and controls

### Badge, tag, chip, pill

They differ by **role**, not by shape. All four can be drawn as a small rounded label, so without the names everything becomes "the badge".

| Name | Role | Clickable | Example |
| --- | --- | --- | --- |
| Badge | Count or status | No | Cart `3`, `NEW` |
| Tag | Category label | Usually no (at most removable) | `#css`, `#notes` |
| Chip | Filter or selection | Yes | `All` `Photos` `Videos` |
| Pill | A shape, not a role | n/a | Pill-shaped button or tab |

Pill names a shape; the other three name roles. Which is why "a pill-shaped chip" is a valid sentence. Refer to the role when giving instructions, and mention the shape only if it matters.

### Toggle, checkbox, radio

| Control | How many | When it applies | Where |
| --- | --- | --- | --- |
| Toggle / switch | One on-off | **Immediately** | Settings, dark mode |
| Checkbox | Several | On form submit | List selection, consent |
| Radio | One | On form submit | Delivery method, sort order |

A toggle has no save button. It applies on press, rolls back on failure, and says so in a toast. Checkboxes and radios are part of a form and need a Save. Mixing the two leaves the user unable to tell what has already been applied.

```css
.switch { appearance: none; width: 44px; height: 26px; border-radius: 999px; background: var(--track); }
.switch:checked { background: var(--accent); }
.switch::after { content: ""; display: block; width: 20px; height: 20px; margin: 3px; border-radius: 50%; background: #fff; transition: translate .18s; }
.switch:checked::after { translate: 18px 0; }
.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### Minimum touch target for icon buttons

The icon can be 20px. The **pressable area** must be at least 44×44px (Apple HIG; Material says 48dp). Growing the icon wrecks the design, so add the area as transparent padding.

```css
.icon-btn {
  display: inline-grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;          /* minimum touch target */
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.icon-btn svg { inline-size: 20px; block-size: 20px; }
```

Put an icon button in a list row shorter than 44px and users hit the row next to it. Either grow the row with padding or separate the button from the row's own click area.

### FAB — the floating button at bottom right

```css
.fab {
  position: fixed;
  inset-inline-end: 16px;
  bottom: calc(16px + env(safe-area-inset-bottom));
  inline-size: 56px;
  block-size: 56px;
  border-radius: 18px;
  box-shadow: 0 8px 24px rgb(18 18 58 / .28);
  z-index: var(--z-toast);
}
```

One FAB per screen. On a screen with a bottom bar, `bottom` must include the bar's height, or the FAB sits on top of it. On Shutterplate's mobile screen, "the bottom-right button overlaps the bar" was exactly this calculation.

[![Badge, tag, chip and pill next to toggle, icon button and FAB](/diary/assets/images/en/2026-11-20-ui-controls-comparison.png)](/diary/assets/images/en/2026-11-20-ui-controls-comparison.png)

### Slider, stepper, dropdown

| Element | Where | Watch out |
| --- | --- | --- |
| Slider (`input[type=range]`) | Continuous values (brightness, filter strength) | Show the value; unify colour with `accent-color` |
| Stepper (`−` `+`) | Integers (quantity, frame count) | Long-press to repeat; disable at the bounds |
| Dropdown / select | Five or more options | On mobile a native `select` is safest |

## 5. Overlapping layers and feedback

| Layer | Position and size | How it closes | Where |
| --- | --- | --- | --- |
| Modal / dialog | Centred, fixed width | Button, Esc, outside click | Decisions that need an answer |
| Bottom sheet | Rises from the bottom, full width | Drag, outside click | Mobile pickers and options |
| Overlay | Full screen, transparent | Outside click | Click capture, blocking input |
| Popover | Next to an anchor | Outside click, Esc | Small menus and explanations |
| Tooltip | Above an anchor | Pointer leaves | Short supporting text |
| Toast / snackbar | Bottom (or top), brief | Timeout, swipe | Result notifications |
| Skeleton | The content's own shape | Data arrives | First load |
| Spinner | Centre of the region | Completion | Short waits, retries |

[![How modal, bottom sheet, overlay, popover and toast stack](/diary/assets/images/en/2026-11-20-ui-overlays-comparison.png)](/diary/assets/images/en/2026-11-20-ui-overlays-comparison.png)

### Modal with a backdrop/scrim

The `<dialog>` element gives you the scrim (`::backdrop`) and a good part of the focus handling for free.

```html
<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete this frame?</h2>
  <p>A deleted frame cannot be restored.</p>
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="ok" class="primary">Delete</button>
  </form>
</dialog>
```

```js
const dlg = document.getElementById('confirm');
dlg.showModal();              // background inert + ::backdrop
dlg.addEventListener('close', () => restoreFocus());
```

`showModal()` makes the rest of the page inert, but it does not always stop the document from scrolling. Call `lockScroll()` above when opening, and return focus to the element that opened the dialog when closing. Skip either and you keep the two complaints: "the page behind the modal scrolls" and "after closing, focus is gone".

### Bottom sheet

```css
.sheet {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  max-height: 90dvh;
  overflow: auto;
  overscroll-behavior: contain;
  border-radius: 20px 20px 0 0;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  translate: 0 100%;
  transition: translate .24s ease;
}
.sheet[data-open="true"] { translate: 0 0; }
```

If the sheet has its own scroll, the drag-to-dismiss gesture fights the content scroll. Accept the dismiss gesture only on the handle area, and keep the content scrolling separately.

### Overlay, popover, tooltip

An overlay is a **transparent** layer. A scrim darkens what is behind it. Use the scrim to close a side menu on an outside click; use a transparent overlay to block clicks during loading. For popovers the browser's own `popover` attribute supplies the outside-click dismissal and layering.

A tooltip is an aid for pointer devices. On touch it may never appear, and if it does it is hard to dismiss. Anything that exists only in a tooltip does not exist for a touch user.

### Toast, snackbar, skeleton, spinner

```css
.toast {
  position: fixed;
  inset-inline: 0;
  bottom: calc(72px + env(safe-area-inset-bottom));
  margin-inline: auto;
  inline-size: max-content;
  max-inline-size: calc(100% - 32px);
  z-index: var(--z-toast);
}
```

A toast disappears in three to five seconds and takes its message with it. If the action needs an undo, put an **Undo** button in a snackbar instead. Split loading in two: if it will finish within 300ms, show nothing; if the layout is already known, prefer a skeleton to a spinner. A skeleton reserves the geometry, so nothing jumps when the data lands.

## 6. Type, theme and detail

### Design tokens — colours with names

Once colours are hard-coded in hexadecimal, half of them get repainted for dark mode. Give them names and let the theme change only the values.

```css
:root {
  --bg: #F7F6FB;
  --surface: #FFFFFF;
  --surface-2: #EFECFA;
  --text: #1B1B2F;
  --text-body: #3F3950;
  --muted: #6B6880;
  --accent: #7C5CF0;
  --accent-hover: #6446D8;
  --border: #E2DDF0;
  --radius: 16px;
  --shadow-1: 0 1px 2px rgb(24 20 48 / .06);
  --shadow-2: 0 10px 30px rgb(24 20 48 / .12);
}
[data-theme="dark"] {
  --bg: #0E1020;
  --surface: #171A2E;
  --surface-2: #232741;
  --text: #F2F1FA;
  --text-body: #C6C9DC;
  --muted: #8E93AE;
  --accent: #A48CFF;
  --border: #2E3350;
}
```

Name tokens by role. `--accent` outlives `--purple-500`. Three tokens — `--bg`, `--surface`, `--accent` — already tidy most screens.

### word-break: keep-all

Breaking a Korean word in the middle makes it hard to read. The default (`normal`) breaks Korean between any two characters. `keep-all` keeps words whole and breaks at spaces.

```css
body { word-break: keep-all; overflow-wrap: break-word; }
.url, .code { word-break: break-all; }   /* long Latin strings and URLs are the exception */
```

With `keep-all` alone, a long unbroken English word or URL punches through the container. So pair it with `overflow-wrap: break-word`, and use `break-all` or `overflow-wrap: anywhere` only where breaking is genuinely needed. `line-break: strict` also improves Korean line-breaking around punctuation.

### Ellipsis

```css
/* One line */
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Several lines */
.clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

Single-line ellipsis needs **a defined width** to work. Inside a flex item, add `min-width: 0` as well. Without it there is no ellipsis and the card stretches sideways instead.

### line-height and letter-spacing

| Target | line-height | letter-spacing |
| --- | --- | --- |
| Body (Korean) | 1.75–1.9 | `-0.01em` |
| Headings | 1.25–1.35 | `-0.03em` |
| Small labels (eyebrow) | 1.2 | `0.12em` + uppercase |
| Code | 1.7 | `0` |

English defaults (1.5) look cramped under Korean body text; 1.9 on a heading scatters it. Korean takes slightly negative tracking, and small uppercase labels take positive tracking.

### border-radius, box-shadow, backdrop-filter

```css
.card { border-radius: var(--radius); box-shadow: var(--shadow-1); }
.card:hover { box-shadow: var(--shadow-2); }

.glass {
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2); /* Safari */
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
}
```

Two shadows read better than one: close and dense, then far and faint. `backdrop-filter` over a large scrolling area visibly costs frames. Keep it to small fixed surfaces like a top bar, and lay down a translucent background first for browsers without support.

### Cache busting

If you changed the CSS and the screen did not change, it is usually the cache. GitHub Pages serves the same filename from the browser cache.

```html
<link rel="stylesheet" href="/diary/assets/diary.css?v=20261120-ui">
<script src="/diary/assets/diary-search.js?v=20261120-ui" defer></script>
```

Bump `?v=` on every deploy. This diary's search script is versioned the same way.

### Favicon and OG image

| Asset | Size | Note |
| --- | --- | --- |
| `favicon.ico` | 32×32, with 48×48 | At the root |
| `favicon.svg` | Vector | Preferred by current browsers |
| `apple-touch-icon.png` | 180×180 | The browser rounds the corners |
| OG image | 1200×630 | `og:image` must be an **absolute URL** |
| Twitter card | 1200×600 or 1200×630 | `summary_large_image` |

Leave generous margins on an OG image and place the logo and title slightly above centre. KakaoTalk and Slack crop different amounts.

[![keep-all vs break-all, ellipsis, and cover vs contain](/diary/assets/images/en/2026-11-20-ui-typo-aspect.png)](/diary/assets/images/en/2026-11-20-ui-typo-aspect.png)

## 7. Mobile and in-app browser quirks

### iOS Safari auto-zoom on inputs

If an `input`, `textarea` or `select` has `font-size` below 16px, iOS Safari zooms in when it gets focus. The user has to pinch back out, and the layout is shifted sideways in the meantime.

```css
input, textarea, select, button { font-size: max(16px, 1rem); }
```

`maximum-scale=1` is not the answer: it hurts accessibility and is ignored by recent iOS. A font size of 16px or more is.

### Pinch zoom and touch control

```css
button, a, [role="button"] {
  touch-action: manipulation;          /* removes the double-tap zoom delay */
  -webkit-tap-highlight-color: transparent;
}
.canvas-wrap { touch-action: none; }   /* canvases that handle gestures themselves */
.no-select { user-select: none; -webkit-user-select: none; }
```

`touch-action: manipulation` disables double-tap zoom and the 300ms delay. A canvas or map that implements zoom and pan through pointer events sets `none` and builds pinch itself. Blocking page zoom altogether is an accessibility violation.

### KakaoTalk in-app browser (WebView)

A link opened from KakaoTalk runs in a Chrome-based WebView on Android and `WKWebView` on iOS. Some things behave differently from Safari.

| Item | Symptom | Response |
| --- | --- | --- |
| File download | `<a download>` ignored, or a blank window opens | Save through Blob or a data URL without a new window; if that fails, tell the user to open in a browser |
| `window.open` | Popup blocked, or opens in the same tab | Use a modal inside the app instead |
| Viewport height | `100vh` is taller than what you see | `100dvh` plus `env()` |
| `localStorage` | Sometimes emptied when the app is killed | Keep important state on the server or in the URL |
| Clipboard | `navigator.clipboard` permission denied | `execCommand` fallback, then select-the-text guidance |
| Service worker, PWA install | Unsupported or limited | An "open in browser" banner |
| Fixed bottom bar | Jumps or drifts while scrolling | `position: sticky`, or a `100dvh` grid |

The one that bit Shutterplate was file download. In the Android KakaoTalk WebView, `<a download>` and Blob saves were blocked, and only a `data:` URL went through. Since then the export screen carries a line saying downloads may be limited in an in-app browser and to open the page in a browser.

### iOS visual viewport and the keyboard

When the keyboard opens, `window.innerHeight` stays the same and only `visualViewport.height` shrinks. A `position: fixed; bottom: 0` bar therefore floats above the keyboard, or hides behind it. Chat-style inputs position themselves from `visualViewport`.

```js
vv?.addEventListener('resize', () => {
  bar.style.transform = `translateY(${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px)`;
});
```

## 8. A working cheat sheet

A table that turns a symptom into the exact term. Use it as the first stop when you receive a report — or when you write one.

| Symptom | Exact term | First check |
| --- | --- | --- |
| "Cut off at the bottom" | Viewport height miscalculation, missing safe area | `100dvh`, `env(safe-area-inset-bottom)`, `min-height: 0` |
| "Spills off the side" | Horizontal overflow | Fixed widths, flex child `min-width: 0`, `100vw` |
| "The floating button is in the wrong place" | FAB offset | `bottom: calc(16px + env(...))`, bottom-bar height |
| "The page scrolls behind the modal" | Scroll lock failure | `position: fixed` lock, `overscroll-behavior` |
| "The header covers the content" | Fixed header offset | `--topbar-h`, `padding-top`, `scroll-margin-top` |
| "The image is squashed" | Aspect distortion | `aspect-ratio`, `object-fit: cover/contain` |
| "Words break in the middle" | Korean line breaking | `word-break: keep-all` |
| "Focusing an input zooms the page" | iOS auto-zoom | input `font-size: 16px` or more |
| "The scroll bounces" | Overscroll | `overscroll-behavior: contain/none` |
| "The dropdown hides behind something" | Stacking context | `z-index` tokens, `isolation: isolate`, ancestor `overflow` |
| "The button won't press" | Touch target, blocked by a layer | Transparent overlay, `pointer-events`, 44×44 |
| "Old screen after deploy" | Cache | Bump `?v=`, hard reload |
| "The layout jitters for a frame" | Reflow | `svh` instead of `dvh`, `font-display` |
| "There are two scrollbars" | Nested scroll containers | Flex column `min-height: 0`, where `overflow: auto` sits |
| "Tapping a tab doesn't change anything" | Tab role confusion | `role="tab"`, `aria-selected`, panel association |

The left column is the user's language; the middle column is the code's. Search by the middle, report back in the left. A user never needs to understand "the stacking context got tangled", and we can never find the cause from "the three-dot menu is weird".

## Closing

Almost everything in this note is a one-line change. One `min-height: 0`. One `max(12px, env(safe-area-inset-bottom))`. One `word-break: keep-all`. The time went into finding that line, not into typing it.

Which is why the names matter. A name makes it searchable; searchable narrows the cause; a narrow cause means the next time the same symptom appears, you do not start from the beginning again. Half of fixing a screen is calling the broken part by its name.
