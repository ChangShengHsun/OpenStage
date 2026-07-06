# Handoff guide — implementing the rest of OpenStage

Audience: a future Claude session (likely Opus) continuing this project when
Fable is unavailable. Written 2026-07-06, right after video export landed.
Everything here was verified in the live repo on that date.

## 0. Read these before writing any code

1. `prompt.md` (repo root) — the spec and roadmap. Source of truth for scope.
2. `docs/design.md` — visual design tokens (palette, fonts, spacing). Reuse
   them; do not invent new colors.
3. This file, fully.
4. Project memory: `~/.claude/projects/c--Users-ivan-chang-funcode-dance-editor/memory/`.

## 1. Non-negotiable rules

- **Legal red lines (from prompt.md):** the project name is OpenStage only.
  Never mention third-party product/trademark names in code, UI, or docs.
  Never copy third-party code, UI, or assets.
- **Talk to Ivan in Traditional Chinese (繁體中文); all code, comments,
  filenames, and commit messages in English.** Ivan is a beginner programmer:
  define technical terms on first use, reasoning before conclusion.
- **Never claim something works without running it.** The backend is the
  standing example: it compiles but is runtime-UNVERIFIED (no Docker on this
  machine) and every claim about it must say so.
- **Conventional Commits**, one feature per commit. Commit + push after each
  verified milestone (Ivan pre-authorized this workflow for this repo).
- TypeScript strict + `noUncheckedIndexedAccess` everywhere. Zero `any`,
  zero `@ts-ignore`. `pnpm typecheck` must stay clean.

## 2. Domain conventions (breaking these corrupts saved docs)

- Stage units are **meters**. Rotation is **degrees, 0 = facing the audience**
  (downstage = +y in 2D plan = +z in 3D), increasing **clockwise** on the plan.
- Persistence keys: doc in localStorage `openstage-doc` (zustand persist
  envelope `{ state: {...} }`), audio blob in IndexedDB `openstage-media`,
  version snapshots in IndexedDB `openstage-history`. Changing a persisted
  shape requires a backward-compatible `merge` in `store.ts` persist options
  (see how `comments` defaults to `[]`).
- Formation invariant: **play order == start-time order**. Any start-time
  mutation must go through `reindexByStart` (`state/formationOrder.ts`).
