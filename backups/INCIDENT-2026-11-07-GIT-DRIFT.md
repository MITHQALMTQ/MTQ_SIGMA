# INCIDENT 2026-11-07 — Git-Drift / Stale-Code Regression (incident #8)

**Class:** sandbox re-image → stale `.git` + amend drift + upload-route deletion (5th)
**Detected:** 2026-11-07 ~15:35Z (session-open inspection, before any user-facing work)
**Resolved:** 2026-11-07 ~16:05Z (forward-only realignment, zero data loss)
**Root-cause remediation:** Task 60 — git-drift guard (this document + RUNBOOK §2.1.3)

## 1. What happened

The sandbox was re-imaged to a mid-session filesystem snapshot taken during
task46 (early 2026-11-07). At session-open the local repo was:

- `main` @ `9c3ead3` — an **amended** task46 commit (the re-image captured the
  tree mid-amend: `1254c4c` → `0552ab5` → `9c3ead3`);
- **26 commits behind** `origin/main` @ `4bfe765` (task59) — every task47–59
  fix (F-59 readability/fuzziness closure, live-number video evidence,
  dependency updates, AI consensus layer, watchdog v3);
- the amend had **re-deleted** `src/app/api/constituency/upload/route.ts`
  (the 5th deletion of this file) and re-stale `db-snapshots`;
- the dev server (booted 15:23 by the restored watchdog) was **happily serving
  26-commits-old code** — no alarm anywhere.

Meanwhile the previous session had pushed everything to origin; the git-tracked
cloud DB layer held a chain dump at h13,072 — far ahead of the live DB's
regressed h4,129.

## 2. Detection (why nothing shouted earlier)

The task32 session-open battery's [2/7] plane had the three-way classification
(task49 upgrade) but was **advisory only** — it prints guidance and exits 1;
nothing at BOOT compared HEAD to origin. The task42/44 DB self-heal and the
task47 source-integrity heal both compare against **local HEAD** — which was
itself the regressed object. The last unprotected surface of the re-image
incident class.

## 3. Recovery executed (forward-only, evidence preserved)

1. **Pre-realign vault** (`backups/vault-incident8-20261107-154121/`):
   physical copies of both live DBs + full git bundle of the amend line
   (425 MB, complete history) + upload-evidence copies + SHA-256 manifest.
2. **Realign:** `git reset --hard origin/main` → `4bfe765`. The amend was
   proven content-redundant by blob analysis (dumps live-derivable; screenshots
   evidence; the only code delta vs origin was the route DELETION itself).
3. **Boot self-heal** (task42 machinery, unmodified) restored the data layer
   from the cloud layer automatically: chain h4,129 → **h13,073** (+8,944
   blocks recovered), custom 11 tables/13,004 rows → **14 tables/17,115 rows**
   (AI consensus tables restored). Integrity ok both files.
4. **Runtime layer:** `prisma generate` (stale client lacked the 3 new models);
   `bun install` verified satisfying (no drift).
5. Verification battery: upload route 403 fail-closed gate LIVE · chain
   advancing (block-by-block) · DB regression check OK · session battery PASS ·
   `tsc` 0 · `lint` 0 · secret-scan PASS.

## 4. Root cause and why it could keep happening

The re-image restores the whole filesystem — including `.git` — to a snapshot
taken at an arbitrary moment. If the snapshot is mid-session (post-amend,
pre-push), local history diverges from origin, and every existing guard
(DB self-heal, source-integrity heal) compares against the WRONG baseline:
local stale HEAD. Nothing fetched origin and compared.

## 5. Remediation — git-drift guard (Task 60)

- `src/lib/boot/git-drift.ts` — classification + content-subsumption proof +
  archive + forward-only realign + runtime-layer refresh (node builtins only).
- `scripts/git-drift-guard.ts` — CLI: default guard (exit 0 ok · 42 realigned
  → restart server · 1 BLOCKED), `--status`, `--allow-drift "reason"`.
- `dev-watchdog.sh` **v4** — pre-boot drift guard (before source-integrity
  heal, so the heal restores against the NEW HEAD) + 60s supervision subloop;
  on realign it kills :3000 only when the watchdog is alive (never the only
  server without a supervisor — mirrors db-cloud-sync).
- `src/instrumentation.ts` plane 3c — in-process guard every 60s for the
  watchdog-dead geometry (incident #7); runtime refresh skipped in-process.
- `scripts/session-open-battery.sh` plane **[3/8]** — the guard as a battery
  plane (auto-heal at session-open).
- Sentinel: `db/ALLOW-GIT-REALIGN` (expiry + reason; ≤168h).

### Safety proofs (harness-tested, 10/10 PASS)

| Scenario | Setup | Guard action | Exit |
|---|---|---|---|
| A synced | local == origin | none | 0 |
| B behind (pure stale snapshot) | clean tree, 0 local commits | `merge --ff-only` | 42 |
| B′ behind + WRITE-BEHIND dirty dump | unstaged `latest-*.sql` refresh (the cloud-sync steady state) | archive freshest dump bytes → discard mod → `merge --ff-only` | 42 |
| C diverged amend-drift (THIS incident's signature) | derivable + ancestor-blob + deleted-origin-wins paths | archive → `reset --hard` | 42 |
| C″ diverged amend + write-behind dirty dump | C + unstaged dump refresh | archive (incl. freshest dump) → `reset --hard` | 42 |
| D diverged + genuinely new code | unique local file | **BLOCK** | 1 |
| E dirty tracked tree (code edits) | unstaged src edits | **BLOCK** | 1 |
| F sentinel | `db/ALLOW-GIT-REALIGN` | stand down | 0 |

Plus: gitignored `db/*.db` proven byte-stable across every realign operation
(the guard never touches untracked/ignored paths by construction).

**Bug found & fixed during harness testing (why you test root-cause fixes):**
(1) the cloud-sync write-behind keeps `latest-*.sql` perpetually modified in
the working tree — a naive dirty-tree check would BLOCK every auto-realign
and silently defeat the guard; unstaged dump modifications are now the
documented exception (archived + discarded; re-derived from the live DB by
the next sync tick ≤60s), while STAGED dump changes still block. (2) the git
helper's `.trim()` corrupted porcelain `-z` records — an unstaged record
`"XY path"` has a LEADING SPACE as part of its data; trimming shifted every
field left by one (status codes misread, paths lost their first character).
Porcelain is now read raw (no-trim), mirroring `source-integrity.ts`.

## 6. Honest limits

- The guard heals only what it can PROVE safe; genuinely-diverged histories
  (real parallel work on both lines) still require the task49 human
  forward-merge procedure — by design.
- Fetch requires network; an offline sandbox classifies against the last
  successful fetch (stale refs) — a realign to an older-but-valid ref is still
  forward progress, and the next successful fetch heals further.
- The 5-min fetch throttle bounds politeness, not correctness: a re-image
  followed by a boot within the throttle window classifies against refs
  refreshed at most 5 minutes earlier.

## 7. Standing rules (now mechanically enforced)

1. Never leave work unpushed — `ahead-only` classification reminds on every
   check; re-images destroy unpushed commits (incidents #8, #9).
2. Prefer `commit --amend` ONLY before push; after a push, amend = drift (the
   guard will archive-and-realign it, but pushing first avoids the class).
3. The session-open battery is the trust gate for ANY session start — it now
   includes the drift plane.
