# GridStage 0.6.0

## Use it on your phone (Android / iOS) — new

No app store needed. Open
**https://changshenghsun.github.io/GridStage/** in the phone's browser and
install it: Android Chrome **⋮ → Add to Home screen**, iOS Safari
**Share → Add to Home Screen**. It runs full-screen, works offline after the
first visit, and saves work on the device. On phones the side panels tuck
behind Cast / Props edge tabs; buttons and inputs are touch-sized.

## AI video tools (first installer carrying them — 0.4.0/0.5.0 builds never shipped)

- **Reference video**: load a rehearsal/competition video next to the stage
  (floating window or split view), sync it to the timeline with one offset.
- **Stage calibration**: drag four pins onto the stage corners in the video;
  a live meter grid shows when it's right.
- **Capture formation**: on any paused frame, detect the dancers and place
  them into the selected formation — including which way each is facing.
- **Scan whole video**: one click samples the video every second and adds a
  formation for every held position; transitions are skipped, one Undo
  reverts everything.
- All on-device (no cloud): YOLOX-nano + RTMPose-t, both Apache-2.0.

## Editor

- Group rotate and spread/tighten for a selection.
- Per-formation state markers on dancers (square/triangle/diamond).
- Choreography export/import as a single .gridstage.json file + weekly
  backup reminder.
- Responsive layout down to phone widths; touch-friendly targets.
