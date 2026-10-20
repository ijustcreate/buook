# Changelog

## 1.0.29 — 2026-10-20

- Run page turns against real elapsed time rather than capped frame increments, so low frame rates no longer prolong the animation. Warm destination page textures before starting the clock.
- Reuse projected mesh vertices and per-mesh book state. Retain six texture rows, original resolution, font sizing, illustration data and geometry for all readable page faces.
- Use one texture row only for mostly occluded paper-grain layers during turns; restore the exact full-detail idle mesh. Keep the visible stack ribbons, cover, binding and inserts unchanged.
- Reuse unchanged page-lighting textures with source-identity and exact lighting keys.
- Add before/after rendering, readable-detail, visual-difference and simulated slow-frame timing checks; retain the existing typography, contents, artwork, binding and insert regression checks.

## 1.0.28 — 2026-10-20

- Lift keepsakes directly from the page into a transparent, centered inspection view, with floating labels/actions, restrained shadows and an animated return to the original placement.
- Persist the inspected side, tape and insert placement across book switches, copies and reloads. Tape short, translucent strips to item-sized side/diagonal/edge placements; keep the taped side visible.
- Default bundled PDF editions to their source trim proportions. Add source, portrait, trade, square and custom page shapes; preserve glyph and illustration proportions without changing saved art coordinates.
- Center Inferno verse columns while keeping individual lines left-aligned and sparse pages at the edition’s fixed font size.
- Replace chapter-jump teleporting with bounded, complete page-bundle turns, quiet local paper/woosh sounds and optional subpixel book movement. Respect reduced-motion preferences and retain sound/movement switches.
- Add insert-lift, return/flip/tape persistence, mobile placement, format/copy persistence, complete chapter-turn and offline audio-level regression checks.

## 1.0.27 — 2026-10-20

- Replace the old catch-all page form with a page workshop: all-page navigation/search, live flat preview, composition-specific text/title/contents/verse controls, typography and illustration tabs, local autosave, per-page undo and source restore.
- Fix chapter Roman numerals being mistaken for contents folios. Use readable two-column contents where needed and retain front-matter headings/paragraph gaps from PDF geometry.
- Let early leaves drape from the shared binding lip onto the board, retaining equal material-distance mapping.
- Add pen-cursor, dotted polygon image regions directly on the curved page; JPG/PNG original or reversible pixel-ink upload; page-bound clipping and turning.
- Store new uploads and drawings as SHA-256-addressed IndexedDB blobs rather than base64 in localStorage. Preserve existing images and original uploads.
- Add a reusable PDF/HTML illustration pipeline and personal skill, with compact original/pixel-ink variants, provenance, scanned-page review and lazy loading.
- Add a separate Cary/Doré Inferno from Gutenberg 8800: 34 cantos, 75 illustrations and 340 new pages; retain the existing complete Divine Comedy untouched.

## 1.0.26 — 2026-10-20

- Add two 5×5 transparent pixel-art ornament atlases: bookbinder flourishes and art-history-inspired variation. Select top/bottom independently, choose complementary arrow/key pairs, or keep the original flourish; migrate starter books to themed pairs without overwriting custom selections.
- Use paper leaves plus cover boards for shelf thickness, so short works are substantially thinner than long novels.
- Correct both drag axes for standalone closed books while retaining table orbit conventions.
- Warp the opening book as a connected material surface, removing detached stationary binding/shadow remnants. Fold the tail upward during the raised-cover arc and hide unrelated controls during the transition.
- Add a 3D standing bookshelf at the table's far end, persistent table/shelf placement, and an accessible right-click menu for moving, reading and inspecting books.

## 1.0.25 — 2026-10-20

- Use a single body font size per edition/font, checked against every text region; sparse pages retain whitespace instead of magnifying text. Preserve title/chapter heading hierarchy and source pagination.
- Cache word measurements and edition typography so changing fonts and turning pages stay responsive.
- Derive shelf height from source PDF trim dimensions independently of page-count spine thickness; use a standard fallback for custom journals.
- Keep verse/dialogue leading appropriate and distinguish Dante's prose appendix from verse.
- Extend the PDF-design skill with consistent-body-size and source-format shelf rules.

