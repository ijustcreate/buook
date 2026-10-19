# Book rendering tasks — 19 October 2026

## Problems visible in the supplied spine-view screenshot

1. The spine is almost face-on while the cover uses a different projection. Their upper and lower edges do not describe one solid book.
2. The right-hand cover floats above a large, flat backing polygon. The polygon reads as a second red cover, not a thin board edge.
3. A dark gap separates the spine from the cover. Their contact edge is not shared.
4. The spine looks like a flat pasted image. Raised bands, panel highlights, and its rounded cross-section do not agree in depth.
5. The book name is a separate screen-aligned overlay. It crosses the ornaments and bands, is too small, and the backing strip hangs below the book.
6. The cover's outer edge, border, and hardware do not converge consistently with the spine.
7. The old color treatment leaves red fringes and recolors warm highlights as if they were metal. Coded red/brown backing faces ignore the chosen cover color.
8. The silhouette lacks a convincing thin board edge and a single coherent contact shadow.
9. Book thickness changes the widths of unrelated rectangles instead of changing one physical dimension.

## Task A — artist: modular book materials and matching covers

Prompt: Split the existing open-cover artwork into a rigid cover board and a flexible central binding. Preserve the original pixels, stitched lining, corner guards, bevels, and transparent silhouette. Use one board and mirror it for the opposite side. Split the outside cover from its narrow spine strip as well. Do not paint page edges into either cover. Keep the corners and rails aligned across the seams. The same pieces must work on an exposed inside cover, a closing cover, and a closed book.

Deliverables: `inside-board-v3.png`, `open-spine-v3.png`, `outside-board-v3.png`, and `closed-spine-v3.png`, plus the reproducible crop script.

Acceptance: Matching front/back board proportions; no duplicate hinge rail; no rectangular patch over the lower binding; preserved alpha; all art derived from the supplied book assets.

## Task B — artist: spine title and material colors

Prompt: Move the existing fleur-de-lis emblem into the top end panel and repeat it in the bottom end panel. Retain the two outer bands separating these end panels from the title area, and remove both raised bands and all dividers inside the middle. Replace the middle ornamentation with matching, undistorted leather grain sampled from the existing plain panel. Create one uninterrupted title panel extending between the two end bands. Fit a single line of large gold or silver lettering along this full panel. The title and its texture must belong to the spine surface and must never extend outside its silhouette.

Treat leather, lining, and metal as different materials. Recolor all pixels of a material, including its dark texture and translucent edge pixels. Preserve shading and stitching. Sage must contain no rose speckling; blue leather must contain no red fringe. Keep the paper and deckled page edges warm when cover colors change. Gold/silver must affect actual hardware and ornamentation, not random yellow leather highlights.

Acceptance: Legible name in the reserved panel; no overlap with raised bands; no dangling title rectangle; matching selected colors on all visible surfaces, including edges, shelf spines, and lettering.

The bottom emblem is rotated 180 degrees, pointing down, to mirror the upright top emblem. Rotate only the emblem, preserving the lighting and frame of the lower panel.

## Task C — programmer: one perspective model for the spine view

Prompt: Render a closed book using shared 3D coordinates. Define height, cover width, board thickness, and book thickness once. Derive book thickness from page count. Project every surface through the same camera, looking toward the spine and the front cover at a steep angle. Model the spine as a rounded cross-section with several textured strips. The front board and the spine must use the identical vertices along their contact edge. Crop transparent texture padding before mapping it. Apply the complete spine texture, including its title, to the curved surface.

Remove the large backing slab and independent screen-space label. Show a thin, shaded board edge where it is visible. Render the front board before the nearer rounded spine. Keep the fore-edge/page block occluded from this camera. Position a single subtle contact shadow under the complete silhouette.

Acceptance: No visible gap at the hinge, no detached colored polygon, consistent convergence of all edges, rounded rather than flat spine, and no exposed pages. Thin and thick books must use the same geometry and camera.

## Task D — programmer: open-book layers and hinge joins

Prompt: Give the resting paper and every underlying layer one shared spline profile. Compute the side block and lower page fan from the same upper and lower edge coordinates. Keep the bottom of the stack seated on the cover plane as pages are added; lift the paper surface to create thickness. Taper the fan into the spine, with continuous tangents. Draw the lower spine cap behind the paper. Use the modular cover artwork in every state so turning the first or last sheet does not swap the entire inside-cover frame.

