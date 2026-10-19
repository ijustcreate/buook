# Changelog

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
