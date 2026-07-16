# Feature ideas — suggested additions beyond the prompt.md roadmap

Ranked within each group by (value to a real choreographer) vs (effort).
Nothing here is committed scope — Ivan picks. Effort: S (<half day),
M (a day-ish), L (multi-day / needs design discussion).

Status legend: ✅ done · ⬜ open · 🔶 **needs Fable** (see "Which need Fable").

## Editing quality-of-life

- ✅ **Mirror / flip formation** — left–right across the center line.
- ✅ **Swap two performers** — in the current formation.
- ✅ **Align / distribute tools** — row/column align, even distribute.
- ✅ **Marquee select + mouse group-drag** — rubber-band on empty floor;
  dragging one selected mark moves the whole selection.
- ✅ **Copy positions from any formation** — "copy from…" picker in the
  formation panel.
- ✅ **Performer badge** — one CJK char / up to 4 letters inside the 2D mark
  and as a paper tag on the face in 3D (Ivan-requested).
- ✅ **Snap-to-grid toggle** — implemented (persisted in `state/layout.ts`,
  applied in StageCanvas); status was stale here until 2026-07-16.
- ✅ **Delete key + clipboard hotkeys** — Delete/Backspace, Ctrl+C/V positions,
  Ctrl+A, Ctrl+D duplicate formation, Escape (2026-07-13).

## Timeline & playback

- ✅ **Section markers** — named timeline labels (verse, chorus…).
- ✅ **Playback speed** (0.5–2×) and ✅ **resizable panels/timeline**.
- ⬜ **Count-based ruler mode** (M) — switch the ruler from seconds to
  8-counts when BPM is set; dancers think in counts. Mechanical once BPM +
  beat markers exist.
- ⬜ **Per-transition duration editing** (M) — today transition time = the gap
  between formations; an explicit handle/field on the gap makes it visible.
  Touches the timing model, so tread carefully.
- ⬜ **Loop a time range** (S) — rehearse one transition over and over.

## Performers & cast

- ✅ **Performer groups/tags** (2026-07-13) — comma-separated tags on each
  performer; Cast-panel chips select the whole group in one click (then all
  group ops — align/distribute/templates/group-drag — just work).
- ⬜ **Alternates / understudies** (M) — mark a performer inactive without
  deleting their positions (weekly attendance changes).
- ✅ **Per-performer path view** — "Show whole-show path" in the performer
  panel: numbered stops + dashed legs on the canvas.

## Export & sharing

- ✅ **2D & 3D video export** — MediaRecorder, music mixed in.
- ✅ **Individual walk sheets PDF** — one page per performer (numbered route +
  table); PDF-type picker next to Export PDF. CJK text is skipped (jsPDF has
  no CJK font — embedding a subset font is the known upgrade).
- ✅ **PNG snapshot of current formation** (2026-07-13) — export-dialog entry,
  reuses the 2D video renderer frozen at the formation start.
- ⬜ **GIF export** (M) — reuse the exporter's frame draw + a small encoder
  (`gifenc`), render offline ~12fps/640px. Mechanical.
- ✅ **PDF 中文** (2026-07-13) — bundled Noto Sans TC subset (Big5 + Latin,
  4.8MB lazy asset); embedded only when the doc contains CJK.

## 3D

- ✅ **Camera presets** (audience / overhead / side).
- ✅ **Follow-a-performer camera** (chases the dancer, orbits with their facing).

## Collaboration

- ⬜ **Comment resolve/threads** (M) — resolving keeps old notes from drowning
  new ones.
- ✅ **Follow peer mode** (2026-07-13) — click a peer's presence dot to mirror
  their playhead + selected formation live (amber ring while following).

## Big / design-first

- ✅ **Rule-based formation suggestions** (2026-07-13, by Fable) — roadmap
  V3a. `state/suggest.ts`: 6 shape families scored by travel (Hungarian
  assignment) + spacing (crowding-gated) + symmetry; top-3 with mini previews
  in the Formation panel. Tuning knobs live as constants in that file.
- 🔶 **Video → formation charts (影片轉隊形圖)** (L, research-grade) — input a
  performance video, output an editable draft of who stood where per count.
  **No turnkey open-source tool exists** (2026-07-15 search): dance AI projects
  (AI-Dance-Coach, DeepDance, DanceSculpt) only do _pose comparison / scoring_,
  not top-down positions. The real pipeline is borrowed from **sports player
  tracking**, where every piece is open source:
  1. Detect people per frame — pose estimation (MoveNet MultiPose, in-browser)
     **caps at 6 people**; more needs YOLO person-detection (heavier).
  2. Track identity across frames — multi-object tracking (LightTrack). Hardest
     step for dance: crossing + occlusion + identical costumes → ID switching.
  3. Perspective → stage meters — homography (needs a **fixed camera** + 4 known
     stage-corner calibration points). Handheld/zooming video ≈ unsolvable.
  4. Segment continuous motion into discrete counts — detect held formations.
     Realistic MVP = **"draft generator", not automation**: require fixed overhead
     camera, ≤6 dancers, manual corner calibration, output an editable draft the
     user corrects. Feeds straight into the existing editor. **Licensing trap:**
     YOLO (Ultralytics) is **AGPL** — copyleft, a real problem for GridStage;
     resolve before adopting. Effort: weeks even on the sports stack; expectation
     risk (users want magic, physics delivers a draft). Fable: plan + MVP scope
     first. Refs: github.com/topics/player-tracking, Guanghan/lighttrack,
     cemunds/awesome-sports-camera-calibration.
