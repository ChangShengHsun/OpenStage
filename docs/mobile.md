# Mobile support (Android / iOS)

Shipped 2026-07-17. Two halves: a responsive touch UI, and a hosted PWA so
phones can install GridStage without any app store.

## Responsive / touch UI

- **Breakpoint 760px** — below it the three-column IDE grid collapses to
  `topbar / stage / timeline` in one column. The breakpoint lives in two
  places that must stay equal: `hooks/useIsNarrow.ts` (`NARROW_QUERY`) and
  the `@media (max-width: 760px)` block in `index.css`. App.tsx stops
  setting inline grid styles below it so the CSS rules can win.
- **Drawers** — the cast and properties panels become off-canvas drawers
  (`position: fixed` opts them out of the grid) opened by vertical edge
  tabs; a dimmed backdrop button closes them. One open at a time, state is
  session-local in App.tsx.
- **Coarse pointers** (`@media (pointer: coarse)`, i.e. any touch-first
  device regardless of width): finger-sized buttons, 16px inputs (below
  16px iOS Safari zooms the page on focus), 14px panel-resize handles.
- Panel resizers and the draggable widths are desktop-only; narrow mode
  uses fixed rows (timeline 170px).
- e2e: `phone layout: side panels become drawers behind edge tabs`
  (viewport 390×844) plus the existing `touch` describe block.

## Distribution: why PWA, not app stores

The web app is already fully client-side (localStorage/IndexedDB, offline
service worker, manifest + icons). Hosting it is the whole install story:

- `.github/workflows/pages.yml` deploys `apps/web` to GitHub Pages on every
  push to main → **https://changshenghsun.github.io/GridStage/**.
- Built with `GRIDSTAGE_BASE=/GridStage/` (Vite `base`); every asset URL in
  code goes through `import.meta.env.BASE_URL` (models, sw.js, guide
  screenshots) and the SW offline shell is scope-aware. Dev/e2e/desktop
  keep base `/`.
- Users install via the browser: Android Chrome "Add to Home screen",
  iOS Safari "Add to Home Screen". Standalone window, offline, no fees.

Native store apps (Capacitor/TWA wrappers) were evaluated and deferred:
they add a build pipeline per platform, developer accounts (Apple $99/yr,
Google $25 one-time), store review cycles, and for iOS a Mac to build on —
all to ship the same WebView UI the PWA already gives. Revisit only if a
store listing itself becomes a distribution requirement.

Known limits of the public page: no collab server (live share needs the
self-hosted stack), and documents live per-device (export → file to move).
