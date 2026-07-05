# OpenStage — visual design tokens

The subject is a theater seen from the lighting grid: the app chrome is the
darkened house, the stage canvas is the one lit surface. Every color decision
derives from that: panels stay quiet and dark-warm (house lights off), the
canvas glows like a marley floor under a tungsten wash, and the accent color
is **spike tape** — the fluorescent tape crews stick on stage floors to mark
positions. That's also the signature element: performer positions render as
spike-tape crosses in the performer's color, with a light-cone wedge showing
facing.

Deliberately avoided: generic near-black + acid-green "dashboard dark mode",
cream + serif + terracotta, broadsheet hairlines.

## Palette

| Token          | Hex       | Use                                              |
| -------------- | --------- | ------------------------------------------------ |
| `--house`      | `#191512` | app background — warm black, house lights off    |
| `--panel`      | `#221d19` | side/bottom panels, one step above house         |
| `--panel-edge` | `#3a322b` | panel borders, dividers                          |
| `--floor`      | `#2e2a26` | stage floor (marley vinyl)                       |
| `--tungsten`   | `#e8a84c` | primary accent — stage-wash amber; active states |
| `--spike`      | `#e8d44c` | spike-tape yellow — markers, beat ticks          |
| `--ink`        | `#ece5db` | primary text, warm off-white                     |
| `--ink-dim`    | `#9a8f82` | secondary text, labels                           |
| `--danger`     | `#d95f5f` | destructive actions, collision warnings          |

Performer colors come from `PERFORMER_COLORS` in `@openstage/shared-types`
(colorblind-safe, distinct against `--floor`).

## Typography

| Role    | Face                    | Use                                             |
| ------- | ----------------------- | ----------------------------------------------- |
| Display | **Bricolage Grotesque** | logo, panel titles, formation names — restraint |
| Body    | **Instrument Sans**     | all UI text, buttons, inputs                    |
| Data    | **IBM Plex Mono**       | timecodes, counts, coordinates, BPM             |

Self-hosted via `@fontsource/*` (works offline, no CDN).

Type scale: 12 / 13 (base UI) / 15 / 20 / 28. Panel titles are 12px display,
uppercase, letter-spaced — like flyrail labels, not headings.

## Layout

```
┌────────────────────────────────────────────────────────┐
│ topbar: wordmark · performance title · export          │
├──────────┬────────────────────────────────┬────────────┤
│ CAST     │                                │ PROPERTIES │
│ roster,  │        STAGE CANVAS            │ selected   │
│ add/del  │   (the one lit surface)        │ performer/ │
│          │                                │ formation  │
├──────────┴────────────────────────────────┴────────────┤
│ TIMELINE: formation strip · waveform · beat ticks      │
└────────────────────────────────────────────────────────┘
```

Timeline shows **8-counts** (dance counts derived from BPM) instead of bare
seconds when BPM is known — "5, 6, 7, 8" is the language of the room.

## Motion

One orchestrated moment: pressing play sweeps performers along their
transition paths on the canvas. Everything else is instant or ≤150ms ease-out.
`prefers-reduced-motion` disables the sweep animation preview easing.

## Quality floor

Keyboard: arrow keys nudge selected performers (Shift = 1m, plain = 0.1m).
Focus visible on all controls. Canvas actions all have panel equivalents.
