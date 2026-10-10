# Multi Web Manager

A multi-instance browser for Windows 10/11: up to **20 independent web pages** displayed as
a grid on one screen (the "wall"), driven from an admin console on a second screen.

Each cell is a real, isolated browser — separate cookies, storage, cache, history and
session — so you can be signed in to 20 different accounts at the same time, inside a single
application.

```text
SCREEN 1 — the wall                       SCREEN 2 — the admin console
┌────┬────┬────┬────┬────┐                ┌──────────────────────────────────────┐
│ 01 │ 02 │ 03 │ 04 │ 05 │                │ MULTI WEB MANAGER     20 instances   │
├────┼────┼────┼────┼────┤                ├───────────┬──────────────────────────┤
│ 06 │ 07 │ 08 │ 09 │ 10 │                │ ● WEB 01  │ All instances            │
├────┼────┼────┼────┼────┤                │ ● WEB 02  │  same site · same zoom   │
│ 11 │ 12 │ 13 │ 14 │ 15 │                │ ● WEB 03  │  ☑ replicate the mouse   │
├────┼────┼────┼────┼────┤                │ …         │ Selected instance        │
│ 16 │ 17 │ 18 │ 19 │ 20 │                │ ● WEB 20  │ Grid · Displays          │
└────┴────┴────┴────┴────┘                └───────────┴──────────────────────────┘
```

## Features

- **1 to 20 instances** in a grid, either automatic (cells close to 16:10) or with a chosen
  number of columns × rows; the grid follows the window size to the pixel.
- **Full isolation**: one profile per cell (`profiles/profile-01/` …). An action in one cell
  never touches the cookies or the session of another.
- **Mouse replication**: tick one checkbox and everything the mouse does in the hovered cell
  is reproduced at the same relative position in all the others — click, double-click,
  right-click, drag, wheel. There is no "master" cell to designate.
- **Bulk actions**: open the same address everywhere, reload everything, same zoom for all.
- **Identical restore**: on the next launch, the same number of cells reopens the same pages,
  signed in to the same accounts, with their history, scroll position, zoom and every setting.
- **Two displays detected**: wall on the primary display, admin console on the other
  (configurable, swappable, wall in full screen). With a single display, `F2` switches
  between the two.
- **Instance management**: add, delete, rename, stop (frees the memory, the cell stays),
  start, restart, per-instance developer tools.

## Installation

