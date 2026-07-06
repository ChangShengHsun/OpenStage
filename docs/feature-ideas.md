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