## 1.0.24 — 2026-10-20

- Replace plain bookshelf bars with the exact ornate spine textures from the closed 3D books, including raised bands, mirrored end ornaments, transparent contours and each book's title/leather/metal colours.
- Scale shelf thickness by the book's physical page-count model; retain accessible names, page counts, keyboard focus and click-to-open behavior.

## 1.0.23 — 2026-10-20

- Deform the flexible binding between the moving cover hinge and stationary board during opening/closing, rather than leaving the open-spine image frozen behind the moving cover.
- Keep the binding lining and ornate endcap on one shared surface with exact board-edge joins, for front/back and thin/thick books.

## 1.0.22 — 2026-10-20

- Make Alagard the default book font, including page numbers, title pages, contents and the large-text reader.
- Upgrade prior default/Original books once while preserving other selected fonts; later explicit Original page fonts choices remain intact.

## 1.0.21 — 2026-10-20

- Add seven PDF-sourced classics: The Picture of Dorian Gray, Peter Pan (Peter and Wendy), the complete Longfellow Divine Comedy, The Time Machine, Common Sense, The Secret Garden, and Romeo and Juliet.
- Retain each source PDF's page boundaries, add chapter/part/scene links, and preserve verse and dialogue line breaks.
- Seed newly added catalog books into existing shelves without overwriting private edits or restoring previously deleted starter books.
- Keep public-domain text outside localStorage and retain PDF provenance/download links without bundling publisher artwork or branding.
- Recover native PDF destinations and hierarchy for structured clickable contents, including all three Frankenstein contents pages, volumes, letters and repeated chapter names.
- Compose centered title/author pages and separate chapter headings; clean repeated Frankenstein running heads and blank Roman-folio versos without repagination.
- Restore Dracula's 28 source image-bearing pages with aspect-correct page-bound illustrations and accessible reader images.
- Resample curved leaves by material arc length to distribute texture scale evenly instead of concentrating magnification near the binding; retain shared keep-sake and TOC mapping.
- Create and validate the local `pixel-book-pdf-design` skill for future imports and edition-quality checks.

## 1.0.20 — 2026-10-20

- Match page-number lettering to the book's selected font, including the default novel serif, while preserving folio placement and PDF numbering.

## 1.0.19 — 2026-10-20

- Add live book-wide font selectors above the book and inside the large-text reader, with per-book persistence and an Original page fonts reset.
- Load all 25 supplied TTF/OTF fonts; preserve glyph artwork and license metadata, with compatibility repairs to two invalid character maps.
- Bundle all 25 supplied fonts in both prototype builds with existing notices intact; add private persistent browser font imports for additional files.
- Refit text using each font's measurements without changing source PDF page counts or dropping words.
- Smooth binding rolls across partial and full stacks with continuous hinge-to-flat tangents, and remove dark atlas end caps from the shared side/bottom paper-edge mapping.

## 1.0.18 — 2026-10-20

- Restore PDF-aligned pagination: Dracula 509 pages and Frankenstein 268, retaining blank source pages and excluding a blank binding reverse from reading counts.
- Preserve edited/bookmarked expanded editions as separate previous-pagination shelf copies during migration.
- Add always-visible Contents, page-number jump controls and selectable large-text reading with adjustable 18–34 px type.
- Render novel textures/framebuffers at higher resolution and preserve correct front/back UV dimensions during turns.
- Replace preset outside/inside colour menus with full colour pickers; trace the lining's true silhouette to eliminate untinted rose strips along sloped edges.

## 1.0.17 — 2026-10-20

