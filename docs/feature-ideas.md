# Feature ideas — suggested additions beyond the prompt.md roadmap

Suggestions from the 2026-07-06 session, ranked within each group by
(value to a real choreographer) vs (implementation effort). Nothing here is
committed scope — Ivan picks. Effort scale: S (<half day), M (a day-ish),
L (multi-day / needs design discussion).

## Editing quality-of-life (highest payoff per effort)

- **Multi-select + group drag** (M) — rubber-band select several performers,
  drag/nudge them together. The single most-requested interaction in
  formation tools; everything below benefits from it.
- **Mirror / flip formation** (S) — one click to mirror positions across the
  center line. Choreography is symmetric constantly; pairs well with
  templates. Pure function next to `templates.ts`, easy to unit-test.
- **Swap two performers** (S) — select two, swap their spots (and optionally
  in all later formations). Fixes casting changes without re-dragging.
- **Align / distribute tools** (S–M) — align selected to a row/column,
  distribute evenly. Straight lines by hand are fiddly.
- **Snap-to-grid toggle** (S) — 0.5m grid snapping while dragging.
- **Copy positions from any formation** (S) — currently a new formation
  copies only the previous one; a "copy from…" picker covers
  return-to-opening cases.

## Timeline & playback

- **Per-transition duration editing** (M) — today transition time = gap
  between formations; an explicit handle/field on the gap would make intent
  visible.
- **Section markers** (S) — named labels on the timeline (verse, chorus,
  drop) independent of formations.
- **Loop a time range** (S) — rehearse one transition over and over.
- **Count-based ruler mode** (M) — switch the ruler from seconds to 8-counts
  when BPM is set; dancers think in counts, not milliseconds.

## Performers & cast

- **Performer groups/tags** (M) — "front row", "flyers"; filter highlight on
  canvas, per-group color accents, template application to a group only.
- **Alternates / understudies** (M) — mark a performer inactive without
  deleting their positions (attendance changes weekly in real teams).
- **Per-performer path view** (S) — click a performer, see their walk path
  across ALL formations at once (the PDF already draws per-formation paths;
  this is the on-screen, whole-show version).

## Export & sharing

- **Individual walk sheets PDF** (M) — one page per performer: their own
  positions/paths/timings. Print-and-hand-out is how teams actually rehearse.
- **PNG snapshot of current formation** (S) — one button, reuses the video
  exporter's draw function.
- **GIF export** (M) — roadmap V3b, see handoff guide.
- **3D video export** (M) — REQUESTED BY IVAN. Add a 2D/3D dropdown next to
  the "Export video" button. 2D reuses today's canvas path. 3D records the
  three.js view: render `Stage3D`'s scene to an offscreen/WebGL canvas driven
  by the same realtime clock as `export/video.ts`, then `canvas.captureStream`
  + MediaRecorder (audio mixed the same way). Cleanest structure: lift the
  playback/record loop out of `video.ts` so both a 2D-canvas renderer and a
  3D-three renderer plug into it. Effort is M mostly because three's render
  loop must be pumped manually per frame (no React reconciler during capture).

## Lighting (requested by Ivan — a whole feature area, needs design first)

- **Stage lighting + light plot / cue sheet (編光表)** (L) — set colored
  lights on the stage and attach lighting cues to the timeline. This is a
  real subsystem, not a one-file change; propose a staged plan to Ivan before
  building (his >10-file rule). Suggested phases:
  1. *Data model* — a `lights` array on the performance (position, color,
     intensity, beam angle, on/off) persisted like formations; and a
     `lightingCues` list keyed to time (or to formations), each cue setting
     light states. Extend `shared-types` + the `store.ts` persist `merge`.
  2. *2D overlay* — draw light positions/beams on `StageCanvas`, editable in
     a new PropertiesPanel section; cue state interpolates over the timeline
     like poses do (`interpolate.ts` pattern).
  3. *3D wash* — map each light to a three.js `SpotLight`/`PointLight` in
     `Stage3D` so the wash is visible in preview (and in 3D video export).
  4. *Cue sheet export* — a printable PDF table (cue #, time/8-count, which
     lights, color/intensity), same jsPDF approach as the walk charts.
  Ties into: 3D video export (lit preview), count-based ruler (cue timing).

## Collaboration

- **Comment resolve/threads** (M) — comments exist; resolving keeps old notes
  from drowning new ones.
- **Follow mode** (M) — click a peer's avatar to follow their playhead and
  selection (teacher walks the team through the piece remotely).

## 3D

- **Camera presets** (S) — audience / overhead / stage-left buttons instead
  of only free orbit.
- **Follow-a-performer camera** (M) — see the show from one dancer's spot;
  genuinely useful for spacing awareness, and rare in competing tools.

## Recommendation (if Ivan asks "what next?")

1. Multi-select + group drag (unlocks mirror/align/swap)
2. Mirror formation + swap performers (cheap, high daily value)
3. Individual walk sheets PDF (the printable artifact teams want most)
4. Count-based ruler (differentiator for the dance audience)

Ivan-requested, queued: 3D video export (M, near-term) and stage
lighting + cue sheet (L, needs a staged plan first).

## TODO
1. ~~allowing different playspeed(0.5x~2x 0.1 as interval)~~ ✅ done 2026-07-06
2. ~~allow sidebars to adjust its width just like what we can do in vscode~~ ✅ done 2026-07-06
3. 