# Changelog

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
