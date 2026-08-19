# UI Contract — Dhan Option Chain Terminal

No value may appear in a component that is not on this sheet.

## 1. Token sheet

### Colour — light (`:root`)
```
bg/base        #F7F8FB      bg/subtle   #EEF1F6      bg/inset    #E4E9F1
bg/panel       #FFFFFF      bg/itm      #EEF1F6 @60%
fg/base        #10151F      fg/muted    #4E5A6E      fg/faint    #8390A6
accent         #A87516      accent/hover #8E620F     accent/fg   #FFFFFF
up             #0E8A5F      down        #C33A3A      flat        #8390A6
warn           #B3730B      crit        #C33A3A      ok          #0E8A5F
border         #DCE2EC      border/strong #C2CBDA    ring        #A87516
net            #3D6EA8      compute     #A87516      render      #6E5AA8
```

### Colour — dark (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and `:root[data-theme="dark"]`, both redefining the same token names)
```
bg/base        #0A0D14      bg/subtle   #10141D      bg/inset    #171C28
bg/panel       #0E121B      bg/itm      #171C28 @60%
fg/base        #E8ECF4      fg/muted    #9AA5B8      fg/faint    #64708A
accent         #C8912A      accent/hover #E0A53C     accent/fg   #0A0D14
up             #21B77E      down        #E05252      flat        #64708A
warn           #D99A2B      crit        #E05252      ok          #21B77E
border         #212838      border/strong #333D52    ring        #C8912A
net            #5A8FD0      compute     #C8912A      render      #9B85D8
```

Every token is redefined in both blocks. No colour is declared only inside a media or
`[data-theme]` block. `body` always paints an explicit `bg/base`.

### Type
```
display  Archivo 700       32/1.1/-0.02em
h1       Archivo 700       24/1.2/-0.01em
h2       Archivo 600       18/1.25
label    Archivo 600       11/1.2/0.08em  uppercase
body     Newsreader 400    16/1.6
small    Newsreader 400    14/1.5
data     IBM Plex Mono 500 12/1.35  tabular-nums
data-lg  IBM Plex Mono 600 40/1.0   tabular-nums
micro    IBM Plex Mono 400 10/1.3/0.04em
```
Fallbacks: `Archivo, "Segoe UI", system-ui, sans-serif` ·
`Newsreader, Georgia, "Times New Roman", serif` ·
`"IBM Plex Mono", "Cascadia Mono", Consolas, monospace`.

### Space — 4px base, only these
`4 8 12 16 24 32 48 64 96`

### Radius
`4` input and chip · `8` card and panel · `999` pill

### Shadow
`sm 0 1px 2px rgba(6,10,20,.10)` · `md 0 4px 14px rgba(6,10,20,.14)` · `lg 0 16px 40px rgba(6,10,20,.22)`

### Motion
```
instant 120ms · base 180ms · slow 280ms · flash 400ms
ease-out    cubic-bezier(0.16, 1, 0.3, 1)
ease-in-out cubic-bezier(0.4, 0, 0.2, 1)
```
Every transition inside `@media (prefers-reduced-motion: reduce) { transition: none; animation: none }`.

### Fixed dimensions
```
top bar 56 · chip rail 52 · header strip 96 · grid header row 34 · grid row 30
latency panel 380 (collapsed 44) · cell padding 8 · focus ring 2 at 2 offset
```

## 2. State matrix — every interactive component ships all eight

| State | Definition |
|---|---|
| default | tokens as above |
| hover | `background: bg/subtle`, 120 ms ease-out; chips also lift `translateY(-1px)` |
| focus-visible | `outline: 2px solid ring; outline-offset: 2px` — never `outline: none` alone |
| active | `translateY(0)`, `background: bg/inset`, 120 ms |
| disabled | `opacity: .45`, `cursor: not-allowed`, `aria-disabled="true"`, no hover response |
| loading | skeleton block at exact final dimensions, 1.4 s shimmer, zero layout shift |
| error | see section 3 |
| empty | see section 3 |

Components covered: instrument chip, expiry select, search input, refresh button, theme toggle,
panel collapse toggle, call-log row, export button, grid row.

## 3. Expressive states

Four parts, every time: an inline SVG character, a human sentence, a real next action, and the
raw technical detail inside a collapsed `<details>`.

The character is a **gauge needle** — a 96px inline SVG dial with a needle whose angle is the
pose. Three poses, driven by a CSS class on the wrapper: `idle` needle resting at 0 with a slow
3 s sway; `concerned` needle pinned hard right with a 2-degree tremor; `celebrating` needle
sweeping the full arc once with `ease-out`. It ties the empty and error states back to the
instrument-panel identity instead of importing a generic mascot.

| State | Sentence | Action |
|---|---|---|
| Network error | "Dhan tak request nahi pahunch payi. Last snapshot 14:32:07 ka dikh raha hai." | `Retry now` + `Keep last snapshot` |
| Auth expired | "Access token expire ho gaya. Naya token Dhan Web se generate karke `.env` mein daaliye." | `I have updated .env — reconnect` |
| Rate limited | "Dhan ne 3 second ka limit laga diya. Agla attempt 6s mein." | `Wait` (countdown, disabled) |
| Empty chain | "Is expiry ke liye koi strike nahi aayi." | `Change expiry` (opens the select) |
| Market closed | "MCX 23:30 par band ho gaya. Ye 23:29:58 ka snapshot hai." | `Switch to GOLD` / `See last snapshot` |
| First connect ok | "Connected. 62 strikes, 218 ms." | auto-dismiss after 4 s |

Rules: no `alert()`, no bare red text, no unstyled browser validation. Every expressive region is
`aria-live="polite"` — `assertive` only for auth expiry. The sentence must stand alone for a
screen reader; the needle carries no unique meaning. Reduced-motion users get the same states
with opacity-only transitions.

## 4. Accessibility floor
- Body text contrast at least 4.5:1; large text, borders and the needle at least 3:1 — verified in both themes.
- Every interactive element keyboard reachable and operable; focus order matches visual order.
- Touch targets at least 44x44 for chips and buttons (the 30px grid row is a display row, not a target).
- Every input has an associated `<label>`, not just a placeholder.
- Signed numbers keep their sign so colour is never the only signal.

## 5. Verification before "done"
Run the app, screenshot every state below, compare against this sheet, list deviations, fix, then
report with the images: first load, live, stale amber, stale red, market closed, rate limited,
auth expired, network error, empty chain, dark mode, 1024px, panel collapsed.