- Bézier transition control points are stored on the position being **left**
  (`curveControlPoints[0]` on the departing formation's position).

## 3. Repo map — who owns what

```
apps/web/src/
  state/store.ts        Zustand store: doc state, undo/redo (snapshot stack),
                        persist. undoOverride hook lets collab swap undo/redo.
  state/interpolate.ts  posesAtTime (linear + Bézier), timecode/8-count format.
  state/formationOrder.ts / templates.ts / csv.ts / history.ts / user.ts / viewMode.ts
  collab/collab.ts      Yjs mirror (one Y.Map entry per entity), awareness,
                        Y.UndoManager, room seeding/adoption.
  components/           TopBar, CastPanel, StageCanvas (2D konva editor),
                        Stage3D (lazy three.js), Timeline, PropertiesPanel.
  export/pdf.ts         jsPDF walk charts.  export/video.ts  MediaRecorder capture.
  audio/audioPlayer.ts  singleton audio + IndexedDB persistence + waveform peaks.
packages/shared-types/  domain model — REBUILD after editing
                        (`pnpm --filter @openstage/shared-types build`),
                        consumers import from dist/.
packages/path-planner/  Hungarian assignment + segment-crossing detection.
apps/collab-server/     y-websocket relay (see pin warning below).
apps/api/               NestJS + SQL schema — written to spec, UNVERIFIED.
e2e/                    Playwright suite (15 tests). Unit tests live next to
                        the code (vitest, 32 tests).
```

## 4. Verified vs unverified (as of 2026-07-06)

- ✅ Verified in browser + CI: MVP, V1, V2, and video export. 32 unit +
  15 e2e green; lint/typecheck/build green.
- ⚠️ UNVERIFIED: everything needing Docker — `apps/api`, Postgres schema,
  docker-compose, the web/collab Dockerfiles. First session on a machine
  with Docker: `docker compose up`, run migrations, hit `/api/health`,
  then remove the "not integration-tested" caveats from README and code.

## 5. Traps that already bit us (do not rediscover these)

1. **collab-server must stay on `y-websocket@1.5.4`.** `@y/websocket-server`
   0.1.5 (yjs v14 RC) corrupts the server doc (`store.getClock` TypeError);
   the realtime relay looks fine but **late joiners get no history**. Any
   upgrade must re-run the late-joiner test (open room, edit, open second
   browser, assert it received the history).
2. **Every new runtime dep used by apps/web must be added to
   `optimizeDeps.include` in `apps/web/vite.config.ts`.** Otherwise the dev
   server re-optimizes on first use and reloads the page mid-click/mid-test.
   This produced three separate confusing failures.
3. **`e2e/editor.spec.ts` mirrors the canvas layout math** (`meterToPx`).
   If panel widths/heights in `index.css` change, that helper must change too
   or drag tests miss their targets.
4. **React StrictMode double-mounts effects.** Anything acquiring a singleton
   resource must be idempotent (see the shared in-flight promise in
   `audioPlayer.loadPersistedAudio`).
5. **File inputs need explicit `aria-label`s** and e2e selectors must target
   them precisely — a WAV once got parsed as a 721-row CSV roster because the
   selector grabbed the wrong `input[type=file]`.
6. **PowerShell + git heredocs:** em-dashes/apostrophes in commit messages
   have broken pathspec parsing here. Keep commit messages plain ASCII.
7. **Video export is realtime capture** (MediaRecorder). Export duration ==
   show duration and the tab must stay visible. The upgrade path (WebCodecs +
   an mp4 muxer dep) is noted in `export/video.ts` — only take it if Ivan
   complains about export time.

## 6. Working agreement / definition of done

For every feature: (1) implement minimally, matching existing style;
(2) unit-test pure logic, add one e2e for the user-visible flow;
(3) run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`
— all green; (4) when UI changed, take a Playwright screenshot and actually
look at it; (5) commit (Conventional Commits) and push; (6) update README
roadmap + the project memory file when a roadmap phase completes.

`pnpm e2e` reuses a running dev server locally; port 5173 stuck from a stale
process → `Get-NetTCPConnection -LocalPort 5173 | Stop-Process`.

## 7. Remaining roadmap, with implementation guidance

### FIRST TASK QUEUED BY IVAN — translate the UI to Traditional Chinese

The i18n architecture is already built and wired (2026-07-06); the ONLY
remaining work is translation. Do not restructure anything.

- How it works: `apps/web/src/i18n/index.ts` — a typed dictionary pair.
  `en.ts` defines the `Messages` shape; `zh.ts` is declared `: Messages`, so
  a missing/mistyped key fails `pnpm typecheck`. Components call `useT()`,
  non-React code calls `messages()`. Locale persists in localStorage
  `openstage-locale`; the switcher is the `<select>` in the TopBar.
- Your task: in `zh.ts`, replace every English placeholder VALUE with
  繁體中文. The file's header comment lists the rules and a dance-context
  glossary (performer 舞者, formation 隊形, …). Do not touch keys, function
  signatures, `dateLocale`, or `locale.english`/`locale.chinese`.
- Out of scope: PDF export stays English (jsPDF's built-in fonts have no CJK
  glyphs — Chinese would render as garbage; a subsetted CJK font embed is a
  separate task). Video export renders via browser canvas, so it follows the
  UI language automatically. `formatTimecode`/`formatEightCount` notation
  stays as is.
- Acceptance: `pnpm typecheck && pnpm lint && pnpm e2e` green (e2e runs
  under the `en` default, so translations must not break it); then switch
  the UI to 中文 in a real browser and screenshot-review every panel
  (TopBar, Cast, Properties for performer AND formation selection, Stage,
  History, Comments, Timeline) — check for overflow/truncation, since
  Chinese strings are often shorter but panels are narrow.

### V3a — rule-based formation suggestions
Pure functions in a new `apps/web/src/state/suggest.ts` (or extend
`templates.ts`): given performer count + stage size, score/derive candidate
next formations (spacing balance, symmetry, minimal travel from current —
reuse `planTransition` for travel cost). UI: a "Suggest" section in
PropertiesPanel offering 2–3 candidates with previews; applying one is a
normal history-recorded position write. **No ML, no network calls** — rules
only, that's the spec. Acceptance: unit tests for the scoring math; e2e:
click suggest, apply, positions change and undo restores.

### V3b — GIF export (video export is DONE)
Needs an encoder dep (`gifenc` is small and MIT). Reuse the frame-drawing
code in `export/video.ts` — extract the `draw(tMs)` body so both exporters
share it; render offline at ~12fps, 640px wide (GIFs get huge fast).
Remember trap #2 (optimizeDeps). Acceptance: e2e downloads a `.gif` > 10KB.

### V3c — PWA offline
Use `vite-plugin-pwa` (workbox). The app is already offline-capable in spirit
(localStorage + IndexedDB); the plugin adds a manifest + service worker to
cache the shell. Careful: a service worker caching stale JS is the classic
footgun — use `registerType: 'autoUpdate'` and verify a deploy actually
updates. Acceptance: `pnpm build && pnpm preview`, DevTools offline mode,
app still loads; document that collab obviously needs network.

### V3d — BPM calibration — DONE (2026-07-06, as tap tempo)
Ivan rejected automatic signal-analysis detection on real music ("這個功能
很爛") and asked for manual tap calibration instead: click "Calibrate BPM"
on a downbeat, keep clicking once per beat, apply the measured tempo.
Implemented in `apps/web/src/audio/tapTempo.ts` (pure: span/(n−1) estimator
+ 3s-pause auto-restart, 7 unit tests) + StageSection UI + one e2e.
The old detector (`audio/bpm.ts` + its 9 tests) is PARKED — pure,
self-contained, no UI references it. If a future feature wants auto-detect
(e.g. pre-filling the tap value), start from Ivan's UX complaint, not from
re-enabling it as-is; delete the file if Ivan says so.

### V4 + backend (bigger, propose a plan to Ivan first — >10 files rule)
- **Backend verification** (first Docker session): see §4.
- **Server-enforced roles:** JWT auth in apps/api; collab-server checks a
  signed room token on WebSocket upgrade (y-websocket 1.5.4 exposes an
  auth callback via `docker`/`server.js` wrapper — check its README at that
  version). `?mode=view` stays a UI convenience.
- **Yjs persistence:** y-leveldb bindings on the collab server, or periodic
  snapshot-to-Postgres. Re-run the late-joiner test (trap #1).
- **Plugin architecture / marketplace / one-click self-host:** genuinely
  open design questions — present options + trade-offs to Ivan, don't pick
  alone (his `rules/judgment.md` §6 procedure).

Also see `docs/feature-ideas.md` for suggested off-roadmap features.

## 8. When stuck

Two failed fixes for the same bug, each producing a new different error =
wrong layer; stop and re-diagnose (Ivan's global `rules/judgment.md` §4).
Report failures with the full error, most likely cause, and what you ruled
out. An honest "stuck" beats a fake "done" — Ivan explicitly prefers it.
