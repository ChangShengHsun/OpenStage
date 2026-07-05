# @openstage/collab-server

Runs the official `y-websocket` server binary — one CRDT room per
performance, awareness carries cursors/selection (roadmap V1).

```bash
HOST=0.0.0.0 PORT=1234 pnpm --filter @openstage/collab-server start
```

Custom logic (auth on connect, Redis-backed persistence, snapshot hooks into
`version_snapshot`) will replace the stock binary when V1 collaboration lands.

> **Status:** placeholder, not yet exercised — the frontend Yjs client is
> roadmap V1.
