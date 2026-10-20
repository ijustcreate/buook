# Pixel Book

A local-first, editable pixel-art book for Windows, built with Electron and Canvas. Worn parchment, curved page stacks, customizable covers, a spine-view shelf, and loose or taped keepsakes.

## Play in your browser

[**Open Pixel Book — public web app**](https://buook.felix13.chatgpt.site)

No installation or account is required. The browser version uses the same book renderer and editing tools as the desktop app. Your shelf is saved **in your current browser on this device**, not on a public server. Desktop and browser shelves are separate; clearing browser data removes that browser’s saved books. Keep the same web address to return to the same shelf.

The approved working checkpoint is **v1.0.11**. The app displays **Pixel Book**; Windows installers/executables retain their legacy **The Book** identifier. The application ID and save location are intentionally unchanged so existing books keep working.

The current development version is **v1.0.27**. It adds a semantic page-design workshop, direct-on-page illustration regions and a separate **Inferno · Illustrated** edition, alongside the 50 spine ornaments, proportional shelf books, corrected closed-book rotation and connected opening animation. The 3D table includes a standing bookshelf with right-click move/read/cover actions. The original web address and desktop save location remain unchanged.

**Edit pages** opens page navigation, a flat live preview, content/typography/illustration tools, linked contents rows, and per-page undo/source restore. Dorian Gray's contents retain chapter Roman numerals as labels rather than misreading them as folios, and its preface keeps the heading and paragraph gaps. Sparse pages do not enlarge their body font. Early leaves drape over the binding lip and settle onto the board.

**Add page art** enables a pen cursor: draw a closed dotted region on an open page, then choose a JPG/PNG with **Pixel ink** or **Leave original**. Pixel ink smooths/downsamples, removes edge-connected white paper and quantizes to restrained sepia; originals remain retained. Region polygons use page material coordinates, so pictures curve and turn with their own page. Uploads and drawings are stored as content-addressed binary blobs in local IndexedDB; only compact references/placement live in page JSON. Clearing browser data removes this local artwork too. The workshop also supports ordinary image uploads and switching bundled art between original and pixel ink.

**Inferno · Illustrated** uses the clean [Project Gutenberg 8800](https://www.gutenberg.org/cache/epub/8800/pg8800-images.html) Cary/Doré source: Inferno only, 34 cantos, 75 plates, 4,648 verse lines and 340 newly composed pages. This is not the 250-page scan's pagination. The existing 410-page Longfellow Divine Comedy is unchanged. Both original and pixel-ink WebP plates are bundled and lazy-loaded. `scripts/book_art_pipeline.py`, `scripts/extract-book-art.py` and `scripts/import-illustrated-inferno.py` implement the reusable pipeline; the personal `pixel-book-art-pipeline` skill documents import, storage, placement and QA invariants.

To change spine ornaments, close the book, open **Book options → Design the front cover → Spine ornaments**, and choose top/bottom motifs or a matching pair. The art-history collection includes classical, Gothic, Renaissance, Baroque, Art Nouveau and Art Deco-inspired ornament. See [generation notes](assets/spine-ornaments-prompts.md).

The novel text follows the supplied PDFs page for page, including blanks: **Dracula has 509 reading pages; Frankenstein has 268**. Dracula's physical binding has one extra blank reverse, excluded from reading-page counts. Original text-extraction artifacts may remain. Older expanded editions with edits or bookmarks are preserved as a separate “previous pagination” shelf copy during migration. Bundled novel text stays outside localStorage; your edits, copies and shelf remain local.

Use **Contents** above the book to select a chapter, or the always-visible **Page / Go** box beneath it to jump to a PDF page number. **Read text** opens selectable, unwarped text with adjustable 18–34 px type and previous/next page buttons; returning to the book navigates to that same page. The main novel renderer also uses higher-resolution text without changing the original PDF's page boundaries. Outside and inside covers use native full-colour pickers.

### Added classics and source PDFs

These seven editions are added once to existing shelves without replacing edits, copies, fonts or bookmarks. Deleting one keeps it deleted on subsequent launches. Counts include source front matter and blank pages, not just printed folios; an odd-length PDF gets a blank physical reverse that is not counted as a reading page. Dante's verse and Shakespeare's dialogue retain line breaks. The complete English Divine Comedy uses Henry Wadsworth Longfellow's 1867 translation.

| Book | Author | PDF pages | Source PDF |
| --- | --- | ---: | --- |
| The Picture of Dorian Gray | Oscar Wilde | 138 | [Download](https://www.globalgreyebooks.com/ebooks/oscar-wilde_picture-of-dorian-gray.pdf) |
| Peter Pan (Peter and Wendy) | J. M. Barrie | 100 | [Download](https://www.globalgreyebooks.com/ebooks/james-m-barrie_peter-pan.pdf) |
| The Divine Comedy | Dante Alighieri | 410 | [Download](https://www.globalgreyebooks.com/ebooks2/dante-alighieri_divine-comedy.pdf) |
| The Time Machine | H. G. Wells | 60 | [Download](https://www.globalgreyebooks.com/ebooks/h-g-wells_time-machine.pdf) |
| Common Sense | Thomas Paine | 27 | [Download](https://loveman.sdsu.edu/docs/1776ThomasPaine.pdf) |
| The Secret Garden | Frances Hodgson Burnett | 151 | [Download](https://www.globalgreyebooks.com/ebooks/frances-hodgson-burnett_secret-garden.pdf) |
| Romeo and Juliet | William Shakespeare | 114 | [Download](https://www.globalgreyebooks.com/ebooks/william-shakespeare_romeo-and-juliet.pdf) |

The app bundles public-domain text, not the publishers' PDF artwork or branding. Source PDFs are kept locally under `release/library-pdfs/` when running `scripts/import-online-library.py`; they are not uploaded in the app build. [Global Grey's usage terms](https://www.globalgreyebooks.com/terms-conditions.html) permit reuse of these public-domain texts with their branding removed. Sources and file hashes are retained in `assets/classic-library.json` for provenance. The Common Sense source is hosted by San Diego State University.

### PDF book design

`scripts/design-pdf-library.py` reads source outlines, named destinations, placed images and contents annotations into `assets/book-designs.json`. Frankenstein's original three contents pages are rebuilt as aligned clickable rows with their original printed references; targets use real PDF page objects, not guessed offsets. The external Contents includes its Preface, volumes, letters and repeated chapter names with volume context. Source page counts remain unchanged.

Title pages receive centered title/author compositions, chapter openings have a distinct heading hierarchy, blank Roman-folio versos stay blank, and repeated Frankenstein running heads are removed from prose. Dracula's 28 image-bearing pages are restored as page-bound artwork with their original proportions and accessible-reader alt text. Modern third-party publisher covers and branding are not bundled. Full PDFs remain external source files; this is a semantic import, not a rasterization of every text page.

The curved page chain is spaced by material arc length so equal source columns no longer expand sharply at the binding. Text, artwork, keepsakes and contents hit areas share the same page mapping. A reusable local Codex skill, `pixel-book-pdf-design`, records the import decisions and release checks for subsequent editions.

### Live fonts

The **Book font** selector above the book changes page lettering immediately; the matching selector in **Read text** previews the same choice at a larger size. Each book remembers its font. **Original page fonts** restores its original per-page styling. Switching fonts never adds or removes PDF pages. A single body size is selected for each book/font against all source-page text regions; short chapter-ending pages retain their empty space instead of enlarging text. Title/chapter-heading hierarchy remains separate. Dense PDF editions can still require small physical-view lettering to preserve page boundaries; **Read text** provides an adjustable larger view without repagination.

**Alagard** is the default, including folios, titles and contents. Existing books using the former default are upgraded once; books with another selected font keep it. An explicit Original page fonts selection made after the upgrade remains respected.

Both prototype builds include all 25 user-supplied TTF/OTF fonts, with their existing metadata and notices preserved. **Add fonts…** loads additional TTF/OTF files privately into your browser's IndexedDB and restores them after reload; imported files are not uploaded. Legacy `.fon` files are unsupported; the supplied Zelda DX TTF counterpart is usable. Fonts retain their individual terms, credits and license notices in `assets/fonts/FONT-NOTICES.txt`; they are not relicensed as project code. Redistribution terms have not been audited for a production release. Pixel Pirate and SD Auto Pilot have compatibility-repaired character maps; their glyph artwork is unchanged.

## Inspiration and credit

**Pixel Book is inspired by the interactive Book of Grudges in [Grudgekeeper](https://cartooncyb.org/), the dwarf RPG created by Jae / Cartoon Cyborg.** The book's tactile page turns, layered paper, and small keepsakes were the starting point for this project.

Watch the creator's [Grudgekeeper Dev Log #1 — I'm building a 6-path RPG by myself. Here's everything so far.](https://www.youtube.com/watch?v=W3H2AYEvl94).

This is an independent project, not an official Grudgekeeper product or an endorsed port. Grudgekeeper, its artwork, and its original book design belong to their respective creator/rightsholders. Reference recordings and screenshots are not distributed in this repository. The sprites used here were generated and adapted for this project; their provenance is documented in [assets/generation-notes.txt](assets/generation-notes.txt).

## Download

See [Releases](https://github.com/ijustcreate/pixel-book/releases) for Windows x64 packages:

- `The-Book-Setup-1.0.11.exe` — installer.
- `The-Book-Portable-1.0.11.exe` — runs without installing.

These are unsigned Windows builds. Windows may show a publisher/reputation warning. [SHA-256 checksums](docs/releases/v1.0.11.sha256) accompany the release.

## Features

- Curved, perspective-mapped page turns, adjustable page count, animation speed, and keyboard or drag navigation.
- Editable page content, headings, fonts, images, pixel-art tools, contents navigation, and automatic page numbering.
- Customizable outside/inside cover colors, gold or silver hardware, cover text/symbols, and titled spines.
- A locally saved shelf, including a separate save-copy action.
- Inspectable, draggable loose inserts and taped keepsakes.
- Closed books with physical front/back boards, spine, and inset paper faces in a shared perspective camera.
- A 3D table for arranging saved books into stacks, with per-book rotation and browser-local layout persistence.

### Closed-book controls

Close a book or choose **View spine**, then drag to rotate it freely. Scroll to zoom; double-click or choose **Open selected book** to return to the original animated pages. Arrow keys orbit; Enter opens; +/− zoom.

Opening moves the selected 3D book into reading position and hinges its cover into the existing page view. Closing reverses the motion and restores its original camera/table placement. The page-turn mesh remains unchanged.

Choose **3D book table** (also available as **Arrange in 3D** on the shelf) to arrange the current book and saved shelf books. **Rotate view** orbits the camera. **Move books** lets you drag a selected book onto another to stack, or away to separate. The ↶/↷ Book buttons (or Q/E) rotate the selected book on the table. **Stack all**, **Spread out**, and **Reset view** offer quick arrangements. **Add current copy** saves an actual copy to your shelf, not a temporary demo object. Table positions and rotations survive reloads. Stacks snap into place and settle when a support is removed; this is not a rigid-body physics sandbox.

### How inserts behave

A photo starts on one specific page face. It follows that face as the sheet lifts, without fading, and opaque paper hides it when the reverse faces the viewer.

When a loose insert finishes a turn, ownership transfers to the page or inside cover that was facing it **before** the turn—not to the back of the turning sheet. The landed sheet can cover it. Lifting that sheet away reveals it on its new support. Turning that newly supporting page carries the photo again.

Taped inserts stay anchored to their original page face, like artwork on that page. Pulling a loose photo near its centre mostly slides it; pulling off-centre blends translation and rotation using rectangular mass inertia. The grabbed material point stays under the pointer. Alt-drag spins in place.

Transparent artwork margins do not intercept clicks. A loose card spanning the gutter is pushed aside by contact with the turning sheet rather than floating above it; canceling the turn restores its original support.

### Edge bookmarks

Drag an insert so it protrudes past a top, bottom or outside page edge. It becomes an edge bookmark associated with that page, retaining its edge position, angle and depth in the paper stack as you turn other pages. Only its exposed tip is clickable while tucked into the stack. Click it to quickly flip to its associated page; a closed 3D book opens first, then flips there. Drag a bookmark fully back onto a visible page to remove its edge-bookmark behavior.

Edge bookmarks, including custom notes, survive reloads and are included when saving a book to the shelf. Their tips also appear on closed 3D books. This persistence applies to bookmarks; ordinary loose-insert simulation remains session-local.

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

The portable executable is not a self-contained book-data backup. Ordinary loose-insert positions, tape state, and the live simulation are currently session state; persisted edge bookmarks are the exception. The saved shelf is not a complete snapshot of every live simulation state.

## Regression checks

The scripts in `scripts/` require a resolvable `playwright` package with Electron support, in addition to the project's Electron installation. They launch isolated temporary profiles and do not use the real shelf.

```sh
node scripts/verify-insert-pickup.cjs
node scripts/verify-insert-transfer.cjs
node scripts/verify-edge-alpha.cjs
node scripts/verify-stack-edges.cjs
node scripts/verify-book-layers.cjs
node scripts/verify-web.cjs http://127.0.0.1:4174/
node scripts/verify-closed-3d.cjs http://127.0.0.1:4174/
node scripts/verify-cover-bridge.cjs http://127.0.0.1:4174/
node scripts/verify-spine-presentation.cjs http://127.0.0.1:4174/
node scripts/verify-library-and-photo.cjs http://127.0.0.1:4174/
node scripts/verify-reader.cjs http://127.0.0.1:4174/
node scripts/verify-fonts.cjs http://127.0.0.1:4174/
node scripts/verify-classic-library.cjs http://127.0.0.1:4174/
node scripts/verify-pdf-design.cjs http://127.0.0.1:4174/
node scripts/verify-consistent-type.cjs http://127.0.0.1:4174/
node scripts/verify-insert-lift.cjs
node scripts/verify-book-feel-formats.cjs
node scripts/verify-turn-performance.cjs
node scripts/verify-reader-shell.cjs
node scripts/verify-shelf-spines.cjs http://127.0.0.1:4174/
node scripts/verify-edge-bookmarks.cjs http://127.0.0.1:4174/
```

Set `BOOK_ASSERT_PICKUP=1` for first-frame pixel assertions. Set `BOOK_QA_EXE` to a packaged executable to check that build instead of the development app. `BOOK_VISIBILITY_STEPS` controls the insert suite's pixel-sampling density.

The checks cover actual first-frame photo visibility, opaque back-face occlusion, facing-page and inside-cover ownership, taped-face anchoring, dragging, multiple inserts, transparent paper edges, first/second-leaf stacks, matching paper-edge materials and joins, palettes, and shelf reloads.

## Project notes

- [Changelog](CHANGELOG.md)
- [Visual tasks and implementation history](BOOK_VISUAL_TASKS.md)
- [Asset-generation notes](assets/generation-notes.txt)

This is a work in progress. v1.0.11 preserves the accepted near-complete interaction baseline; it is not a claim that every editing or persistence edge case is finished. No blanket open-source license has been selected yet.
