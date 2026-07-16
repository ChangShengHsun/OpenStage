# Reference-video synced playback — design (2026-07-17)

Decided with Ivan (2026-07-17): (1) when a video is loaded its audio is the
master; with only music, music stays the master. (2) Both PiP and split
layouts, switchable. (3) No persistence — the user re-picks the file each
session.

## What it is

Import a reference video (original MV, competition footage, a rehearsal
recording) and play it in the editor sharing ONE timeline with the charts:
press play and both move; scrub the playhead and the video follows. It is
NOT computer vision (that is the separate "video → formation charts"
research item in feature-ideas.md) — nothing is detected; the two views are
merely clocked together. It is, however, the natural first step toward it.

Two core scenarios:

1. **Transcribe**: watch the source video frame by frame and place the
   formations — the video is the answer key, the chart is the notebook.
2. **Review**: play a rehearsal recording against the planned charts and
   spot which transition drifted.

## Sync model

```
timelineMs = videoCurrentTime * 1000 − offsetMs
```

`offsetMs` = where timeline 0 sits inside the video (videos start with
countdowns, applause, MC talk…). One number, user-adjustable.

Calibration UX (the practical path, no typing milliseconds):

- Pause the video on a recognizable beat (e.g. the first count of the
  piece), drag the playhead to that same beat on the timeline, click
  **"Align here"** → `offsetMs = videoTime*1000 − playheadMs`.
- A NumberField shows the current offset in seconds for fine nudging.

## Clock architecture (grounded in usePlayback.ts)

`usePlayback` already has exactly one clock-selection point:

```
t = audio !== null ? audio.currentTime * 1000 : rAF accumulation
```

The change is one rung on that ladder — clock priority becomes:

```
video (when loaded)  >  audio  >  rAF
```

- **Video loaded** → the `<video>` element is the clock:
  `t = video.currentTime*1000 − offsetMs`. The project `<audio>` element is
  NOT played (video sound is master, per decision 1). playbackRate flows to
  the video element the same way it flows to audio today.
- **No video** → behavior unchanged (audio master, else rAF).
- **Scrubbing while paused**: an effect watches `playheadMs` when
  `!isPlaying` and seeks `video.currentTime = (playheadMs + offsetMs)/1000`
  (throttled ~100ms; seeking every pixel of a drag is choppy).
- End-of-show: `playbackEndMs()` stays formation/audio based; if the video
  runs longer, playback still stops at the show's end (the video is a
  reference, not the show).

## State — `state/refVideo.ts` (zustand, NOT persisted)

```ts
{
  objectUrl: string | null;   // URL.createObjectURL of the picked file
  fileName: string;           // shown in the UI
  offsetMs: number;           // default 0
  layout: 'pip' | 'split';    // default 'pip'
  load(file: File): void;     // revokes the old URL first
  clear(): void;
  setOffsetMs(ms: number): void;
  setLayout(l): void;
}
```

Session-only by decision 3: no IndexedDB, no quota worries, refresh = gone.
The one shared `<video>` element lives in the RefVideo component; the
playback hook reaches it via a module-level ref (same idiom as
`getAudioElement()`).

## UI

- **Entry point**: a "Ref video" button next to "Upload audio" in the
  Timeline transport (hidden in easy mode; `expert-only-ui`).
- **PiP**: a floating panel over the stage area (absolute, draggable by its
  header, resizable by a corner handle; default ~320px wide, bottom-left).
  Contains the `<video>` (no native controls — the timeline IS the
  transport), the offset field, "Align here", layout toggle, close.
- **Split**: `.stage-area` becomes a 2-column flex — video left, canvas
  right (50/50, video letterboxed). Same control strip under the video.
  Toggling is instant; the same `<video>` element moves between the two
  containers (a React portal or conditional parent — one element, so
  playback position never resets).
- While a video is loaded, the audio waveform strip stays visible (beat
  markers still matter) but the audio itself is muted — a small note in the
  transport says the video's sound is playing.

## Files touched (v1)

| File | Change |
|---|---|
| `state/refVideo.ts` | new session store + video element ref |
| `components/RefVideo.tsx` | new: PiP/split shell, controls, file input |
| `hooks/usePlayback.ts` | clock ladder + paused-scrub effect + audio mute |
| `App.tsx` | mount `<RefVideo />` in `.stage-area` |
| `components/Timeline.tsx` | "Ref video" button |
| `i18n/en.ts` + `zh.ts` | ~8 keys |
| `index.css` | `.ref-video-pip`, `.stage-area-split` |

Estimate: M (one solid day). No new dependencies; native `<video>` covers
everything (rung 4 of the ladder).

## Phases + acceptance

1. **Load + PiP render** — pick a file, video shows in PiP, close revokes
   the URL. e2e: button visible in expert mode, file input accepts video/*.
2. **Clock integration** — with a video loaded, play moves both; pause
   stops both; scrubbing the paused timeline seeks the video (offset
   honored); with no video, audio behavior is byte-identical (existing
   playback e2e stays green). Unit-test the pure mapping
   `videoTime ↔ timelineMs` both ways.
3. **Split + calibration** — layout toggle keeps playback position;
   "Align here" computes the offset from the current pair of positions.
   e2e: set a known offset, assert playhead↔video time relation via
   `page.evaluate` on the video element.

## Risks / notes

- **Codec support** is the browser's problem (H.264/VP9 fine; HEVC from
  iPhones may not decode in Chromium — surface the `<video>` error event as
  a friendly "格式不支援" note rather than a silent black box).
- **video.currentTime precision** is ~ms and seek latency varies; for
  transcription (paused, frame-stepping) this is fine. Frame-accurate
  stepping (`requestVideoFrameCallback`) is a later nicety.
- **Collab**: the video is local-only (a peer doesn't have the file). The
  offset is also local. Nothing syncs — by design for v1.
- Export must ignore the reference video entirely (video/PDF exporters read
  the store; they never see refVideo state — keep it that way).
