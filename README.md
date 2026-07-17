# GridStage

Open-source collaborative stage formation & choreography editor — for choreographers,
cheer coaches, stage managers, and dance studios.

Plan formations on a top-down 2D stage, sync them to music, preview transitions
in 2D and 3D, calibrate to the beat, and export walk-chart PDFs or a rendered
video. Real-time multi-user editing (cursors, presence, per-user undo) is built
in via CRDT.

**Two ways to get it:** install the desktop app (a normal `.exe`, nothing else
to set up) or run it from source. Both are below.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (apps/web)                      │
│  React + Vite + Zustand                                         │
│  ├─ 2D editor ......... react-konva (top-down stage canvas)     │
│  ├─ 3D preview ........ @react-three/fiber (roadmap V2)         │
│  ├─ Audio ............. Web Audio API (waveform, beat markers)  │
│  └─ Collab client ..... Yjs + y-websocket (roadmap V1)          │
└───────────────┬──────────────────────────────┬──────────────────┘
                │ REST + JWT                   │ WebSocket (Yjs sync)
┌───────────────▼──────────────┐  ┌────────────▼─────────────────┐
│   apps/api (NestJS)          │  │  apps/collab-server          │
│   auth, orgs, performances,  │  │  y-websocket rooms,          │
│   assets, comments, exports  │  │  awareness (cursors)         │
└──────┬────────┬────────┬─────┘  └────────────┬─────────────────┘
       │        │        │                     │
┌──────▼───┐ ┌──▼────┐ ┌─▼──────────┐  ┌───────▼──────┐
│ Postgres │ │ Redis │ │   MinIO    │  │   Redis      │
│ relational│ │ cache/│ │ audio/media│  │  pub-sub     │
│ + JSONB  │ │ pubsub│ │  (S3 API)  │  │              │
└──────────┘ └───────┘ └────────────┘  └──────────────┘

packages/
  shared-types   — domain types shared by web / api / collab-server
  path-planner   — Hungarian assignment + sweep-line collision detection (roadmap V2)
