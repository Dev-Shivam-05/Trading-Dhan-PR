# Panel windows and blip recovery — v1 (P26)

**LOCKED** — approved with one `go` on 2026-09-21. Rows may only be added as numbered amendments,
never edited in place.

Two things the same session asked for, built together because they share the same three panels:

1. every panel can be made **fullscreen** (same window) or **popped out** (its own window);
2. a backend that goes away for two seconds must not cost sixty seconds of dead chart.

## Why row 8 exists — the measurement that produced it

Reproduced on 2026-09-21 against the replay server with `.cache/audit-recovery.mjs`, by killing the
server with the page open and restarting it:

| Moment | `__ucandles.message()` | candles |
|---|---|---|
| before the kill | `null` | 375 |
| during the outage | `could not reach the backend — TypeError: Failed to fetch — retrying in 60 s` | `null` |
| server back, **+5 s** | same error | `null` |
| **+15 s** | same error | `null` |
| **+30 s** | same error | `null` |
| **+60 s** | `null` | 300 |

The refresh cadence was being reused as the retry cadence, so any blip cost up to a full minute.
This is exactly what the user photographed at 09:36 on 2026-09-21 (`could not reach the backend —
TypeError: Failed to fetch` in the option-chart window while the server was already back up).

## The locked table

| # | Ambiguity | Locked value | Why this default |
|---|---|---|---|
| 1 | "full screen" | Native Fullscreen API on the panel element (`requestFullscreen`). Same window, browser chrome hidden, native `Esc` exits. | No layout invention; the browser already owns this, and `Esc` is free unless a drawing tool is armed. |
| 2 | "extra screen … different window" | `window.open('/?pop=<panel>', 'dhan-<panel>', 'width=1280,height=800')`. The new window boots the same app with `body.pop` + `body.pop-<panel>`; CSS hides every other pane. | No new HTML file, so no `STATIC` row and no 404 trap. The popup opens its own SSE but the **same** `ChainPoller` key, so it costs zero extra Dhan calls. |
| 3 | Which panels get the buttons | Three: **chart strip** (`#chartWrap`), **option chain** (`#work`), **option-contract window** (`#optWin`). | The third is the one that failed in the screenshot. |
| 4 | Button form | Two icon buttons in each panel's header, right-aligned, using the existing `.icon` class. `⛶` fullscreen, `⧉` pop-out. `title` + `aria-label` in English. | Matches the header buttons already there; no new token. |
| 5 | Keyboard | `F` = fullscreen the focused panel, `W` = pop it out. Bare letters, modifier-guarded like every other shortcut. | `F` and `W` are the only unclaimed letters — `1-6 / P G L T E C S Home Esc` and chart-tools' `V D H R B` are taken. |
| 6 | Which panel "focused" means | The panel under the pointer; none → chart. In a popup, its own panel. | No focus-ring bookkeeping to invent. |
| 7 | Popup size persistence | `localStorage['pop-<panel>']` holds `{w,h,x,y}`, rewritten on the popup's `beforeunload`. | The same pattern `#optWin` already uses (`WIN.key = 'optWin'`). |
| 8 | Retry cadence after a failed fetch | Backoff **2 → 4 → 8 → 16 → 32 → 60 s**, reset to 2 s on the first success. The normal refresh stays 60 s. | 2 s covers a server restart; the 60 s cap means a long outage does not hammer. |
| 9 | Error message text | `could not reach the backend — retrying in Ns`, N counting down every second, plus a **Retry now** button. | The text already exists; only the live number and the button are new. |
| 10 | Retry on reconnect | When the SSE reports `state: live` again, every panel currently in an error state refetches **immediately** and cancels its backoff. | The server coming back is a stronger signal than any timer. This is what makes a restart invisible. |
| 11 | Fullscreen / popup data | Both keep the live SSE. The popup opens its own `/api/stream`; fullscreen changes nothing about data. | Row 2 already costs zero extra Dhan calls. |
| 12 | Popup blocked | Inline note `popup blocked — allow popups for this page`, panel stays where it is. | Silent failure on a trading screen is the worst outcome. |

## Amendments

