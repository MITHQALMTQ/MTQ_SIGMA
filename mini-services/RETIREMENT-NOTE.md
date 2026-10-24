# mini-services/ — LOCAL RETIREMENT STATUS (2026-10-23, Task 16 remediation)

The platform's MASTER MANDATE audit (Task 16) found both mini-services to be
**dead weight in the local sandbox deployment**:

| Service  | Port | Local status | Finding |
|----------|------|--------------|---------|
| mtq-feed | 3003 | **RETIRED locally** (stopped) | 16b-003 HIGH: zero consumers (no `XTransformPort=3003` / socket.io-client reference anywhere in `src/`); broadcast a **−15% divergent** engine state (its own `ReserveState` singleton never receives trials); doubled external FX/gold API load every 3s. The canonical engine lives **in-process** in the Next.js server (`src/lib/mtq/pilot-state.ts`, globalThis singleton, 4s tick) and the frontend polls `/api/metrics` every 4s. |
| keeper   | 3040 | **RETIRED locally** (stopped) | Designed for cloud deployment (Koyeb). Locally it ran observe-only with `KEEPER_PRIVATE_KEY` unset (release-controls `keeper-tx-submission` guard verified fail-closed) — but nothing reads its output, its gold price source (metals.live) is TLS-dead (constant $2,650), and it consumed ~1GB-class RSS for zero value. |

Both processes consumed **~1.9GB RSS combined** on the 4GB box — the root
cause of the recurring dev-server OOM kills (see `dev-watchdog.sh` header).

**Boot-respawn fix (2026-10-24, Task 18):** the container's boot flow
(`/start.sh` → `.zscripts/dev.sh` → `start_mini_services()`) used to blindly
`bun run dev` every directory under `mini-services/`, so every container
restart resurrected both retired services. Both now carry a
`RETIRED-LOCALLY` marker file, and `.zscripts/dev.sh`'s scan skips any
service directory containing that marker (with an explicit log line). To
re-activate a service locally: delete its `RETIRED-LOCALLY` marker, then
follow the restart procedure below.

**To restart (if ever needed):**
```bash
cd mini-services/mtq-feed && bun run dev   # port 3003 — requires re-wiring a consumer first
cd mini-services/keeper && bun run dev     # port 3040 — cloud-blueprint service; needs KEEPER_PRIVATE_KEY
```

The production intent (Koyeb keeper + optional WS feed) remains documented in
each service's source header. This retirement note is local-deployment state,
not an architecture change: the v3 blueprint's keeper plan is unaffected.
