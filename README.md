# buook

A local-first, editable pixel-art book for Windows, built with Electron and Canvas. Worn parchment, curved page stacks, customizable covers, a spine-view shelf, and loose or taped keepsakes.

## Play in your browser

[**Open buook — public web app**](https://buook.felix13.chatgpt.site)

No installation or account is required. The browser version uses the same book renderer and editing tools as the desktop app. Your shelf is saved **in your current browser on this device**, not on a public server. Desktop and browser shelves are separate; clearing browser data removes that browser’s saved books. Keep the same web address to return to the same shelf.

The approved working checkpoint is **v1.0.11**. The desktop application currently appears as **The Book**; its application ID and save location are intentionally unchanged so existing books keep working.

The current development version is **v1.0.13**, adding correct first-leaf stack thickness, golden paper edges on both stack faces, a custom generated desktop icon, and closed views with two covers and a parallel paper block. The `v1.0.11` checkpoint is preserved unchanged.

## Inspiration and credit

**buook is inspired by the interactive Book of Grudges in [Grudgekeeper](https://cartooncyb.org/), the dwarf RPG created by Jae / Cartoon Cyborg.** The book's tactile page turns, layered paper, and small keepsakes were the starting point for this project.

Watch the creator's [Grudgekeeper Dev Log #1 — I'm building a 6-path RPG by myself. Here's everything so far.](https://www.youtube.com/watch?v=W3H2AYEvl94).

This is an independent project, not an official Grudgekeeper product or an endorsed port. Grudgekeeper, its artwork, and its original book design belong to their respective creator/rightsholders. Reference recordings and screenshots are not distributed in this repository. The sprites used here were generated and adapted for this project; their provenance is documented in [assets/generation-notes.txt](assets/generation-notes.txt).

## Download

See [Releases](https://github.com/ijustcreate/buook/releases) for Windows x64 packages:

- `The-Book-Setup-1.0.11.exe` — installer.
- `The-Book-Portable-1.0.11.exe` — runs without installing.

These are unsigned Windows builds. Windows may show a publisher/reputation warning. [SHA-256 checksums](docs/releases/v1.0.11.sha256) accompany the release.

## Features

- Curved, perspective-mapped page turns, adjustable page count, animation speed, and keyboard or drag navigation.
- Editable page content, headings, fonts, images, pixel-art tools, contents navigation, and automatic page numbering.
- Customizable outside/inside cover colors, gold or silver hardware, cover text/symbols, and titled spines.
- A locally saved shelf, including a separate save-copy action.
- Inspectable, draggable loose inserts and taped keepsakes.

### How inserts behave

A photo starts on one specific page face. It follows that face as the sheet lifts, without fading, and opaque paper hides it when the reverse faces the viewer.

When a loose insert finishes a turn, ownership transfers to the page or inside cover that was facing it **before** the turn—not to the back of the turning sheet. The landed sheet can cover it. Lifting that sheet away reveals it on its new support. Turning that newly supporting page carries the photo again.

Taped inserts stay anchored to their original page face, like artwork on that page. Dragging loose inserts preserves their angle and the grabbed point.

## Run from source

Use Node.js 22.12 or newer and pnpm. The lockfile pins Electron and electron-builder.

```sh
pnpm install --frozen-lockfile
pnpm start
```

Do not open `index.html` directly as a local file. Electron serves the bundled assets through the app's `book://app/` protocol.

To run the browser version locally instead:

```sh
pnpm run build:web
pnpm run web
```

Open the printed local URL (`http://127.0.0.1:4174` by default). `build:web` copies only the shared renderer and artwork into `dist/`—no Electron executable, credentials, or saved books. Any static HTTPS host can serve that directory. The public deployment uses Sites; its project identity is retained in `.openai/hosting.json`.

Build Windows packages:

```sh
pnpm run dist
```

Generated installers and portable builds go into `release/`, which is excluded from Git. Windows is the tested platform; macOS and Linux packaging are not configured.

## Local data and backups

On Windows, the installed app keeps its Electron profile under `%APPDATA%\The Book`. Shelf and book content are stored in that profile's browser storage, not in this repository. Back up the complete profile with the app closed before moving computers or replacing an installation.

The portable executable is not a self-contained book-data backup. Loose-insert positions, tape state, and the live simulation are currently session state; the saved shelf is not a complete snapshot of that simulation.

## Regression checks

The scripts in `scripts/` require a resolvable `playwright` package with Electron support, in addition to the project's Electron installation. They launch isolated temporary profiles and do not use the real shelf.

```sh
node scripts/verify-insert-pickup.cjs
node scripts/verify-insert-transfer.cjs
node scripts/verify-edge-alpha.cjs
node scripts/verify-stack-edges.cjs
node scripts/verify-book-layers.cjs
node scripts/verify-web.cjs http://127.0.0.1:4174/
```

Set `BOOK_ASSERT_PICKUP=1` for first-frame pixel assertions. Set `BOOK_QA_EXE` to a packaged executable to check that build instead of the development app. `BOOK_VISIBILITY_STEPS` controls the insert suite's pixel-sampling density.

The checks cover actual first-frame photo visibility, opaque back-face occlusion, facing-page and inside-cover ownership, taped-face anchoring, dragging, multiple inserts, transparent paper edges, first/second-leaf stacks, matching paper-edge materials and joins, palettes, and shelf reloads.

## Project notes

- [Changelog](CHANGELOG.md)
- [Visual tasks and implementation history](BOOK_VISUAL_TASKS.md)
- [Asset-generation notes](assets/generation-notes.txt)

This is a work in progress. v1.0.11 preserves the accepted near-complete interaction baseline; it is not a claim that every editing or persistence edge case is finished. No blanket open-source license has been selected yet.