| # | Added | What | Why |
|---|---|---|---|
| 13 | during build | Row 4 said "the same `.hbtn` class as Greeks/Style". **There is no `.hbtn` in this codebase** — the header buttons are `.tog` (labelled) and `.icon` (26×26 square). Built with `.icon`. | CLAUDE.md rule 3: match the conventions already in the codebase. The locked intent — an icon button that looks like the ones beside it — is unchanged. |
| 14 | during build | The chain has no header of its own; its two buttons go at the right end of the **top strip** (`.hstrip`), after the strike search. | `#work` is a bare `<main>` wrapping `.gridwrap`. Inventing a header bar for it would cost the chain vertical space, which spec `terminal-redesign-v1.md` row 4 ranks as the pane that never loses pixels. |
| 15 | during build | `.chart-empty` is `pointer-events:none`, so row 9's **Retry now** button is unreachable inside it. The button gets `pointer-events:auto`. | Found by reading the CSS before wiring the click, not after. |
| 16 | during build | The countdown in row 9 needs a repaint every second. Each store runs a **1 s interval only while it is in an error state**, cleared on success. | A permanent 1 s timer would repaint the chart 60 times a minute on a healthy connection for nothing. |
| 17 | found by AC1's own run | While `document.fullscreenElement` is set, `candles.js` and `scan.js` **ignore Escape**. | Row 1 makes Esc the way out of fullscreen. Without the guard, one Esc in a fullscreen option chart left fullscreen **and** closed the contract, so the reader came back to an empty chain. It surfaced as the next check being unable to click a button inside a window that no longer existed. |
| 18 | found by reading the screenshot | The popped-out option chart pins itself with `left/top/right/bottom/width/height` marked `!important`, keeps `position:fixed`, and leaves `.shell` in the layout as `visibility:hidden`. | `candles.js` writes the window's geometry as **inline styles** (`placeWindow`, the drag, the resize observer), and an inline style beats any class rule. Two earlier attempts — `position:static`, then plain class rules — left the popup as a 560×340 box in a corner with the status rail floating above it. **Every assertion in the suite passed both times**; only the PNG showed it. |
| 19 | during build | The pop-out glyph is `&#10697;` (⧉, two overlapping squares), not `&#10696;` (⧈). | Row 4 locked ⧉. The first build shipped the neighbouring code point, which renders as a square inside a square and reads as picture-in-picture. Caught by a 3× close-up of the button, not by any check. |

## Out of scope

- Sub-minute / tick-built candles. Dhan's intraday endpoint's finest interval is **1 minute**;
  the forming candle already updates on every tick through `mergeTick`, and the Line mode is
  already tick-by-tick. Building candles from the WebSocket feed is a separate phase.
- P25 (TradingView-style zoom and pan) — on the board, untouched here.
- More than one popup per panel. A second `⧉` re-focuses the window that is already open.
- Any change to the chain's columns, colours, or the scanner.

## Acceptance criteria — result: **34/34** (27 in `.cache/verify-p26.mjs`, 7 in `.cache/verify-p26-recovery.mjs`), 2026-09-21, replay, two consecutive clean runs

- [x] AC1 — each of the 3 panels shows exactly 2 new buttons; `document.fullscreenElement` is that
      panel after `⛶`, and `null` after leaving.
      **One half of this is not claimed:** Chrome's own "Esc exits fullscreen" lives in the browser
      UI layer and a CDP-synthesised key press does not reach it, headless or headed. What is
      measured is everything the app owns — Escape is **not** `preventDefault`-ed while fullscreen
      (`defaultPrevented === false` on all three panels), nothing in the app acts on it
      (amendment 17), and `exitFullscreen()` returns the panel to the shell. The UA half needs
      **one manual press** to confirm.
- [x] AC2 — `⧉` opens a window carrying `pop-chart` / `pop-chain` / `pop-opt`, with the other two
      panels not rendered. **Measured by box and `display`, not `offsetParent`**: a
      `position:fixed` element reports `offsetParent === null` even when it fills the screen, and
      `#optWin` is fixed in every mode — the first version of this check called a visible window
      hidden.
- [x] AC3 — each popup has real data (chain 16 rows, underlying 300 candles, option 75 candles)
      and `/api/feed` reports **no** increase in subscribed instruments.
- [x] AC4 — kill the server with the page open and restart it: the chart is back in **0.3 s** and
      **1.3 s** on two runs, against a 12 s bar and the 60 s it used to take. The option window
      recovers with it.
- [x] AC5 — the observed waits are exactly **2, 4, 8, 16, 32 s**, the message counts down
      (`…retrying in 53 s`), the option window is on the same ladder, and the first success resets
      it to step 0.
- [x] AC6 — `Ctrl+F` does not fullscreen; `F` and `W` inside `#search` do nothing.
- [x] AC7 — zero console errors. **One pre-existing exception, counted separately rather than
      folded into a green:** `/favicon.ico` 404s, because the server's `STATIC` allow-list has no
      favicon row. It predates P26 and only shows in a headed browser. Six screenshots reviewed
      (`p26-fs-chart/chain/opt`, `p26-pop-chart/chain/opt`) plus the outage and recovered states.

## Risks

- **Fullscreen on a sticky-positioned table.** The strike spine is `position:sticky;left:0;right:0`
  and fullscreen creates a new containing block. Cheapest check: one screenshot of the chain in
  fullscreen at 1440×900 before wiring anything else.
- **Popup and `localStorage` are shared.** `chartZoom` and the drawings written by a popup change
  the main window on its next repaint. Cheapest check: open both, drag the axis in the popup.
- **File count.** `index.html`, `app.css`, `app.js`, `ucandles.js`, `candles.js` + this spec +
  `PHASES.md` = **7**, inside the ~8 rule.