- 🔶 **Stage lighting + light plot / cue sheet (編光表)** (L) — colored stage
  lights + timeline cues. A real subsystem (shared-types, store, 2D overlay,
  3D `SpotLight` wash, cue interpolation, PDF cue sheet). **Needs Fable for
  the design + plan:** genuine ambiguity (cues keyed to time vs formations,
  the beam/color model, how the editing UI reads) and cross-file interactions
  that are hard to hold in one head. Fable designs + does the hard parts;
  Sonnet can execute the mechanical phases. Propose the staged plan to Ivan
  before touching files (his >10-file rule). Phases: (1) data model,
  (2) 2D overlay + cue interpolation, (3) 3D wash, (4) PDF cue sheet.

## Competitive gaps vs leading mobile formation apps (audit 2026-07-16)

Sources: public product pages, tutorial sites, and app-store reviews of the
leading commercial formation apps (details in the 2026-07-16 session notes;
per the legal red line, no third-party product names in this repo). Where
GridStage already wins (realtime collab, ghosts with crossing warnings,
z-elevation/risers, video export, rehearsal-pack PDF, free & open source)
is not repeated here — only what's still missing.

Functional:

- ✅ **Group rotate + stretch/scale** (2026-07-17) — rotate ±15° around the
  group centroid (facing follows) + spread/tighten ×1.15, in the
  multi-select panel; pure fns in `state/formationTransform.ts`.
- ✅ **Choreography file export/import (JSON)** (2026-07-17) — Export →
  File writes `<title>.gridstage.json`; Library → Import brings it back
  under a fresh id (can never overwrite). Media blobs not included.
- ✅ **Dancer shapes / state markers** (2026-07-17) — per-FORMATION shape
  ring (square/triangle/diamond) on `FormationPosition.marker`, edited in
  the performer panel, hidden during playback.

Non-functional (from user reviews, not feature lists):

- ⬜ **Responsive / touch layout** (L) — the single biggest gap. The
  competitors' core scenario is a phone on the rehearsal floor; GridStage
  is unusable on mobile today.
- 🔶→✅ **Data-safety step 1** (2026-07-17) — JSON export/import + a weekly
  backup-nudge banner once a doc holds real work. Long term (accounts /
  cloud sync) still open.
- ✅ **60-performer stress test** (2026-07-17) — permanent e2e seeds 60
  performers × 4 formations: drag lands correctly, playback ~57fps
  (floor 20 in CI). Bonus: found+fixed a real bug — stale formation
  selection after rehydration left the stage empty until the first edit.
- ✅ **Timing-edit regression check** (2026-07-17) — pinned in
  formationOrder.test.ts: editing an early start never shifts later
  formations.
- **Community / distribution** (not code) — the market leader has 457K+
  users, top app-store ratings, official tutorials, active social media vs
  our zero. Demo videos + in-app guide (in progress) are the right first
  moves.

## Which need Fable (vs any model)

Per Ivan's model-dispatch rule, Fable is for **taste / ambiguous product
judgment** and **hard algorithms where "plausible but wrong" is the failure
mode** — not for mechanical work.

- 🔶 **Formation suggestions** — heuristic + taste; wrong-but-plausible risk.
- 🔶 **Video → formation charts** — research-grade CV pipeline + AGPL licensing
  call + MVP scoping; "plausible but wrong" is the whole failure mode.
- 🔶 **Stage lighting + cue sheet** — big cross-file architecture + design
  ambiguity (at minimum, Fable writes the plan and the tricky parts).

Everything else (count ruler, GIF/PNG/walk-sheet export, groups, marquee
drag, snap-to-grid, loop, comment threads, per-performer path) is
well-specified execution — Sonnet or the main thread does it reliably.

## Recommendation (if Ivan asks "what next?")

1. Individual walk sheets PDF — the printable artifact teams want most (any model).
2. Count-based ruler — dance-audience differentiator (any model).
3. Formation suggestions — high wow-factor, **Fable**.
4. Stage lighting + cue sheet — biggest, **Fable plan first**.

## TODO (Ivan's own list)

1. ~~playback speed 0.5–2× (0.1 steps)~~ ✅ 2026-07-06
2. ~~resizable sidebars (VSCode-style)~~ ✅ 2026-07-06 (+ resizable timeline)
3.
