# New Feature — 35: PNG/PDF floor-plan export

## What it does
Exports the current floor plan from the **live canvas SVG** as a high-resolution
PNG or a single-page PDF, in addition to the existing browser Print. New
**🖼️ PNG** and **📄 PDF** buttons appear in the Print Preview modal.

## Design
- `src/utils/layoutExport.ts` (dependency-free):
  - `renderSvgToCanvas` — clones + normalizes the canvas `<svg>`, strips
    cross-origin/`<image>` refs (so the canvas isn't tainted; data-URL images
    are kept), draws to an offscreen canvas at 2× with white padding.
  - `downloadLayoutPng` — canvas → PNG blob → download.
  - `downloadLayoutPdf` — canvas → JPEG → embedded in a minimal single-page PDF
    built by a compact generator (no external PDF library).
- `FloorPlanCanvas` now forwards its internal `<svg>` via an optional `svgRef`.
- `PrintView` receives `exportSvgRef` and offers PNG/PDF export buttons with
  loading + toast feedback.

## Notes
- High-fidelity: shapes, patterns, decor, chairs, labels all render (same SVG
  as the canvas). External photo images are omitted from the export (avoids
  canvas tainting / CORS).
- Works offline/single-file; no new dependencies.

## Validation
- `layoutExport.test.ts`: asserts the PDF generator emits a structurally valid
  single-page PDF (correct header/trailer/xref/startxref) and embeds the full
  JPEG bytes. Typecheck clean; full suite **301 / 11 skipped**; build succeeds.
