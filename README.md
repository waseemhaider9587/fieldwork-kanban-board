# Fieldwork — Offline Kanban Task Board

A responsive Kanban board built for the **Devnexes Digital Solutions Frontend
Development Internship**. It uses the native HTML5 Drag & Drop API (no
`react-dnd` or similar library), a hand-rolled Command Pattern undo/redo
stack, and IndexedDB for fully offline local persistence.

## Tech stack

- **Vanilla JavaScript (ES modules)** — no framework, no build step
- **Native HTML5 Drag & Drop API** — `dragstart` / `dragover` / `drop` / `dragend`
- **IndexedDB** (raw browser API, promise-wrapped) — no `idb` dependency
- **Plain CSS** — custom design system, no CSS framework
- 100% free / open-source, zero paid services

## Getting started

The app is static files, but ES modules require a real HTTP origin (they
won't load over `file://` in Chrome). Serve the folder with any static
server:

```bash
# Option A — Node (no install needed if npx is available)
npx serve .

# Option B — Python
python3 -m http.server 8080

# Option C — VS Code
# Right-click index.html → "Open with Live Server"
```

Then open the printed local URL (e.g. `http://localhost:8080`) in a modern
browser (Chrome, Edge, Firefox, or Safari).

No `npm install` is required — there are zero dependencies.

## Project structure

```
kanban-board/
├── index.html          # App shell
├── style.css            # Design system + component styles
├── js/
│   ├── app.js            # Rendering, drag & drop, keyboard a11y, wiring
│   ├── commands.js        # Command Pattern classes + HistoryManager
│   ├── db.js               # IndexedDB read/write wrapper
│   └── state.js             # Default board state + helpers
└── README.md
```

## Features

### Module 1 — Native Drag & Drop UI Engine
- Three columns (Backlog / In Progress / Done) rendered from state.
- Cards are `draggable="true"`; drag events are handled directly
  (`dragstart`, `dragover`, `drop`, `dragend`, `dragleave`) with no
  third-party DnD package.
- A live **drop indicator** line is computed and repositioned on every
  `dragover` by comparing the pointer's Y position against each card's
  midpoint, so the insertion point updates in real time.

### Module 2 — Command Pattern State History
- Every mutation (add, delete, rename, re-prioritize, move) is an object
  with `execute(state)` / `undo(state)` in `js/commands.js`.
- `HistoryManager` keeps a `past` and `future` stack: executing a new
  command clears `future`, so redo history is discarded once you branch
  off in a new direction — standard undo/redo semantics.
- Wired to **Undo / Redo buttons** in the header and to **Ctrl/Cmd+Z** and
  **Ctrl/Cmd+Shift+Z** (or **Ctrl+Y**) keyboard shortcuts.

### Module 3 — IndexedDB Local Storage
- The full board state is persisted to an IndexedDB object store
  (`fieldwork-kanban` → `boardState`) on every change, debounced by
  ~350ms so rapid actions don't spam writes.
- On load, the app reads the saved state back — refreshing or closing the
  browser does not lose your board. If nothing has been saved yet, a
  small starter board is generated instead.
- Works fully offline once the page has loaded; no network calls are made
  by the app itself.

### Week 4 — Accessibility & keyboard support
- Cards are focusable (`tabindex="0"`) with descriptive `aria-label`s.
- **Arrow keys** move focus between cards/columns when browsing.
- **Enter / Space** "grabs" a focused card (`aria-grabbed="true"`,
  visible focus ring) — this mirrors the WAI-ARIA drag-and-drop pattern
  for people who can't use a mouse.
- While grabbed: **Arrow Up/Down** reorders within the column,
  **Arrow Left/Right** moves it to the adjacent column, **Enter** drops
  it, **Escape** cancels and restores its original position.
- A visually hidden `aria-live="polite"` region announces every action
  (moves, undo/redo, renames, deletes) for screen reader users.
- Visible focus outlines throughout; `prefers-reduced-motion` is
  respected.

### Everything else
- **Inline editing** — double-click a title (or the ✎ button) to rename
  a card in place; Enter commits, Escape reverts.
- **Priority tags** — a `low` / `medium` / `high` selector per card,
  reflected as a colored left border on the card.
- **Add task** — an inline form per column (no page navigation/modal).
- **Delete task** — the ✕ button, fully undoable.

## Known limitations / next steps

- Single board only (no multi-board switching yet).
- No conflict resolution for multiple tabs open at once (last write wins).
- Keyboard reordering issues one Command per arrow press rather than
  batching a drag session into one undo step — this was a deliberate
  trade-off for simplicity and transparent history, but batching could
  be added later.

## Deliverables checklist

- [x] Source code (this repository)
- [x] README with install steps, dependencies, and feature docs
- [ ] Demonstration video (record separately: a 2–4 minute screen capture
      walking through drag & drop, undo/redo, and an offline reload)