```

## Project structure

```
gridstage/
├── apps/
│   ├── web/            # React + Vite frontend (2D editor, timeline, audio, PDF export)
│   ├── api/            # NestJS REST API (auth, CRUD, media)          [needs Docker]
│   └── collab-server/  # Yjs y-websocket server                       [roadmap V1]
├── packages/
│   ├── shared-types/   # TypeScript domain model shared by all apps
│   └── path-planner/   # transition matching & collision detection    [roadmap V2]
├── docker-compose.yml  # postgres + redis + minio + api + collab-server + web
├── pnpm-workspace.yaml
└── tsconfig.base.json  # strict mode, shared by all packages
```

## Install the desktop app (no Node.js needed)

For choreographers and anyone who just wants to **use** GridStage — you do not
need Node.js, pnpm, a terminal, or even a browser installed. The desktop app
bundles everything.

1. Go to the [**Releases**](https://github.com/ChangShengHsun/GridStage/releases)
   page and download the latest `GridStage Setup <version>.exe` (Windows).
2. Double-click it and follow the installer. The app is not code-signed yet, so
   Windows SmartScreen may show a blue "Windows protected your PC" box — click
   **More info → Run anyway** (safe: it is your own build).
3. Launch **GridStage** from the Start menu.

Everything works offline. Your work is saved automatically on that computer
(there is no cloud account yet), so to move a piece to another machine, export a
PDF or video, or copy it via a live-share link. Real-time collaboration in the
desktop build needs a collab server to point at (see below); solo editing does
not.

## Use it on a phone or tablet (Android / iOS)

No app store needed — GridStage is a **PWA** (Progressive Web App, a web page
that installs like a native app):

1. Open **<https://changshenghsun.github.io/GridStage/>** in the phone's
   browser (Chrome on Android, Safari on iOS).
2. Install it:
   - **Android / Chrome:** menu **⋮ → Add to Home screen → Install**.
   - **iOS / Safari:** **Share → Add to Home Screen**.
3. Launch it from the home screen — it opens full-screen, works offline after
   the first visit, and saves your work on the device.

On a phone the side panels tuck away behind the **Cast** / **Props** edge
tabs; on a tablet the full three-column layout appears. Live collaboration
needs a self-hosted collab server (see below), so it is not available on the
public page — everything else runs entirely on the device.

### Building the installer yourself (maintainers)

This step _does_ need Node.js 20+ and pnpm — it is how the `.exe` above is
produced.

```bash
pnpm install
pnpm --filter @gridstage/desktop start   # run the desktop app without packaging
pnpm --filter @gridstage/desktop dist    # build the installer -> apps/desktop/release/
```

> **Windows note:** `dist` uses electron-builder, which extracts a toolchain
> containing symbolic links. Turn on **Settings → System → For developers →
> Developer Mode** first (or run the command from an Administrator terminal),
> otherwise the extraction fails with a "cannot create symbolic link" error.

## Quick start (run from source)

Needs **Node.js 20+** and **pnpm**. Runs the editor as a local web app.

```bash
pnpm install
pnpm dev:web          # http://localhost:5173
```

The editor persists to browser localStorage — no backend required.

### Realtime collaboration (local)

```bash
HOST=127.0.0.1 PORT=1234 pnpm --filter @gridstage/collab-server start
pnpm dev:web
```

Click **Share live** in the top bar — the app reloads into a `?room=` URL you
can send to collaborators (same LAN or via the deployed collab server). Peers
see each other's cursors, selections, and edits live; Ctrl+Z only reverts your
own changes. **View link** copies a `?mode=view` variant that hides editing UI
(a convenience, not access control — real permissions need the backend).

## Full stack with Docker

```bash
cp .env.example .env  # fill in secrets
docker compose up -d  # postgres:5432, redis:6379, minio:9000/9001, api:3000, web:8080
```

| Service       | Port      | Notes                                   |
| ------------- | --------- | --------------------------------------- |
| web           | 8080      | production build served by nginx        |
| api           | 3000      | NestJS REST, `/api/health` health check |
| collab-server | 1234      | y-websocket                             |
| postgres      | 5432      | schema in `apps/api/db/`                |
| redis         | 6379      | cache + pub-sub                         |
| minio         | 9000/9001 | S3-compatible object storage (+console) |

> **Status note:** integration-tested 2026-07-13 — all six services come up,
> migrations apply, `/api/health` responds. The API itself is still a skeleton
> (health check only; auth/CRUD/media are roadmap V4).

## Development

```bash
pnpm lint         # ESLint (flat config) across the monorepo
pnpm typecheck    # tsc --noEmit in every package
pnpm build        # build every package
pnpm test         # unit tests (vitest) in every package
```

TypeScript runs in strict mode plus `noUncheckedIndexedAccess` everywhere.
Commits follow [Conventional Commits](https://www.conventionalcommits.org/).

## Roadmap

- **MVP** ✅ — 2D editor with performer orientation, formation timeline (drag +
  zoom), audio upload + manual beat markers, PDF export (walk charts + roster)
- **V1** ✅ — Yjs real-time collaboration (cursors/presence/per-user undo),
  comments, formation template library, CSV roster import, view-only share
  links (server-enforced roles still need the backend)
- **V2** ✅ — 3D preview, curved (Bézier) transition paths, auto-transition
  (Hungarian matching) + collision warnings, version history (local snapshots;
  server-side Yjs snapshots come with the backend)
- **V3** (in progress) — 2D & 3D video (animation) export ✅ (MP4/WebM via
  MediaRecorder, music mixed in); tap-tempo BPM calibration ✅; formation tools
  ✅ (mirror, swap, align, distribute); named timeline sections ✅; 3D camera
  presets + follow-a-performer ✅; still open: rule-based formation suggestions,
  GIF export, PWA offline
- **V4** — plugin architecture, one-click self-host, community template marketplace

## License

MIT — see [LICENSE](LICENSE).