There is no installer yet: the application runs from source.
Requirements: Windows 10/11, [Node.js](https://nodejs.org) 22.12 or newer, Git.

```bash
git clone https://github.com/kaitoooooooooooooooooooo/MultiWebManager.git
cd MultiWebManager
npm install
npm run dev
```

The Electron binary (~100 MB) is downloaded on first launch.

| Command | Effect |
|---|---|
| `npm run dev` | starts the application, with hot reload of the interface |
| `npm run build` | type-checks, then compiles into `out/` |
| `npm run preview` | starts the compiled version |
| `npm test` | unit tests (grid, URLs, displays, coordinates, wheel) |
| `npm run typecheck` | strict TypeScript |
| `npm run selftest` | self-test on the real application (see below) |

## Usage

The interface is currently in French; the labels are given below with their meaning.

### The wall

Each cell has a header: status (● green connected, amber loading, red error, grey stopped),
name, back / forward / reload, and the address.

- Click the address to edit it: a full URL, a bare domain (`wikipedia.org`) or free text,
  which runs a search. `Enter` loads, `Esc` cancels.
- Clicking the header selects the cell (blue frame); the admin console then shows its details.
- While the mouse is being replicated, every frame turns amber.

### The admin console

- **Toutes les instances** (all instances) — one address opened in every cell
  (« Ouvrir dans toutes »), « Recharger toutes » (reload all), a common zoom, and the
  checkbox **« Répliquer la souris sur toutes les instances »** (replicate the mouse on all
  instances). An amber badge at the top shows that replication is on; clicking it turns it off.
- **Instances** (left) — status, name and title of each cell; « Ajouter une instance » adds one.
- **Instance sélectionnée** (selected instance) — name (click to rename), address,
  navigation, last load, size, zoom, profile, last error; « Recharger » (reload),
  « Redémarrer » (restart), « Arrêter » (stop), DevTools, « Supprimer » (delete, with
  confirmation — the profile is kept).
- **Grille** (grid) — number of instances (1, 2, 4, 6, 9, 12, 16, 20), automatic or manual
  layout, spacing, labels and status display.
- **Écrans** (displays) — display used by the wall, display used by the admin console, swap,
  wall in full screen.

### Shortcuts

| Key | Effect |
|---|---|
| `F2` | switches between the wall and the admin console |
| `F12` | developer tools of the interface (in `dev` mode only) |

### Getting good results with mouse replication

Replication works by **relative position**: a click at 30 % of the width and 40 % of the
height of one cell is replayed at 30 % / 40 % in the others. For it to land on the same
button everywhere, the pages must be identical: same site, **same zoom**, same state (a
cookie banner or an ad present in a single cell shifts everything).

## What is kept when you close

Closing the wall or the admin console quits the application and saves everything in
`%APPDATA%\Multi Web Manager\`:

| File | Content |
|---|---|
| `config.json` | number and order of cells, name, address, zoom, running or stopped, grid, displays, mouse replication, selected cell |
| `profiles/profile-NN/` | cookies, localStorage, IndexedDB, cache — the cell's Chromium profile |
| `profiles/profile-NN/mwm-session-cookies.bin` | session cookies (the ones Chromium discards on exit), encrypted |
| `state/instance-NN.bin` | back/forward history, scroll position and form contents, encrypted |

Both encrypted files are protected by Windows (DPAPI): they can only be read from the same
Windows account, like Chrome's cookie database.

Deleting a cell keeps its profile: recreating a cell with the same number brings its
sign-ins back. To start from scratch, close the application and delete the folder above.

## How it works

An [Electron](https://www.electronjs.org) 44 application written in TypeScript. The main
process is the single source of truth: it owns the pages (one `WebContentsView` per cell),
computes the grid and holds the state; the two React interfaces only display a mirror of it.

```text
src/
├── shared/     types, grid computation, coordinates, IPC contract (no Electron dependency)
├── preload/    the only bridge between the interfaces and the main process
├── main/       config, sessions, instances, wall, windows, displays, mouse, IPC, security, self-test
└── renderer/   wall · admin (the console) · common (store, components)
tests/          unit tests of the pure functions
docs/           ARCHITECTURE.md
```

| Building block | Role |
|---|---|
| Electron 44, `WebContentsView`, `session.fromPath` | one native page and one on-disk profile per cell |
| React 19, zustand, Tailwind 4 | interfaces; a cell that changes only redraws itself |
| zod | validation of `config.json` and of every IPC message |
| electron-vite 5, TypeScript 7, vitest | build, strict typing, tests |

The details — technical choices, the measurements behind them, limitations — are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (in French).

### Security

- `contextIsolation`, `sandbox` and no Node access in every page.
- Web pages get no preload script, and no script is ever injected into them.
- The interfaces can only reach a closed list of IPC channels; the main process re-checks
  the sender and then the content of every message.
- Only `http(s)` addresses are loaded (`javascript:`, `file:`… are refused).
- Camera, microphone, location and notifications are denied by default.

## Self-test

```bash
npm run selftest
```

Starts the real application in a temporary folder (none of your data is touched), verifies
37 points and prints a JSON report. The windows stay visible for about a minute and a half,
including a switch to full screen. What is verified:

- one profile folder per cell, and each cell only sees its own cookies;
- going from 4 to 20 instances without recreating the existing pages; memory measured at 20;
- stop, start, restart, delete, add; manual grid; full screen;
- web pages can reach neither the application nor Node; invalid IPC requests are refused;
- **mouse replication end to end**: real Windows mouse messages are posted to the wall (the
  cursor does not move) and each test page reports what it received — exactly one click per
  cell, at the same position within ±1 px, including double-click, right-click, drag and wheel;
- **restore**: each run leaves a known state that the next one must find again (number of
  cells, settings, one cell signed in through a session cookie, its history). Run the
  command **twice** to verify the restore.

Options: `npm run selftest -- --mwm-selftest-fresh` starts again from an empty folder;
`-- --mwm-selftest-real-wheel` adds a real wheel notch (the cursor is moved for about 0.2 s
over the wall: do not touch the mouse). The test site listens on `127.0.0.1:47913`.

## Known limitations

- **Memory**: measured at 3.5 GB for 20 light pages (≈ 150 MB per page). Heavy sites
  (webmail, social networks) need 300 to 500 MB each, i.e. 8 to 10 GB for 20.
- **Wheel**: inside the cells, one notch scrolls 200 px, against 100 px in Chrome (Electron
  delivers each notch twice to this kind of view). Replicated cells scroll the same distance
  as the source cell.
- **Not replicated yet**: the keyboard, Shift/Ctrl + click, precision-touchpad scrolling,
  native drop-down lists once they are open.
- **Middle click**: press and release are reproduced, but not the `auxclick` event; a link
  opened with a middle click therefore only opens in the hovered cell.
- **Not restored** on the next launch: `sessionStorage`; a session expired by the site
  itself asks you to sign in again.
- Some providers (Google in particular) refuse sign-in from an embedded browser; DRM sites
  (Netflix, Spotify web) do not play.
- Tested on two displays at 100 %; mixed scaling (100 % and 150 %) remains to be verified.

## Roadmap

- [x] Dynamic grid, isolated and persistent sessions
- [x] 20 instances, admin window, display detection
- [x] Mouse replication, same site and same zoom for all, identical restore
- [ ] Keyboard replication; "single cell" and "group of cells" modes
- [ ] Live preview in the admin console, profile management (create, rename, reset)
- [ ] Configurable shortcuts, pausing of inactive cells, logs, Windows installer

## Use

The application faithfully replays the user's actions; it does not try to make them
undetectable or to get around anti-bot protections. Using several accounts remains subject
to each site's terms of service.
