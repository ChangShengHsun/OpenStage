# OpenStage

Open-source collaborative stage formation & choreography editor — for choreographers,
cheer coaches, stage managers, and dance studios.

Plan formations on a top-down 2D stage, sync them to music, preview transitions,
and export walk charts as PDF. Real-time multi-user editing via CRDT (roadmap V1).

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
openstage/
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

## Quick start (frontend only, no Docker needed)

```bash
pnpm install
pnpm dev:web          # http://localhost:5173
```

The editor persists to browser localStorage — no backend required.

### Realtime collaboration (local)

```bash
HOST=127.0.0.1 PORT=1234 pnpm --filter @openstage/collab-server start
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

> **Status note:** the Docker stack is written to spec but has **not yet been
> integration-tested** (Docker unavailable on the dev machine at scaffold time).
> The frontend MVP is fully tested standalone.

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
