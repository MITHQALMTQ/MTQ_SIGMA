# Phase 0 — Authoritative-Main Delta Assessment (origin/main 926ee00 vs the Phase-0 forensic baseline d6fd5d6)

**Document ID:** SEC-P0-DELTA-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T03:2xZ (UTC)
**Assignment:** COO *Phase-0 Independent Verification Support*, §B — READ-ONLY inspection of authoritative `origin/main` @ `926ee001e70e404dd3ea870c37f4786524458517`.
**Compared against:** the Phase-0 assessment set, which was produced from the **substituted checkout** `d6fd5d69816bbd096d673b90ca5e26c18e0241bd` (re-image incident of 2026-11-11T00:20Z).
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

> **Independence disclaimer (standing):** prepared by the same AI-agent lineage that operates the sandbox — *verification support material, not an independent review*. All commands are read-only (git log/diff/show/ls-tree/rev-list in an isolated worktree). No checkout of either lineage's working state was performed in the project directory; no boot, no merge, no reset, no rebase.

---

## 0. Method and classification discipline

- All deltas computed between **tree objects** (`git diff --stat d6fd5d6 926ee00` and path-scoped variants; `git ls-tree -r --name-only` presence matrices) — no working-tree mutation.
- Evidence classes per SEC-P0-MGMT-001 §4: **[VERIFIED-FACT]** (reproducible commands below), **[HISTORICAL]**, **[HYPOTHESIS]**, **[UNVERIFIED]**.
- **Two distinct baselines must not be conflated (directive §B final requirement):**
  - **Forensic incident baseline** = `d6fd5d6` — the substituted tree the Phase-0 assessment *necessarily* described. It is an incident artifact (2/168 diverged), preserved read-only as evidence.
  - **Canonical architecture baseline** = `origin/main` @ `926ee00` — the authoritative lineage that the independent review must assess. This document audits it directly.
  - Phase-0 findings that were *conditioned on the substituted tree* are marked for re-assessment in §11.

---

## 1. Source-lineage differences **[VERIFIED-FACT]**

