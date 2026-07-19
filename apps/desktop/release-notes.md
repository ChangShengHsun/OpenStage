# GridStage 0.8.4

## Sharper eyes, working phones

- **Detection model upgraded to YOLOX-L** (COCO mAP 40.5 → 50.1): far
  better on the small distant figures rehearsal footage is full of. The
  model is a ~200MB one-time download on first capture/scan.
- **Phone layout fixed**: the timeline toolbar silently stretched the
  page to ~890px on phones — the stage and topbar ran off the screen
  with no way to pan to them. The page now stays at screen width and
  each toolbar scrolls on its own.

# GridStage 0.8.2

## Video review, rebuilt

- **Whole-video scan now tracks the whole team.** Two real bugs fixed: the
  identity chain silently shrank after any missed detection (ending up
  following ONE dancer), and partially-detected dancers were averaged
  toward the corner. Scans also **replace** the chart now (with a confirm
  first — one Undo brings the old one back).
- **Sharper detection model**: YOLOX-s at 640px replaces nano at 416px —
  much better at the small, distant figures rehearsal footage is made of.
  Bigger one-time model download; runs fastest on machines with WebGPU.
- **The video window finally resizes**: a proper corner grip, the window
  can't get stuck off-screen anymore, and the split view's divider drags.
- **Export can include the reference video** — top-right small window or
  side-by-side, and the movie uses the reference video's sound.
- **Loop is now a range**: two draggable posts on the timeline with a blue
  band between them (they snap to formation edges); press Loop and it
  starts around the playhead.
- While a reference video is loaded it is the sound — the upload-music
  button locks to keep the two from fighting.
