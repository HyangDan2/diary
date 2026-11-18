---
title: "Why the Keys Did Nothing in DOOM: js-dos v8 and DEFAULT.CFG"
date: 2026-11-16
category: Troubleshooting
summary: "Synthetic KeyboardEvents were not the answer. The real culprit was DEFAULT.CFG inside doom.jsdos. How I narrowed it down, plus the landscape fullscreen overlay."
tags: [js-dos, emulator, keyboard, troubleshooting]
lang: en
layout: post
---

DOS Player (PKPilot0006) runs classic DOS games straight in the browser. It puts public freeware bundles on top of `js-dos` v8 (WASM DOSBox), and the first deployment was checked by booting three of them: `Digger`, the DOOM shareware episode, and Dhrystone 2. Booting worked. The problem came next: **pressing the on-screen pad did nothing in the game.**

## Symptoms

- The screen renders fine, and mouse clicks open menus.
- Pressing the direction buttons on the mobile pad does not turn the view.
- Physical WASD on a desktop keyboard behaves the same way.

Input, and only input, was dead. The usual suspect here is focus: once the emulator canvas loses focus, key events go to the document and the game receives nothing.

## Step 1: synthetic events do not travel

The first attempt was to sidestep focus. Instead of the canvas, dispatch a hand-built `KeyboardEvent` on `window` and it should arrive wherever focus happens to be.

```js
// what I assumed would work
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
```

Nothing happened. The reason sits in the shape of js-dos v8. v8 receives keyboard input not as DOM events but through its **CommandInterface (`ci`)**. Once the emulator is ready, keys have to be pushed with `ci.sendKeyEvent(keyObject, down)`, and synthetic events never take that path. The key-code table inside v8 also differs from DOM `keyCode` values: `Escape`, for instance, is 256, not 27.

So I funnelled input through one path.

```js
function sendKey(code, down) {
  const kbd = KBD[code];            // { key, keyCode, location }
  if (state.ci && state.ci.sendKeyEvent) {
    state.ci.sendKeyEvent(kbd, down);   // the emulator receives it directly
    return;
  }
  // fall back to synthetic events only before ci exists
  target.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: kbd.key, code }));
}
```

Only after this change did menu navigation and Esc start working.

## Step 2: up and down still did nothing

Esc worked; the view in DOOM still did not turn. So I dug one level deeper, and the cause was not code but **a settings file inside the bundle**.

Unzip `doom.jsdos` and there is a `DEFAULT.CFG`. Its key bindings look like this.

| Setting | Value | Meaning |
| --- | --- | --- |
| `key_up` / `key_down` | `W` / `S` (scancodes 17 / 31) | forward, backward |
| `key_strafeleft` / `key_straferight` | `A` / `D` | strafe left and right |
| `key_left` / `key_right` | left and right arrows | turn |
| `key_fire` | `Ctrl` | fire |
| `key_use` | `Space` | open doors |
| `key_speed` | `Shift` | run |

In other words, this DOOM **does not use the up and down arrows for gameplay**. It walks with W and S, as the 1993 conventions had it. However precisely the pad sends `↑`, the game is not waiting for that key, so nothing happens.

The fix was to send the keys the game listens for. The pad in the DOOM profile sends **both keys** for up and down.

- Gameplay: `W` / `S`
- Menus: `↑` / `↓` (the Esc menu moves with the arrows)

I then added a `Key settings` modal so the keys could be remapped by hand: ten actions, with the result kept in `localStorage`. Bundles that use the arrows as they are, like `Digger`, keep the default profile.

![DOOM after the key-mapping fix — firing and movement both work](/diary/assets/images/dos-doom-play.png)

## Step 3: two thumbs in landscape

With input alive, the next problem was visible. In portrait, the map and the pad cover half the game screen. So in landscape the emulator now opens in a full-screen overlay.

![The landscape fullscreen overlay: D-pad at lower left, action pad at lower right, mini control bar on top](/diary/assets/images/dos-landscape-overlay.png)

- A D-pad at the lower left and an action pad (`A/B/C/D/E/F`) at the lower right, with the real key printed on each button.
- A mini control bar at the upper right (hide pad, virtual keyboard, sound, exit) so the game area stays unobstructed.
- On PC (`hover` + `fine pointer`) the virtual pad is hidden by default, with a force option in the `⋮` menu. On a large screen the pad must not own half the display.
- The virtual keyboard focuses a hidden `<input>` and handles Android IME composition (229), so Latin keys arrive even when a Korean keyboard is active.
- iOS Safari is excluded from this feature: orientation lock is blocked by policy there.

## What I learned

- Emulator input is **a command, not an event**. Find the interface the library provides before anything else.
- A settings file inside the bundle outranks the UI. If you have a `.jsdos` or `.zip`, unpack it and read the internal configuration.
- Split "it does not work" into stages and the cause changes each time: focus, then key codes, then game settings. Trying to fix all three at once would have cost three rounds of wandering.