| Lineage | Commits | Content |
|---|---|---|
| `origin/main` @ `926ee00` | 251 total | authoritative: common base + 168 origin-only commits (the v27–v31 recovery program, §9 closeout, plane-5 suite, dashboard-audit task-series 47–53, telemetry) |
| substituted `d6fd5d6` | 85 total | incident artifact: same common base + **2 substituted-only commits** — `9fe4058` (task46 dashboard-audit #5: F-46-1 null-RR/LCR rendering + F-45-2-class fixes) and `d6fd5d6` (UUID-cron telemetry) |
| common merge-base | `ff67aa2` (task45, 2026-11-06T12:49Z) | shared ancestry (~83 commits) |
| Sept lineage (local-only tags) | ~148 commits | pre-base history reachable ONLY via local tags `backup-2026-09-22` / `backup-stable-2026-09-26` — **not on any public-remote ref** (see `secret-history-assessment.md` §3 for its security relevance) |

- `9fe4058` is preserved verbatim at `origin/backup-incident10-amend` (`9fe40589fdff…`) — the §6.3 restoration procedure's preservation precondition is *already satisfied structurally*; byte-identity to be re-verified at restoration time.
- Total tree delta `d6fd5d6 → 926ee00`: **725 files changed, +187,623 / −14,231** — dominated by the plane-5/self-heal layer, audit-work evidence, tests, telemetry, and dump tips (h23811-era vs h3941-era).

---

## 2. API and application differences **[VERIFIED-FACT]**

| Surface | origin/main 926ee00 | substituted d6fd5d6 | Delta |
|---|---|---|---|
| Route count (`src/app/api/**/route.ts`) | **63** | 59 | +4 on authoritative |
| `api/constituency/upload/route.ts` (ScoringUpload ingestion) | **PRESENT (168 lines)** | absent | the 403 fail-closed upload surface verified live 2026-11-10T23:31Z — the "upload route NOT PRESENT" finding in the Phase-0 2-a report was a substituted-tree artifact |
| `api/ai/consensus/route.ts` | **PRESENT (129 lines)** | absent | **NOT covered by the Phase-0 API authorization assessment** — new assessment input |
| `api/ai/catalog-sync/route.ts` | **PRESENT (46 lines)** | absent | same — new assessment input |
| `api/landing-stats/route.ts` | **PRESENT (66 lines)** | absent | the §4.2-battery "landing-stats 200" endpoint |
| `src/app` non-route files | globals.css (+309), layout.tsx (26), page.tsx (9) + 5 more | older versions | 8 files, +707/−97 (task-series dashboard-audit work 47–53) |

---

## 3. Monetary-engine differences **[VERIFIED-FACT]**

- `src/lib/mtq/engine.ts`: **66-line delta, main-side only** — two engine-honesty fixes the Phase-0 baseline tree does NOT contain:
  - **F-50-1 (task50)**: MARP execution-pass projection vs execution reality (new `MarpExecutionPass`/`lastPass` snapshot fields; UI relabeled "eligible (pre-execution)"; real pass captured per tick).
  - **F-53-1 (task53)**: turnover-exhausted day sizes trades to $0 → decision-layer early return (`shouldRebalance:false` + honest reason) + execution-layer zero-size belt guard in `applyRebalanceTrade` (phantom-trade state-poisoning closed).
- `src/lib/mtq/pilot-state.ts` (82 lines), `landing-status.ts` (34), `succession.ts` (2): main-side refinements from the same task-series.
- `src/lib/rate-limit.ts`: **identical** across lineages (the F-0-P2-01 rate-limit-gap findings apply unchanged to the authoritative tree).
- **[VERIFIED-FACT]** the engine invariant machine itself (§3.5 price band, §11.5.2 turnover, §12.8 ε-gate) is common-base code; the authoritative tree *strengthens* it with the two fixes above.

## 4. Contract and governance differences **[VERIFIED-FACT]**

- `contracts/**`: **byte-identical across lineages** (zero diff) — the entire contract estate, `MTQSigmaV2-PENDING.json` (status `V3_SOURCE_READY_PENDING_DEPLOY`, blocked on fresh funded key — unchanged), V3/V4 sources, forge config.
- Consequently every Phase-0 contract/governance finding (F-0-P0-01 exposure of the deployer key's on-chain authority, F-0-P1-03 governance inversion, OD-35 Safe 1/1 vs mandated 4/7, councils-at-address(0)) applies **unchanged** to the authoritative lineage — the register needs no contract re-assessment, only live re-verification (§9.2 items 2–3).

## 5. Boot and recovery differences **[VERIFIED-FACT]**

- Origin-only artifacts (the entire F-0-P1-02 gap): `scripts/plane5-run.sh`, `scripts/source-integrity-heal.ts` (+57), `scripts/dev-entrypoint.sh`, `scripts/db-selfheal.ts`, `scripts/db-cloud-sync.ts`, `scripts/db-restore-verify.ts`, `scripts/plane5-backstop-heartbeat.ts`, `scripts/git-drift-guard.ts`, `scripts/git-state-classify.ts`, `scripts/runtime-preflight.ts`, `scripts/plane5-db-verify.ts`; `src/lib/boot/` modules (`db-plane-state`, `db-probe`, `generation-store`, `git-drift`, `git-state`, `snapshot-manifest`, `source-integrity` +157, `recovery-authorization` +339, `inproc-publication` +42); `RUNBOOK.md` (+52); scoped total **30 files, +3,675/−73**.
- **Watchdog mechanism precisely stated:** `dev-watchdog.sh` code is (near-)identical on both lineages — including the invocation `bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true`. The security difference is **dependency presence**: on `926ee00` the heal script exists; at `d6fd5d6` it is absent, so the same `|| true` masks a missing-file failure. F-0-P1-02 is thus *lineage-conditional*, exactly as the register states — and the authoritative lineage carries the working layer.
- Dump layer: authoritative tree at chain h23811 / custom 129,583 rows (v13 manifest lineage) vs substituted h3941 / 12,395 — the ~19,870-block deficit documented in the incident record.

## 6. Scheduler and automation differences **[VERIFIED-FACT]**

| Artifact | origin/main | substituted |
|---|---|---|
| `backups/plane5/execution-ledger.jsonl` | **59 entries** through 2026-11-10T23:30:29Z (last durable run) | 1 entry (16:56:44Z BOOTSTRAP-FAILED, parallel lineage `c8cbcc8c`) |
| `backups/plane5/heartbeat.json` / `monitor-state.json` / `alerts.log` | PRESENT | absent |
| plane-5 cron payload contract | pinned to `scripts/plane5-run.sh` with origin/main fallback | script absent locally → fires degrade to origin-sourced guard → BLOCKED relays (safe-by-design) |

Scheduler-platform facts (registration ≠ execution, 15 rejected fires, registry wipes 2×, clock skew +8 h display) are platform-side and unchanged by lineage — F-0-P1-05 applies to both.

## 7. Security-control differences **[VERIFIED-FACT]**

- `scripts/security/secret-scan.ts` (+10) and `secret-scan-allowlist.json` (+64/−14 net) and `secret-scan.test.ts` (+7): authoritative has the expanded allowlist (task-series evolution); both lineages have the fail-closed gate wired.
- `.github/CODEOWNERS`: **absent on BOTH lineages** — F-0-P1-04/P0-03 findings unchanged.
- Rotation packages (`audit-work/task12/D3/D4/D5/D7/D8`, `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md`, `docs/ops/ROLE_ROTATION.md`): common-base era → present on both; §E review (in `independent-review-preparation.md`) applies to the authoritative tree.
- Tests: origin-only +1,797 lines (`tests/git-drift-quoting.test.ts` 284, `tests/plane5-git-state-regression.sh` 567, +4 files) — regression coverage the substituted tree lacks.
- `.github/` definitions: **byte-identical** across lineages (9 workflows; Slither dead wiring `forge-tests.yml:103` and advisory ESLint `ci.yml:72` carry over verbatim).

## 8. Dependency differences **[VERIFIED-FACT]**

- `package.json`, `bun.lock`, `.env.example`: **byte-identical between the two lineages** — the platform's "Rewriting lockfile registry" boot step (observed in `/tmp/boot-timeline.log`) produced identical *tracked* content; the incident class of the substituted tree is lineage/state substitution, not tracked-dependency drift.
- Origin enforces runtime dependency integrity via `scripts/runtime-preflight.ts` (frozen-lockfile, mismatch → repair-once → block) inside the watchdog boot chain — absent from the substituted boot reality (script file present at d6fd5d6 per its own commit content, but the boot-order instrumentation is lineage-conditional; re-verify at restoration).

## 9. Unverified external capabilities **[UNVERIFIED — unchanged]**

Identical to the Phase-0 register (both lineages): CI run history and secret provisioning, GitHub branch protection, runner identity, Turso/Neon credentials, Vercel external hosting, RPC endpoint availability, and the embedded push credential's scope/expiry/admin permissions (owner-side audit item §7.1 of the management plan). The four authoritative-only API routes (§2) may add external-service calls not yet audited — flagged for Phase-1 API authorization assessment, not verified here.

---

## 10. Forensic incident baseline vs canonical architecture baseline — the distinction

| Question | Forensic baseline (d6fd5d6) | Canonical baseline (origin/main 926ee00) |
|---|---|---|
| What is it | the incident artifact captured 2026-11-11T00:20Z | the authoritative architecture the review must certify |
| Phase-0 register posture | findings *necessarily* describe this tree (upload absent; heal absent; engine pre-F-50-1/F-53-1; dev-entrypoint absent) | the same findings need re-anchoring (§11) — several flip status |
| May it be booted | **NO** (§1 STOP; booting restores stale dumps) | only via the sanctioned §6.3 restoration procedure (Gate-#1 precondition) |
| Evidence role | preserved as-is forever (incident evidence) | the object of independent verification |

## 11. Findings that MUST be re-assessed on the authoritative lineage

1. **F-0-P1-02 (self-heal absent at HEAD)** → on 926ee00 the heal layer is PRESENT; the finding's operative form becomes "absent *at the substituted HEAD only*" — re-verify post-restoration with a T-4/T-27-style drill.
2. **F-0-P3-02 (`bun run dev` broken at audited HEAD)** → `scripts/dev-entrypoint.sh` exists on 926ee00; expect resolution after adjudicated realignment; re-verify.
3. **API authorization census (F-0-P1-01 inputs)** → re-run the route census against **63 routes**: the Phase-0 2-a report's 59-route inventory missed `constituency/upload` (present, 403 fail-closed), and never saw `ai/consensus` + `ai/catalog-sync` + `landing-stats` (all present only on authoritative) — the last two ai/* routes are **unassessed authorization surfaces**.
4. **Monetary-engine invariant claims** → the §12 invariant-register seeds were read from pre-F-50-1/F-53-1 code; the authoritative engine adds the execution-pass honesty layer and the zero-size trade guard — re-verify invariant map against `926ee00` code and re-run the live surfaces.
5. **Dashboard-audit divergence** → task46's F-46-1/F-45-2 fixes live on `origin/backup-incident10-amend`, NOT on main (main has its own task47–53 series; RR/LCR ∞ rendering state at main HEAD should be spot-checked at restoration — the substituted lineage's task46 fixed a rendering defect class that main's series may or may not share).
6. **Watchdog boot-chain presence assertion** → the `|| true` masking class must be re-tested on the authoritative boot (fail-closed on missing dependency is Phase-5 work; today both lineages carry the literal `|| true` — the risk is realized only when the dependency is absent, as at d6fd5d6).
7. **Scheduler payload fallback** → verified semantics (origin-sourced guard → BLOCKED) are *code-claimed*; the actual behavior during the current divergence is being observed live (monitor/backstop fires land as BLOCKED relays) — capture one relay output as evidence at next fire.

## 12. Reproduction commands (read-only)

```
git fetch origin
git rev-parse origin/main                                   # 926ee001e70e404dd3ea870c37f4786524458517
git rev-list --count origin/main                            # 251
git merge-base d6fd5d6 origin/main                          # ff67aa2ce9368a82145b00b94e80441738e3426c
git rev-list --left-right --count d6fd5d6...origin/main     # 2  168
git diff --stat d6fd5d6 origin/main | tail -1               # 725 files, +187623/-14231
git diff --stat d6fd5d6 origin/main -- src/app
git diff --stat d6fd5d6 origin/main -- src/lib/mtq/engine.ts        # 66 lines (F-50-1/F-53-1)
git diff --stat d6fd5d6 origin/main -- contracts                   # (empty — identical)
git diff --stat d6fd5d6 origin/main -- package.json bun.lock .env.example  # (empty — identical)
git diff --stat d6fd5d6 origin/main -- .github                      # (empty — identical)
git ls-tree -r --name-only origin/main | rg -c 'src/app/api/.*route\.ts$'  # 63
git ls-tree -r --name-only origin/main | rg 'constituency/upload|ai/consensus|ai/catalog-sync|landing-stats'
git show origin/main:dev-watchdog.sh | rg -n 'source-integrity-heal.ts'     # invocation present (identical text both sides)
git show origin/main:backups/plane5/execution-ledger.jsonl | wc -l          # 59
```

**Status: this document is verification-support material prepared for the independent reviewer; it does not close or re-open findings — §11 enumerates the re-assessments the reviewer must perform on the canonical baseline.**
