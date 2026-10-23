# MTQΣ — TASK 12 · D7: RELEASE-CONTROL VERIFICATION (backend behavior, not badges)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Task 12 §6 required demonstrating that prohibited actions are not reachable
through execution paths — not that a banner exists. This deliverable records
what was implemented, what was PROVEN to execute (and how), and what remains
UNVERIFIED.

---

## 1. The control model (implemented)

`src/lib/mtq/release-controls.ts` — 8 SEPARATE control states (software tests /
contract verification / economic validation / governance approval /
independent security review / independent economic-legal review / live-pilot
authorization / production authorization) + a 10-action fail-closed map.
Defaults (committed state): every control NOT_GRANTED, every chain-facing
action DENIED. Grants can ONLY come from an owner-authored
`RELEASE_AUTHORIZATIONS_FILE` outside git (version 1 schema; every grant
requires grantedBy + grantedAt + evidenceRef — partial grants are invalid).
**No build result, test pass, audit report, signed-in user, or available
endpoint infers any grant** — encoded as: there is no code path from any such
signal to a GRANTED state.

## 2. Execution-path review (actual reachability audit)

| Path | Chain-facing? | Finding | Action taken |
|---|---|---|---|
| `mini-services/keeper` (port 3040, running, `bun --hot`) | **YES — signs + broadcasts `advanceIndex`/`commitWeights`/`executeRebalance` every 4s whenever env is set** | Unconditional submission — the REAL gap | **Guard added FIRST in `runTick`**: `isActionAllowed("keeper-tx-submission")` checked before provider/signer/contract construction; denied → tick = observe-only no-op with audit row `guard-release-controls` |
| `POST /tick` (manual trigger — "alternate endpoint") | same code path | Reaches `runTick` only | Covered by the same guard (single choke point BEFORE any chain interaction) |
| `src/app/api/inngest` + `src/lib/inngest/functions.ts` (6 scheduled jobs) | NO | keeperTick reads snapshot + Discord alert; sync/backup/monitor/FRED/prune are DB/feed reads | Verified read-only — no change needed; D9 re-reviews future functions |
| API routes (45 scanned, `check:no-neon` clean) | NO | No route signs transactions; no route constructs signers from user input | `proof-of-reserve.ts` only RECOVERS signers from provided signatures (verification) |
| `scripts/*` signing tools | YES historically | deploy/test/fix scripts load keys from env; the compromised-key ones are now RETIRED stubs; read-only verifiers converted to public-address | D1 §A; future script runs are owner-side |
| `Dockerfile.compute`, GitHub workflows | n/a (offline compute; CI) | No signing in workflows | CI now gated on the secret-scan job |

## 3. Demonstrated behavior (run this session — reproducible commands)

| Demonstration | Command | Observed result |
|---|---|---|
| Guard live on the RUNNING keeper | `curl :3040/health` | `releaseControls.grantedControls=0`, `keeperTxSubmission.allowed=false` with the full required-controls breakdown; posture string present |
| Manual trigger is inert | `curl -X POST :3040/tick` | 202 accepted → tick no-ops at the guard; `lastTick` stays `null` (ticks never reach the chain stage) |
| Default deny-all | `bun test …/release-controls.test.ts` | **13/13 PASS**: no source → all denied; malformed JSON → denied; unknown version → denied; partial grant → NOT_GRANTED; nonexistent file → denied |
| Green software gate authorizes nothing chain-facing | same suite | with ONLY `software-tests` granted: keeper/reserve/asset/role/authority/deploy/mint/live-pilot/production ALL still denied; only `database-write` (shadow bookkeeping) opens |
| Deliberate opening is the ONLY path | same suite | complete valid grant set → actions open; all-but-production → production still denied; **overall status remains NOT_ACCEPTED regardless** (acceptance is a governance statement, not a file state) |
| App-side exposure (read-only) | `curl :3000/api/release-state` | posture + 8 controls + 10 actions + honest address-book blockers (ok=false, 2 BLOCKERs) |
| Fail-closed tests in CI | `.github/workflows/ci.yml` `secret-scan` job | runs the release-control + address-book tests on every push/PR (command executed locally: PASS; runner execution UNVERIFIED — no remote) |

## 4. What is deliberately NOT gated (and why)

- **Pilot bookkeeping (`database-write`)**: the shadow-mode pilot's simulated
  trials, engine state, and audit trail keep functioning — they are not
  chain-facing actions. In the committed default (no authorization file even
  for software-tests) even this is denied; the action exists so governance can
  scope bookkeeping freeze later if desired. No application behavior changed
  in Task 12 (the app never calls the gate; only chain-facing paths do).
- **The UI**: no badge was added; the standing banners already in the app are
  display-only and are NOT claimed as enforcement (this deliverable's
  demonstrations are backend/execution-path behavior).

## 5. Honest residual gaps (assigned)

1. **CI runner execution UNVERIFIED** — no remote exists; the same commands
   were executed locally with PASS. Actual GitHub-hosted execution awaits a
   remote + OWNER-ATT-1.
2. **The keeper guard is code-review-verifiable but process-replaceable** — a
   future fork of the keeper without the import would bypass it; D9 includes
   re-review of the keeper on every change + an integrity check in the
   independent verification plan.
3. **The authorization-file mechanism has never been exercised by a real owner
   ceremony** — the opening path is proven only with synthetic grants in tests.
4. **Pre-commit hooks are local config** — each clone must run
   `git config core.hooksPath .githooks` (documented in SECURITY.md §9.1); CI
   is the enforcing backstop.
5. **`production-operations` requires ALL 8 controls** — including
   `production-authorization`, which per the §25.5 gates needs items (external
   audit, Sharia, legal, institutional review…) that only humans can create.

**No release-gate advancement is claimed by any of the above: documentation,
typechecking, linting, and UI tests do not advance gates (Task 11.1 §7 rule).
Release status: NOT ACCEPTED.**
