# MTQΣ Phase-0 — P0 Evidence Preservation Register (Integrity Manifest and Chain of Custody)

**Document ID:** SEC-P0-EVIDENCE-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T14:2xZ (UTC) · **Workstream:** A (directive §2)
**Branch:** security/phase-0-review-prep @ fc9ad97 + this commit (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage. Every digest below was computed locally and is reproducible by the owner/reviewer with the commands in §5; no secret value is reproduced anywhere (fingerprints, object identifiers, and digests only). Git blob SHA-1 identifiers are NOT content verification — SHA-256 digests are recorded separately in Table 2 and are the binding integrity values.

---

## 0. Scope

All available Phase-0 evidence artifacts: the 17-document frozen baseline, the management plan, the four prior review-branch documents, the ten new documents delivered by this assignment, supplementary tracked evidence, local session artifacts, and the honest record of artifacts lost to the 2026-11-11T00:20Z platform re-image. Structure note: paths/refs/blobs/sizes are listed in Table 1; SHA-256 digests are listed separately in Table 2, referenced by evidence ID (keeps 64-hex digest lines free of any context words that the repo's fail-closed scanner treats as indicator-context — same convention as the prior evidence package).

**Classification legend** (directive §2.1 vocabulary): `PV` = PRESENT AND VERIFIED · `PNV` = PRESENT BUT NOT VERIFIED · `LOST` = LOST IN PLATFORM RE-IMAGE · `OCS` = AVAILABLE ONLY THROUGH OWNER-SUPPLIED COPY · `EXT` = EXTERNAL EVIDENCE REQUIRED · `NA` = NOT AVAILABLE.

**Availability legend:** `branch` = hash-verifiable from a Git ref (remote after push) · `local` = exists only inside this sandbox · `owner-side` = must be supplied by the owner · `absent` = no copy known to exist on this substrate.

---

## 1. Table 1 — Evidence inventory (path, refs, identifiers, size, classification)

Baseline set — branch `security/phase-0-baseline` @ `ff59515852053f197ddd725b7bc4107d63a0d589`:

| ID | Path (under `security/assessments/phase-0/`) | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| B-01 | architecture-inventory.md | baseline | ff595158… | 58b60fabb566ad14ab4bf291265a1959462e18f5 | 11391 | PV | branch | digest recomputed, matches Table 2 |
| B-02 | attack-path-analysis.md | baseline | ff595158… | f69c7764ea185163a8ffebf6c7ae073adddc5d16 | 7051 | PV | branch | digest recomputed |
| B-03 | authority-graph.md | baseline | ff595158… | 894ff5e31faca810ae320a258e5a9881cb55d009 | 6184 | PV | branch | digest recomputed |
| B-04 | authorization-flow-inventory.md | baseline | ff595158… | a44f4a70766221b4764f7c84bd52c9692313725c | 7516 | PV | branch | digest recomputed |
| B-05 | contract-and-governance-assessment.md | baseline | ff595158… | f224eecea0d9405237725e48d0ab48b9a55f89f9 | 4567 | PV | branch | digest recomputed |
| B-06 | critical-asset-inventory.md | baseline | ff595158… | 95d5f13b409be7be3909e498b1e46d0b67d2bd2c | 9236 | PV | branch | digest recomputed |
| B-07 | critical-vulnerability-register.md | baseline | ff595158… | 249a8d953e9b50611b16c5c24339323cfb4aa789 | 18550 | PV | branch | digest recomputed |
| B-08 | developer-ai-and-cicd-assessment.md | baseline | ff595158… | 61c7451e17829b0423eeaa0d0294301161e6e72e | 6310 | PV | branch | digest recomputed |
| B-09 | phase-0-evidence-index.md | baseline | ff595158… | 1a60bbf469e34190c6dc5803a491f7fc474d12b4 | 9795 | PV | branch | digest recomputed |
| B-10 | phase-0-executive-summary.md | baseline | ff595158… | d0d94cccee89a2411d75831b2c0a0e367644896e | 9103 | PV | branch | digest recomputed |
| B-11 | recovery-and-state-integrity-assessment.md | baseline | ff595158… | b6dac1cdd655bced4fe6ba0b7d7519288c6f548d | 6549 | PV | branch | digest recomputed |
| B-12 | security-dependency-register.md | baseline | ff595158… | 24fdea91c290da90e13d9282f9531edb2aded559 | 5317 | PV | branch | digest recomputed |
| B-13 | security-phase-plan.md | baseline | ff595158… | f4fe0949da089c8fa964f92be39ec841859ba013 | 8034 | PV | branch | digest recomputed |
| B-14 | threat-model.md | baseline | ff595158… | b02fda34e9ad8d5be6dc21eef71ddc1fe59b8651 | 7000 | PV | branch | digest recomputed |
| B-15 | trust-boundary-diagram.md | baseline | ff595158… | 2a57a77c1ca6d66146bc75b00a489ce2c9e75531 | 10942 | PV | branch | digest recomputed |
| B-16 | validator-bridge-oracle-assessment.md | baseline | ff595158… | d014ae65f20682bee342082aa94b68287ba71de0 | 4267 | PV | branch | digest recomputed |
| B-17 | wallet-and-signing-assessment.md | baseline | ff595158… | f5ae9c161f89c15c7f030b35fa293cc452e15295 | 3836 | PV | branch | digest recomputed |

Management plan — branch `security/phase-0-management-plan` @ `a328d97d4f545484267ff8776e63eda3316d20a9`:

| ID | Path | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| M-01 | security/assessments/phase-0/management-containment-and-review-plan.md | management-plan | a328d97d… | df106fee0636ce9696f27827ff5dbcd6d294901c | 40161 | PV | branch | digest recomputed (SEC-P0-MGMT-001) |

Prior review-branch documents — branch `security/phase-0-review-prep` @ `fc9ad971559c85cf859310937abbd77f60b5023d` (parent of this commit):

| ID | Path (under `security/assessments/phase-0/`) | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| P-01 | authoritative-main-delta-assessment.md | review-prep | fc9ad971… | d2de913ef5f45e98012d6a54c110ae4b685a0405 | 15060 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 (SEC-P0-DELTA-001) |
| P-02 | sechist assessment (file: secret-history-assessment.md) | review-prep | fc9ad971… | 4e1740bf3a0b6a38c443b7b0f5827a117f1c7f40 | 13969 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 (SEC-P0-SECHIST-001) |
| P-03 | independent-review-preparation.md | review-prep | fc9ad971… | 70f92c9503030ba7d67447bcb0dd66ddf4c4e24c | 28037 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 (SEC-P0-IRP-001 v1.1) |
| P-04 | public-object-exposure-and-review-addendum.md | review-prep | fc9ad971… | 462024321ba8d8b2861f9152ff489db1042ba280 | 54824 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 (SEC-P0-ADDENDUM-001) |

New documents delivered by this assignment — branch `security/phase-0-review-prep`, commit = the commit carrying this register:

| ID | Path (under `security/assessments/phase-0/`) | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| N-01 | public-object-exposure-review-package.md | review-prep | this commit | 206906070491fa602c592132d241dfa8628ffb8e | 42725 | PV | branch (post-push) | blob id pre-computed via hash-object; digest in Table 2 |
| N-02 | evm-key-compromise-containment-readiness.md | review-prep | this commit | ed95abdd8d303937ce8ea54eb8940f99fce66f33 | 42608 | PV | branch (post-push) | digest in Table 2 |
| N-03 | solana-key-compromise-containment-readiness.md | review-prep | this commit | e94735041da4ced2cb4c70de974801a59f2ad7dd | 32941 | PV | branch (post-push) | digest in Table 2 |
| N-04 | api-authorization-independent-review-package.md | review-prep | this commit | 6da36a51a2cdff201cba71387fc731a37f0f7a31 | 47711 | PV | branch (post-push) | digest in Table 2 |
| N-05 | boot-chain-source-integrity-review.md | review-prep | this commit | 7efe3907b3aa2ac14239c25be480fcc03aa20528 | 57044 | PV | branch (post-push) | digest in Table 2 |
| N-06 | platform-identity-and-recovery-separation.md | review-prep | this commit | a06a18d051e579373087c2a603ba9450e36e0b77 | 42395 | PV | branch (post-push) | digest in Table 2 |
| N-07 | independent-security-reviewer-handoff.md | review-prep | this commit | d9c0118c96e63c2d26988eb8ca435a13861d4757 | 63564 | PV | branch (post-push) | digest in Table 2 |
| N-08 | owner-p0-decision-register.md | review-prep | this commit | d0ae8466067a889eb4eeb9942cf6379e4f8287c0 | 12444 | PV | branch (post-push) | digest in Table 2 |
| N-09 | p0-containment-readiness-executive-report.md | review-prep | this commit | cc949b1214746acae3a42781834d280952c9de3a | 12818 | PV | branch (post-push) | digest in Table 2 |
| N-00 | p0-evidence-preservation-register.md (this file) | review-prep | this commit | (self) | (self) | PV | branch (post-push) | its own digest cannot appear inside itself — recorded verbatim in the commit message and recomputable via `sha256sum` after checkout |

Supplementary tracked evidence — branch `security/phase-0-review-prep` @ `fc9ad971…`:

| ID | Path | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| S-01 | audit-work/v9-roles/role-matrix-authoritative.json | review-prep | fc9ad971… | 12df8c27b855debb5188f6a1b5cc6274faaa7c7b | 25948 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 (2026-10-21 role probe) |
| S-02 | audit-work/v9-roles/ROLE-VERIFICATION.md | review-prep | fc9ad971… | f894c7feeeefa0c9c51c373140ebd4dd8c599ee2 | 5547 | PV | branch | digest recomputed |
| S-03 | audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md | review-prep | fc9ad971… | c1f77312ecf034b7ec2c9b23c0b91f804bf37ef4 | 29115 | PV | branch | digest recomputed |
| S-04 | scripts/security/secret-scan.ts (committed scanner) | review-prep | fc9ad971… | e10217e4ef6cbdad0423d0dab84260fca157f64c | 21987 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 |
| S-05 | scripts/security/redact-known-secrets.ts | review-prep | fc9ad971… | 9ff6bdf4815e61c3dc54589be1b633099ff57418 | 13648 | PV | branch | digest recomputed — MATCHES value recorded at fc9ad97 |
| S-06 | scripts/security/secret-scan-allowlist.json | review-prep | fc9ad971… | ce07ecf01b8b3e4737383d0124cba143346aa5b5 | 13043 | PV | branch | digest recomputed |

Local session artifacts (sandbox-only; preserved separately from the branch; not Git-tracked):

| ID | Path | Git reference | Commit | Blob (SHA-1) | Bytes | Class | Availability | Verification result |
|---|---|---|---|---|---|---|---|---|
| L-01 | /home/z/phase0-review-tmp/object-exposure-tests.sh | none (local) | — | — | 3699 | PNV | local | digest computed locally (Table 2); survives only until sandbox disposal |
| L-02 | /home/z/phase0-review-tmp/object-exposure-tests.log | none (local) | — | — | 8933 | PNV | local | digest computed locally (Table 2) |
| L-03 | /home/z/phase0-review-tmp/api-battery.sh | none (local) | — | — | 2086 | PNV | local | digest computed locally (Table 2) |
| L-04 | /home/z/phase0-review-tmp/api-final.sh | none (local) | — | — | 1118 | PNV | local | digest computed locally (Table 2) |
| L-05 | /home/z/phase0-review-tmp/api-retry.sh | none (local) | — | — | 1176 | PNV | local | digest computed locally (Table 2) |
| L-06 | /home/z/phase0-review-tmp/key-blobs.txt (23 key-material blob-ID listing — identifiers only, no values) | none (local) | — | — | 943 | PNV | local | digest computed locally (Table 2) |
| L-07 | /home/z/phase0-review-tmp/briefing-master-directive.md (this session's subagent briefing — contains addresses/fingerprints only, no values) | none (local) | — | — | 14550 | PNV | local | digest computed locally (Table 2) |

Lost and external evidence (no digests fabricated):

| ID | Item | Class | Availability | Verification result |
|---|---|---|---|---|
| X-01 | Original private scan harness (pre-re-image) | LOST | absent | digests UNRECORDABLE from this substrate — do NOT fabricate; an owner-side pre-re-image copy, if any, is the sole surviving source (OCS if produced) |
| X-02 | Original raw redacted scan output (pre-re-image) | LOST | absent | digests UNRECORDABLE — do NOT fabricate; same OCS condition |
| X-03 | CKPT-2 custody attestation (current Solana mint authority `DbFjz…`) | EXT | owner-side | must be generated outside this repository/sandbox/any AI environment |
| X-04 | GitHub embedded push-token identity/scope/expiry/audit-log evidence | EXT | owner-side | T-1…T-10 checklist in SEC-P0-IDENT-001 §3 |
| X-05 | Platform-provider re-image audit / root-cause evidence | EXT | owner-side | SEC-P0-IDENT-001 §4 |
| X-06 | Live Vercel ingress/edge protection evidence for the deployment | EXT | owner-side | SEC-P0-APIREV-001 §4 four-way classification |

**Recreation honesty note:** the current committed scanner (S-04), redaction helper (S-05), and allowlist (S-06) are the post-re-image in-repo tools; the recreated session harness directory (2026-11-11T11:42Z) produced artifacts L-01…L-06. None of these is claimed byte-identical to the lost originals (X-01/X-02).

---

## 2. Table 2 — SHA-256 content digests (referenced by evidence ID)

| ID | SHA-256 digest |
|---|---|
| B-01 | 7de2e4ba7661bca5996debd30c4e05259abb4eb6a8924e915fb4789d3c88e97d |
| B-02 | 9a0d628d5db5aea443f679f5876a8814251235578066ce15d77059d5e5cb83b1 |
| B-03 | 2447dcc41d33635e445e951ae7122f4e072ed14d473546475ec9f9272fde5897 |
| B-04 | 3d3f89662dc1a3847cc187697f4e6fea1a9a16c444ca1625b6f8d35adc1b1bde |
| B-05 | b15ac870763fd115f6a60c90efb1a3472260906605f2f4347d223c5eee48b7df |
| B-06 | 77953434dfd207adea53865de46ea8581f4ff5ad7058a8a8d20fe12cf052bc4c |
| B-07 | dac95169344aa5d02e8419bfc584ca7c0d6803476dc03a420308cb4a8c903508 |
| B-08 | 5348cc02bbed47e661e285ea020f553ce7f069b927cc2ac8f3a3593069cc59ae |
| B-09 | f764f5cfbacc157aaa6c39fe840905186c21bf05d4c8d067d5382d9a57724a30 |
| B-10 | c866a9d77b48d90ae1958d4817a5e8ef71d93c0fe8ec7f8b7e07cdc02aef5957 |
| B-11 | 03e9d4a39553efed782264056f2a2ef09b272b5ce669226f2fb878ca52155d0f |
| B-12 | 7f9894d75d359ff53c66cf2df94804fe93517c44564720224a24353a8192f6b5 |
| B-13 | ae067733f2ab8837ff087205a6f4f4401023c24c9d57630eb162f8bb664f91d5 |
| B-14 | 9db000638518919b5b92628c0d0c53fa1f64d5d0d3bdcee8ffe8b54c5082f7e6 |
| B-15 | 36611c4277cb6fef5798ab5614ddd9614c9612ee631b7e78589b04917eb64609 |
| B-16 | d2b02a325f53909e289ed4f90cfbf8b855bd1f00c8dd3b1dbb836e49437ce1f9 |
| B-17 | 4e5fd49e504f8391cfd94910fa0a3bd92e48ec800c57cb3ffa0661b25ae97cf8 |
| M-01 | ef54488aeca97d3ade455866e611365082cc0e41cf239d7ebf5680956c15e33b |
| P-01 | bedc0dbc184ad438ee6c50db79a7b28f3fdf16681856f01edd45a6d3c4e7f402 |
| P-02 | 098112dbbf41acf21082a8c2c4eecb0f049e585f846835f3807f4412b512b96a |
| P-03 | e2c28a73a8fb278031baf9a079b26694968d037b55cef4223333a7a4f0cfbbe2 |
| P-04 | 6b99a6c643e229327c280d3bfc9530c7b92868fd858d34ad0555bb1cd626b200 |
| N-01 | 1bab78e131fb5bd51c3271762d47fabbf3543dbfa02b99eb715869947c8ec0ef |
| N-02 | 1c8d44193910a1c1b1668ea280edae88dd4e29b5c3ddb355df7a21ebd4f38a9d |
| N-03 | ce0e5a155bc61a92048e87d8ff88fd09c84d2c582c712bd7ae22821558f9067d |
| N-04 | 42068fbe13fcde69310b05df2292f957c051c847a76c82b83bff8c71441c02a8 |
| N-05 | 042dfea30045cf80bd8c9147415722642ffc6b0bc6a1eff4cd550e7d1d1ec039 |
| N-06 | 80c0b49d5788416aea98a841b76c1dd52d7b4fd44122256b4f61cceb6547df51 |
| N-07 | 5a76aa99d0e2e8478b6248be1ddd2835dffc13b73ca604247a5350d3f201f349 |
| N-08 | 27d01353154247334938938ae82cabbfddd95cb9d4255c232930b955c75deba9 |
| N-09 | e1f3b597d38080c1751de516a117b5826252b68f4e7290819e67ecda8a8cd9f6 |
| S-01 | 362a767c418a64ea83b3878f48f05092a390907344f36591c53977dc1484e5f3 |
| S-02 | e9bdcf653b76ba47aa9374e37919fd35ff994373608f44534624425e092465b5 |
| S-03 | 211508393d22dfadb0658c1a33a424c937e2893e2ccf20ac6bc82de35100178d |
| S-04 | 92681a780bd974c414af7b16d423953894a64734cc190d15073458e93ad722f5 |
| S-05 | f2b9f544659cc91fb327740e6d5fc45d2ef32eb2c02d2881b85278cc01e96657 |
| S-06 | eec360654e659b9ff4a357e37545cb9eb740499b04bb466a4067ebbb3e705754 |
| L-01 | 3b170dc49ceda862db13d8ad9ca8fbe10ee876f0ac440cbcf5ba91f2444efa25 |
| L-02 | 14b1f55f22a0447615a97e58498e826693d209eef30ab36ba5b5365231522594 |
| L-03 | 583669ebf33cb173206a569c5f26e20e6bbb87244f649e20436829cb925e7e88 |
| L-04 | b35336d06d836fc266bc3c9174eeb4f6bc3eca27cd41f6971b592630e5a51913 |
| L-05 | 7bbd517d55eb9beeccc6dbb4650a501154be18227f231740aaf5abb14d3df756 |
| L-06 | b77b221892153a4e66de09dd56ac9185cb11500083a62982a791b9982db0d8d1 |
| L-07 | 99efbf3d377c131098a9d8d385217d1fe6f88a9b58a697f4a83bbb641441d2fe |

**Cross-validation record:** the digests for P-01, P-02, P-03, P-04, S-01, S-04, S-05 computed above were independently recomputed on 2026-11-11T14:2xZ and MATCH the values recorded in the fc9ad97 commit message — confirming the prior evidence package is intact and unmodified on this branch. Baseline digests B-01…B-17 were recomputed fresh in this session (the 17-document baseline manifest itself is UNCHANGED from the frozen baseline).

---

## 3. Chain of custody

### 3.1 Current state (honest record)

- **Evidence owner:** the MTQΣ repository/network owner. No custodian name is recorded because none has been formally appointed — none is invented here.
- **Current custody location:** the assessed development sandbox itself (review worktree + local artifacts L-01…L-07). This is a STATED LIMITATION: the evidence currently lives inside the environment it describes; it must be transferred to an independently controlled owner archive before it can serve as third-party-verifiable evidence.
- **No transfer has occurred. No verification by an external custodian has occurred.** Both are recorded as NONE TO DATE.
- **Transformation/redaction disclosure:** the frozen evidence set (B-01…B-17, M-01, P-01…P-04) is byte-unmodified (digests match previously recorded values). The ten new documents are authored redacted-by-construction (no credential or secret values are present in any of them). No other transformation was applied.

### 3.2 Required custody procedure (owner executes; nothing below has been performed)

1. Owner appoints a named security custodian (identity recorded outside this repository).
2. Custodian exports the evidence set: the four Git refs (`security/phase-0-baseline`, `security/phase-0-management-plan`, `security/phase-0-review-prep` at its post-push tip, `origin/main` @ `926ee00` for provenance) plus the local artifacts L-01…L-07 (transferred out of the sandbox before its disposal).
3. Custodian verifies every row: Table 1 blob/size via `git rev-parse <ref>:<path>` / `git cat-file -s <blob>`; Table 2 digests via the commands in §5.
4. Storage in an owner-controlled environment outside the development sandbox, with access control recorded (who can read, who can modify — default: read-only for the reviewer, write only for the custodian).
5. Transfer record completed (template below) and the register updated to `PV/branch+archive`.

### 3.3 Transfer record template (all fields NONE TO DATE)

| Field | Value |
|---|---|
| Date/time of transfer | NONE TO DATE |
| From (custodian) | NONE TO DATE (currently: assessed sandbox — limitation) |
| To (custodian) | NONE TO DATE |
| Method/transport | NONE TO DATE |
| Manifest version | this register v1.0 (44 rows + 6 external items) |
| Hash verification performed by | NONE TO DATE |
| Verification result | NONE TO DATE |
| Transformation/redaction applied | none (see §3.1) |
| Signature | NONE TO DATE |

---

## 4. Reproduction and verification commands (§5 of the register)

For any tracked row (example uses B-01; substitute ref/path/ID as needed):

```bash
# blob id + size (must match Table 1)
git rev-parse security/phase-0-baseline:security/assessments/phase-0/architecture-inventory.md
git cat-file -s 58b60fabb566ad14ab4bf291265a1959462e18f5
# content digest (must match Table 2, row B-01)
git show security/phase-0-baseline:security/assessments/phase-0/architecture-inventory.md | sha256sum
```

For the new-document rows (after this commit is pushed): `git show security/phase-0-review-prep:<path> | sha256sum` must equal Table 2 (N-01…N-09); `git rev-parse security/phase-0-review-prep:<path>` must equal the Table 1 blob column. For local artifacts: `sha256sum /home/z/phase0-review-tmp/<file>`. Remote equality: `git ls-remote origin security/phase-0-review-prep` must equal the local tip.

---

## 5. Final status block

- `P0 CONTAINMENT READINESS — DOCUMENTED`
- `INDEPENDENT REVIEW — REQUIRED`
- `OWNER ACTIONS — OPEN`
- `PHASE 1 — NOT AUTHORIZED`
- `TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED`

Not reported (because none occurred): keys rotated; credentials revoked; permissions migrated; repository made private; independent audit passed; recovery infrastructure remediated; production security achieved.