- Start on the local shelf with Dracula, Frankenstein and the original Keeper’s Book; preserve existing shelf entries and seed starter editions only once.
- Import the supplied novels as reflowed, chapter-linked text; keep immutable base text outside localStorage and support up to 4,096 editable pages with bounded rendering caches.
- Move reading/navigation actions into collapsed Book controls instead of a permanent link stack.
- Scale open bindings, cover seams and closed-book thickness for thin notebooks and long novels.
- Blend loose-photo translation and rotation from a single grabbed material point using rectangular mass inertia, with no pointer slip; Alt-drag remains a fixed-centre spin.
- Restore the ornate upright spine-first 3D presentation, natural drag directions, readable spine lettering, correctly oriented back-board hardware, alpha-preserving lighting and silhouette-following board edges.
- Round first/last-page binding rolls and align the underlying paper layers; retain page-turn occlusion, taped/loose ownership and edge bookmarks.

## 1.0.15 — 2026-10-19

- Connected closed 3D books and the original reading view with a camera/geometry bridge and a hinged cover, including continuous viewport placement and reverse travel back to the original table position.
- Preserved exact starting-frame pixels, front/back cover artwork, selected-book identity and stack layout; honored reduced-motion preferences and locked controls during travel.
- Made taped/loose insert hit testing follow the rendered artwork’s alpha instead of large transparent rectangles.
- Added lateral page-face contact for loose cards spanning the gutter, with reversible preview and no change to ordinary carry/land rules.
- Added persistent top/bottom/left/right edge bookmarks with page/edge/angle/stack-depth tracking and exposed-tip hit regions.
- Kept bookmark tips visible in both paper stacks and closed 3D books; clicking them uses contents-style quick flips to their associated page, opening the book first when needed.

## 1.0.14 — 2026-10-19

- Renamed the visible project and public GitHub repository to Pixel Book; retained the existing site origin, application ID and save profile.
- Added perspective 3D closed books with separate boards, spine and inset natural-gold paper surfaces, back-face culling, textured faces, lighting and contact shadows.
- Added pointer orbit, zoom, keyboard controls, per-book rotation and selection, and opening the selected saved book in the existing animated renderer.
- Added a 3D book table with drag-to-stack, automatic support settling, stack/spread actions and locally persisted layouts.
- Kept open-book page meshes and loose/taped insert transfer rules unchanged.

## 1.0.13 — 2026-10-19

- Added the opposite board beneath the closed book’s page block for both front and back views.
- Rebuilt the closed paper block between parallel board planes, inset inside their edges; removed its red overlay and leather-colored lower band.
- Matched cover art to its opaque bounds instead of stretching its transparent margins across the cover plane.
- Included the far board in the shared-camera spine view.
- Added a public browser build, README launch link, reproducible static build/local preview, and browser page-turn/shelf-persistence checks.

## 1.0.12 — 2026-10-19

- Removed the phantom underlying stack beneath the first landed leaf on either side; underlying layers begin with the second leaf.
- Aligned stack ribbons to the actual parchment silhouette and made underlying sheets use the same crop as the visible page.
- Replaced the reddish leather texture on bottom page edges with the same golden parchment-edge texture used on the side.
- Added a generated transparent forest-green/gold pixel-art launcher icon, seven Windows ICO sizes, and application/installer icon configuration.
- Added focused stack-count, material, corner-join, and bottom-seam checks.

## 1.0.11 — 2026-10-19

Approved working baseline for the initial `buook` repository and version tag.

- Fixed photos disappearing at the first nonzero page-turn frame: clipping paths are now built on the correct rendering target.
- Kept photos attached to their occupied page face during travel; the opaque back of the sheet does not reveal them.
- Corrected loose-insert ownership to the originally facing page or inside cover when a turn commits.
- Preserved original page-face ownership for taped keepsakes.
- Retained full-opacity dragging, stable grab positions, and fixed angles.
- Retained transparent parchment free edges, layered page stacks, palette controls, editing tools, and the local shelf.
- Added first-frame pixel checks, front/back occlusion tests, both inside-cover deposits and uncovering, and middle-book transfer scenarios.

The GitHub checkpoint adds repository documentation and ignores without changing the approved application code, version, application ID, or save location. The Windows release packages are the already-verified 1.0.11 build.
