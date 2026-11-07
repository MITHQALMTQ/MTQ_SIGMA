# Plane-5 orchestration job 512782 — original state (pre-rebuild evidence)

Captured 2026-11-07T20:2xZ during Task 61b continuation §3 verification.

- name: MTQΣ plane-5 backstop (git-drift + DB + server + route guard)
- schedule: fixed_rate 7200s, tz Africa/Cairo
- status: 1 (enabled) · priority: 10 · MaxConcurrency: 1
- created_at: 2026-11-08 03:04:29 (orchestrator local) · run_count: 0 (never fired yet)
- next_run_time: 2026-11-08T01:04:29+02:00
- execution environment: zai-cronjob-gateway-prod (external gateway, outside the
  sandbox — survives re-images; ExecuteMode standalone, JobType golang)
- payload kind: agentTurn → agent session 32f17db1-a61e-4f6e-be50-a6bec4e14b72

## Why the payload was rebuilt (delete+create; the cron tool has no update op)
1. RAW-GIT REALIGN DEFEAT: step (1) used `git merge --ff-only origin/main`,
   which the documented write-behind steady state (perpetually unstaged-modified
   backups/db-snapshots/latest-chain.sql) refuses — in the exact incident-#9
   re-image scenario the backstop is built for. Task 60's harness-proven fix
   (writeBehindDirtyDumps archive+discard exception) lives in
   scripts/git-drift-guard.ts, which the payload bypassed.
2. FALSE-POSITIVE RE-SEED HEURISTIC: "genesis hash gen_3baf0dba… means
   re-seed" — gen_3baf0dba is the CANONICAL genesis-spec hash (deterministic
   from config/chain-genesis.json, verified 2026-11-07 against live meta and
   the round-trip-restored dump). The true re-seed marker is
   meta.boot_mode == 're-seeded' (node.ts:140).
3. NO HEARTBEAT / NO DURABLE-LAG VISIBILITY: the scheduler left no execution
   evidence in the box and did not report the git-committed (durable) dump lag.

Full original payload text: plane5-job-512782-original-payload.txt (verbatim).

## ID chain (rebuild provenance)
- 512782 — original (deleted 2026-11-07T20:26Z, run_count 0, never fired)
- 513020 — v2 draft: deleted ~10 min later, BEFORE first run — dry-run review
  caught a JS quoting bug in the added meta probe
  ('…key='boot_mode'' — invalid nesting introduced by JSON escaping);
  run_count 0, never fired, no side effects
- 513022 — v2 FINAL (registered 2026-11-07T20:27:34Z, fixed_rate 7200s,
  tz Africa/Cairo, priority 10, next run 2026-11-08T02:27:33+02:00):
  meta probe rewritten quote-free as `SELECT key, value FROM meta`
- 513021 — heartbeat monitor (registered 2026-11-07T20:27:43Z, fixed_rate
  3600s, tz Africa/Cairo, priority 15, next run 2026-11-08T00:27:43+02:00):
  read-only detection, alert threshold 9,000s, writes only /tmp files

## Operator dry-run of the full v2 payload (2026-11-07T20:28Z)
All six steps executed manually by the Task 61b continuation session:
(1) guard exit 0 synced 9eee3aa · (2) h14,677 / 17,382 rows / integrity ok /
boot_mode self-healed · (3) HTTP 200 + watchdog alive · (4) upload POST 403 ·
(5) disk dump h14,658 vs committed h14,086 → durable lag 572 blocks, last
dump-bearing commit 2026-11-07T19:36:30Z (< 24h) · (6) heartbeat seeded at
/tmp/plane5-heartbeat.json (tsMs 1794083326700, result OK).
