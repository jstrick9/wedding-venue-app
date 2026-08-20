# Review #192 — Platform map Invalid LatLng (NaN, NaN)

Leaflet threw `Invalid LatLng object: (NaN, NaN)` on the venue network map
even when the table showed coordinates. Causes: non-finite lat/lng still
treated as “present”, and initializing the map before the container had a
pixel size.

## 1. What changed

- `parseMapPoint` / `formatMapCoordinates` require finite in-range numbers
- Tile map waits for a non-zero container, sets an explicit 360px height,
  calls `invalidateSize`, and only `fitBounds` when the map has a size
- Pins skip venues with incomplete coordinates

## 2. Validation

| Gate | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint:events` | Pass |
| `npm run lint` | Pass (0 errors / 47 pre-existing warnings) |
| Strict unused-locals scan | Pass |
| `npx vitest run` | **822 passed / 5 skipped** |
| `npm run build` | Pass — 2,280.66 kB / 542.36 kB gzip |
| `npm run build:split` | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |

---

*End of Review #192.*