The upper edges of the open leaves and their underlying layers must sit above the top cover rail from the reading angle. Raise the upper profile without moving the seated bottom stack or lifting the whole book. The curved paper should occlude the rail, including during a turn.

Use a shared perspective mapping for the paper and the edge strips, with stronger foreshortening toward the upper edge. Texture rows must converge with the geometry rather than remaining horizontally stretched.

On the first spread, attach the page's left binding edge to the left edge of the flexible spine. Shift the shared page hinge progressively toward the right spine edge as the book is turned through. Keep the fuller underlying block seated against the cover so its outer edges are exposed on the right at the beginning and on the left at the end. Move clipping, hit detection, inserts, and page-turn shadows with the hinge.

Acceptance: No L-shaped corner gap, square cutoff, hanging stack, rectangular hinge patch, extra vertical rail, or exposed top cover rail above a resting page. Check first, middle, and last spreads at 8, 28, and 56 pages, and both page-turn directions.

## Task E — programmer/QA: palette, persistence, and packaged app

Prompt: Verify rose, sage, slate, and parchment linings with outside-cover colors and gold/silver hardware. Confirm material recoloring does not tint the paper. Check open covers, both closed covers, spine view, and shelf thumbnails. Exercise closing, reopening, flipping the closed book, changing page count, and reopening a saved book. Package and install the Electron build without changing the user's saved shelf or active book data.

Acceptance: No renderer errors; no missing sprites; correct palette after reload; physical thickness varies with page count; saved books retain their prior content and selected colors.

## Implemented and verified for 1.0.3

- Modular mirrored inside/outside boards and separate open/closed spine pieces.
- Shared curved page-block geometry, seated lower corners, raised upper paper edges, and a hinge that transfers between the two spine edges.
- A single perspective camera for the rounded spine and front board, with the page block occluded.
- Emblems in the top and bottom spine panels; only the two end bands remain; one long title panel with fitted lettering.
- Material-based recoloring, including transparent fringes, hardware, lettering, and shelf colors. Paper edges retain their original color.
- Correct last-spread selection when flipping a closed book to its back and reopening it.
- Automated renderer checks cover 8/28/56 pages, first/middle/last spreads, both turn directions, all four palette families, both closed covers, spine view, long names, rapid turns, closing/reopening, and saved-palette/shelf reloads. No renderer errors were reported.

The reproducible visual-check script is `scripts/verify-book-layers.cjs`. It uses isolated temporary app profiles and never changes the user's shelf.

The packaged Windows build also passed these checks. Version 1.0.3 was installed, its application archive matched the tested package, and the existing saved-book storage remained byte-for-byte unchanged through installation. A pre-update profile backup was retained under the user's `AppData/Roaming/The Book backups` folder.

## Loose insert transfer — 1.0.4

Loose cards use the same curved page-surface mapping as attached inserts throughout the turn, including their reverse face. On landing they transfer to the opposite page face without sliding underneath the stack. Their local rotation reflects with the page; reversing the turn restores the original position and orientation. Taped inserts retain their original page ownership and are occluded when that face turns away.

`scripts/verify-insert-transfer.cjs` checks matching pickup/landing geometry, reverse-face rendering, clickable landing, cancelled turns, 20 drift-free round trips, subsequent-page occlusion, and taped ownership. It runs against an isolated temporary profile. The existing book-layer regression suite also passes.

### Corrected loose-card ownership — 1.0.5

Clarification: after a loose insert lands, it stays on that side of the open book, not on the sheet that carried it. Turning back leaves it on the exposed underlying page or inside cover. Later leaves land beneath it. Only tape ties a card to a particular sheet face. Explicitly moving a loose card resets its deposited-side status. The transfer test now asserts this behavior in both directions, including a strongly rotated card, instead of incorrectly requiring loose cards to travel back with the sheet.

### Correct depth and drag placement — 1.0.6

The 1.0.5 implementation incorrectly promoted deposited cards onto every new leaf and drew them after all moving paper. Deposited cards now rest at a specific page depth: subsequent sheets cover them and uncover them on return. If their supporting sheet is turned away, loose cards release onto the newly exposed surface on that same side; taped cards remain with their sheet. A short contact-release blend avoids a discontinuity at pickup. Inserts on an inside cover use the board's own mapping, not an elevated paper-stack profile.

Dragging uses the same perspective surface as resting inserts. Numerical inversion of that surface replaces approximate screen-width division at drop, and hit centers use the actual projected card center. Checks now include real mouse pickup/drop geometry, perspective round trips on both boards and interior pages, two inserts transferring together, normal moving-paper occlusion, and no resurfacing through later pages.

