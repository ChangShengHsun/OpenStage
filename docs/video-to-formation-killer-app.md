# Video → formation charts: the killer app (research, 2026-07-17)

Verdict up front: **the market gap is real and the technical path got much
easier than the 2026-07-15 assessment** — because (a) we should extract
positions from DETECTION BOXES, not full-body pose, (b) the right MVP
captures ONE PAUSED FRAME at a time, which deletes the hardest CV problem
(identity tracking), and (c) the already-shipped reference-video sync panel
is the perfect host UX: the video is already loaded, already time-aligned to
the timeline, already paused on the frame the user cares about.

## 1. Market check (2026-07-17)

- Searched again: **no product converts a dance video into editable
  formation charts.** The entire "AI dance" app market is the OPPOSITE
  direction (generate dance videos from a photo). The competitor apps
  audited on 07-16/17 have nothing like it.
- Closest existing tech is sports player-tracking (broadcast → pitch
  coordinates) — proven pipeline, open source, different market.
- So this is a true differentiator, and it compounds with what we already
  shipped (ref-video sync → capture → edit → export is one workflow inside
  one tool).

## 2. The two killer scenarios

1. **偷師 / transcribe** (biggest audience): a school crew copies a K-pop
   MV or a competition video. Today: scrub video, hand-place dots for every
   formation — hours. With capture: pause on each formation, one click,
   draft dots appear on the stage, drag to fix, next. Minutes, not hours.
2. **驗收 / deviation report** (deepest moat, later): load the REHEARSAL
   recording against the PLANNED charts (ref-video sync already aligns
   them), extract actual positions, overlay vs. plan → "Dancer 4 was 1.2m
   stage-left at count 32". Nobody in the market can do anything like it;
   it closes the plan → rehearse → correct loop.

## 3. Why per-frame capture (not whole-video processing) is the MVP

The 4-step pipeline from the 07-15 note (detect → track → homography →
segment) is what a batch converter needs. But the product doesn't need a
batch converter first:

- A formation IS a held pose at a moment the user can find in 2 seconds of
  scrubbing — and our timeline+video are already synced.
- Capturing a paused frame needs **detection only** — no multi-object
  tracking, no ID-switch problem (the single hardest, most failure-prone
  step for identically-costumed dancers).
- Identity assignment falls out of infrastructure we ALREADY have: Hungarian
  matching (`packages/path-planner`) against the previous formation's
  positions gives each detected point the closest existing dancer identity;
  the user fixes the few mistakes by dragging. First formation = arbitrary
  assignment, user labels once.
- Full-body pose is unnecessary for position: the **foot point** (bottom
  center of a person box) through a homography gives floor position.
  Pose is only needed later for facing (shoulder vector), optional.

## 4. Technical stack (license-safe, all client-side)

| Piece               | Choice                                                    | License                                  | Notes                                                                                             |
| ------------------- | --------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Person detection    | YOLOX (or RF-DETR) via onnxruntime-web                    | Apache-2.0 / MIT wrapper (libreyolo-web) | WebGPU in browser; the AGPL trap (Ultralytics YOLO) is simply avoided                             |
| Image→stage mapping | 4-point homography (DLT)                                  | ~40 lines of our own math                | User clicks the 4 stage corners ON the video once; we already know the stage's real w×h in meters |
| Identity            | existing Hungarian matcher                                | ours                                     | vs. previous formation's positions                                                                |
| Facing (M1)         | RTMDet+RTMPose via onnxruntime-web                        | Apache-2.0                               | per-crop; shoulder keypoints → rotation                                                           |
| Tracking (M2 only)  | OC-SORT (better for non-linear dance motion) or ByteTrack | MIT (TS ports exist)                     | only needed for auto-segmentation of a whole video                                                |

All inference is client-side (WebGPU, wasm fallback): zero server cost,
private by default, consistent with the local-first product. Offline
processing means dancer count is NOT capped by realtime budgets — the old
"MoveNet caps at 6 people" concern is obsolete (that was a realtime pose
constraint; detection on a paused frame handles a full stage).

## 5. Honest constraints (set user expectations in the UI)

- **Camera**: fixed, reasonably elevated (¾ view). A flat head-on angle
  makes the homography ill-conditioned — depth (y) becomes garbage even
  when x is fine. Zooming/panning video breaks the one-time calibration.
- **Occlusion**: dancers hidden behind others in clumps simply won't be
  detected on that frame — the draft will be missing dots; the user adds
  them. This is fine for a DRAFT tool, fatal only for "magic" claims.
- **Identity**: identical costumes mean identity comes from spatial
  continuity + the user, not appearance. Per-frame capture makes wrong IDs
  cheap to fix (drag two dots to swap — swapSpots exists).
- Expectation framing everywhere: **draft generator, not automation**. The
  user always lands in the editor holding the result.

## 6. Build ladder

> **M0 SHIPPED 2026-07-17** (same day as this research; stages A–D each
> committed separately). vision/homography.ts (DLT + inverse, 6 unit
> tests), vision/detector.ts (YOLOX-nano ONNX, WebGPU→wasm, verified 6/7
> on a real six-dancer photo, ~1.8s/frame on CPU), CalibrationOverlay
> (draggable pins + live reprojected meter grid), vision/capture.ts
> (captureAtTime + Hungarian assignment + ambiguity flagging, 5 unit
> tests + stubbed-detector e2e). Next on the ladder: M1 facing / M2
> whole-video (loop captureAtTime at 1s, threshold on mean displacement).

- **M0 — Capture this frame** (1–2 weeks, the killer MVP):
  calibration overlay (click 4 corners on the paused video; store per
  session next to refVideo state) → "Capture formation" button in the
  ref-video panel → detect persons (ONNX, WebGPU) → foot points →
  homography → meters → Hungarian-assign to cast → write into the selected
  formation as a normal undoable edit. Model (~10–30MB onnx) lazy-loaded
  like the CJK font.
- **M1 — Facing**: RTMPose on each person crop → shoulder vector →
  rotation per dancer. Optional toggle.
- **M2 — Auto-segment the whole video** (CONFIRMED by Ivan 2026-07-17 as a
  required follow-up: one-click "render the whole video"): sample the video
  at 1s intervals, run the SAME per-frame capture on each sample, and when
  the captured positions differ clearly from the last accepted formation
  (mean displacement over a threshold), add a new formation at that
  timestamp. Per-frame capture + Hungarian chaining may make OC-SORT
  tracking unnecessary at 1s granularity — decide when building M2.
  M0's orchestrator must therefore expose a reusable
  `captureAtTime(videoSeconds)` so M2 is a loop around it, not a rewrite.
- **M3 — Deviation report**: rehearsal video + planned doc → per-dancer
  error table / heatmap over time. Unique in the market.

## 7. Risks

- Model size/first-run latency (10–30MB): lazy-load + progress bar, same
  pattern as the CJK font (4.8MB) but bigger. Desktop app users unaffected
  after first cache.
- WebGPU availability: Chromium desktop fine; Safari/older = wasm fallback
  (slower but M0 is one frame — even 2s/frame is acceptable UX).
- Corner-clicking UX must be excellent or everything downstream feels
  wrong. Invest there: zoomed magnifier around the cursor, draggable
  corner pins, a live reprojected grid overlay on the video to SHOW the
  calibration quality before capturing.
- The 07-15 note's warning stands: users want magic, physics delivers a
  draft. The UI copy and the demo video must show the fix-up step
  honestly.