### Rigid photos and anchored dragging — 1.0.7

Loose photographs now use one rigid tangent plane instead of independently bending strips that fold back through one another during the curl. Both sides share that plane, and a hairline card edge remains visible at the edge-on instant. Taped artwork still follows the flexible sheet. Contact release uses the same rigid geometry at pickup and landing.

Normal dragging preserves the card's rotation. An off-center grab is inverted into the card's plane, then solved against the pointer on every move, rather than generating a twist from a lever-arm heuristic. Mouse tests cover grabs on opposite corners, unchanged angle, pointer anchoring, and matching geometry before and after release. Pixel-difference tests sample both turn directions to detect actual disappearance, not just emitted draw calls.

### Opaque turning-sheet occlusion — 1.0.8

The 1.0.7 visibility check had the wrong invariant: a card behind opaque paper must become invisible. Turning cards were painted last, which placed their reverse above the sheet's back. The turning sheet now has a rasterized screen-space depth and material-coordinate buffer. Carried inserts render into an isolated layer, then opaque paper masks overlapping hidden-face pixels and nearer curled strips. The local contact patch is distinguished from another overlapping fold so the card's supporting surface does not incorrectly hide its exposed front. A card's reverse is exposed on deposition at the end of the turn, not through the opaque back of the moving leaf. Endpoint geometry remains continuous, and the fixed-angle, pointer-anchored drag behavior is unchanged.

Pixel tests now require zero insert alpha over the sheet while its source face is hidden, and visible pickup/landing. They no longer require a card to be visible through every phase of a curl. Tests retain both turn directions, taped-face ownership, subsequent-page coverage, multiple inserts, cancelled turns, repeated turns, and actual off-center mouse drags.

### Transparent free edge — 1.0.9

Removed the extra pale straight stroke between the turning leaf's outer top and bottom vertices. It painted across the parchment sprite's transparent/torn silhouette, producing the visible pixel line flagged in the annotated screenshot. The sprite alpha now defines the free edge without an opaque outline. The insert-depth correction from 1.0.8 is retained.

### Current-page support, no fading — 1.0.10

The user clarified that a loose image must follow the page it currently rests on, including when that page is turned back. Removed the historical landed-side exception, virtual ownership reassignment, early contact-release opacity animation, and history-dependent renderer skip. Loose inserts now have one rule: travel with the current supporting page, transfer to the opposite exposed face on commit, and follow that new face whenever it is turned. Unrelated leaves can cover and uncover the insert without changing its support. Taped inserts retain their original anchored face instead of transferring. Paper depth masking, fixed-angle dragging, rigid card geometry, and transparent parchment edges remain in place.

Tests assert full draw opacity during both turn directions, ownership changes only on commit, multiple images following forward and back, 20 drift-free round trips, covering/uncovering by unrelated leaves, and an interleaved middle-book sequence. Pixel tests continue to require no visibility through the back of opaque paper.

### First-frame rendering and true facing-page support — 1.0.11

Reproduced the immediate disappearance with actual image differences: thousands of visible photo pixels became zero at progress 0.001 in both directions. The triangle mapper built its clipping path through the main-canvas helper even when targeting the insert's offscreen layer. Calling clip on that layer's empty path removed the entire photo. Triangle clipping now constructs its path on its own target context. `scripts/verify-insert-pickup.cjs` checks the first frames at progress 0, 0.001, 0.01, 0.04, 0.1 and 0.2 for both turn directions and two placements/rotations; early lifted frames must retain at least 65% of the original visible pixels.

Landing ownership now targets the page that was opposite before the turn (`source - direction`), not the back of the turning sheet (`source + direction`). Thus the first right-hand photo lands on the inside front cover. The opaque turned sheet may cover it; lifting that sheet back reveals the photo on its new support. Interior facing pages and the inside back cover use the same rule. During travel, loose and taped inserts are visible only on their occupied sheet face; the reverse cannot display the photo or flash it on the final animation frame. Only loose inserts change ownership on commit; taped inserts retain their anchored page face. No opacity animation is used.

Transfer tests now explicitly distinguish the facing page from the turning sheet's back, exercise inside-cover deposits, uncovering, and moving the newly supporting interior page, and verify real first-frame pixels alongside back-face occlusion. Existing drag, palette, shelf, and transparent-edge checks are retained.
