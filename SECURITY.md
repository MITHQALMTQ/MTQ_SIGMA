# SECURITY.md — MTQΣ Vulnerability Disclosure Policy

| Field | Value |
|---|---|
| Mandate basis | Ext-3 A.8; OD-38 (owner: Security lead + Legal; blocks Gate 5) |
| Status | **PUBLISHED (OD-38).** Required before any public announcement; a Gate 5 blocker otherwise |
| Project status | TESTNET-ONLY. Production reserve trading is NOT authorized (v5.0 §11.2). No production funds are currently at risk; bounty terms become effective only upon Committee approval (§6) |
| Register refs | OD-38 SATISFIED-BY-DOCUMENT; T-57/T-88 unaffected; feeds Gate 5 "Independent security audit passed" |

---

## 1. Disclosure channel

- Email: **security@mtq-sigma.example** (placeholder pending domain registration — TODO: replace with the operational domain mailbox before any public announcement).
- PGP: encrypted submissions preferred. Key fingerprint: **TODO — publish PGP public key and fingerprint alongside this policy.** (Placeholder; must be filled before the policy is cited publicly.)
- Reporters should include: affected contract/service, chain and address, reproduction steps, impact assessment, and any proof-of-concept.

## 2. Response SLA

| Stage | Commitment |
|---|---|
| Acknowledgment | Within **24 hours** of receipt |
| Triage + severity classification | Within **72 hours** of receipt |

## 3. Disclosure timeline

- Coordinated disclosure: public disclosure **after the fix is released OR 90 days from report receipt, whichever comes first**.
- The project will not publicly disclose reporter details without consent.
- Extension requests (e.g., complex fix, coordinated multi-party disclosure) are negotiated in good faith.

## 4. Safe harbor

Good-faith security research on the systems in §5 is **explicitly authorized**. The project
will **not** pursue legal action against researchers who:

- act in good faith, within the scope below;
- avoid privacy violations, data destruction, and degradation of service;
- use the disclosure channel in §1 and give the project a reasonable opportunity to remediate before any public disclosure.

Researcher obligations: no exfiltration of user data, no destructive testing, no
denial-of-service load, no social engineering, and no public disclosure before the §3
timeline permits.

## 5. Scope

### 5.1 In scope

| Component | Artifacts |
|---|---|
| MTQΣ contracts | MTQ.sol, Mint.sol, Redeem.sol, Reserve.sol, Oracle.sol, Algorithm.sol, Governance.sol, Takaful.sol |
| Oracle adapters | on-chain Chainlink/Pyth/Chronicle adapters and the off-chain source pipeline (oracle.ts feed configuration) |
| Keeper service | keeper decision, signing, submission, and commit-reveal machinery |
| Pilot Command Center | frontend and API surfaces |

### 5.2 Out of scope

- Third-party contracts without a direct MTQΣ interaction path.
- DDoS / spam / volumetric attacks.
- Social engineering, phishing, physical attacks.
- Compromised testnet keys (testnet deployments use test assets; loss of testnet key material is not a bounty event).
- Findings in dependencies already fixed upstream and not reachable in deployed bytecode.

## 6. Bounty structure — **PROPOSED (pending Committee approval)**

Model: **Severity x percentage of funds at risk**. This structure is PROPOSED; it is not
yet approved and not yet funded.

| Severity | Basis | Cap |
|---|---|---|
| Critical | up to **10% of funds at risk** | capped by the governance-approved bounty budget |
| High | **5% of funds at risk** | capped by the governance-approved bounty budget |
| Medium | fixed amount | set by Committee |
| Low | swag / public credit | — |

Notes:

- "Funds at risk" is assessed per finding (what a successful exploit could actually touch), not per total TVL, and is judged by the severity-classification process in §2.
- Duplicate reports: first valid report per finding receives the bounty.
- Safe-harbor violations (§4) void eligibility.
- While the project is testnet-only there are no production funds at risk; any payouts before production would be discretionary and Committee-approved.

## 7. Program hosting

**Decision pending:** host the program on Immunefi or self-host it. Criteria: safe-harbor
legal coverage, payout custody, report triage tooling, and alignment with the §4 terms.
The decision is recorded with the Committee when §6 is approved. Until then, the §1
channel is the single intake path.

## 8. Status rollup

- OD-38: **SATISFIED-BY-DOCUMENT** — this policy exists and is published in-repo.
- Gate 5 blockers that remain open independently of OD-38: OD-35 (Safe configuration verification), independent security audit, emergency policy OD-6 field test, T-80/T-87 not-demonstrated items.
- This document must be updated (real domain mailbox + PGP fingerprint + approved bounty table + hosting decision) before any public announcement referencing a bug bounty.

---

## 9. Repository secret handling (Task 12 §2.2)

This section governs secrets **inside this repository** (distinct from §5's
external disclosure scope).

### 9.1 Prevention controls (enforced, tested)

| Control | Where | Behavior |
|---|---|---|
| Secret scanner (fail-closed gate) | `scripts/security/secret-scan.ts` → `bun run security:scan` | Detects EVM hex keys, raw 64-hex keys, Solana 128-hex/base58/keypair-JSON secrets, mnemonics, env-file key assignments, PEM blocks, and the two KNOWN compromised literals (C-045-a/C-045-b — always flagged, never suppressible). Exit 1 on any non-allowlisted finding. |
| CI gate | `.github/workflows/ci.yml` job `secret-scan` | Runs FIRST; every other CI job depends on it. Also runs the regression test proving a seeded SYNTHETIC secret blocks the gate without printing its value. |
| Pre-commit hook | `.githooks/pre-commit` (activate: `git config core.hooksPath .githooks`) | Scans staged files; commit is rejected on findings. |
| Known-secret redaction tool | `scripts/security/redact-known-secrets.ts` | Fingerprint-anchored purge of the two compromised literals; never prints values; sha256 before/after recorded. |
| Secret-safe output discipline | All of the above | Findings print file:line + rule + first-4…last-4 fingerprint only. Tooling never echoes matched values, exceptions, or argv containing secrets. |

**Honest scope:** the scanner detects secret-shaped patterns in text files.
A clean scan does NOT prove that no external copy of any secret exists, and
does NOT revoke any exposed key.

### 9.2 False-positive process (value-safe)

Never paste the flagged value anywhere — not in issues, PRs, chat, or
commits. Add an entry to
`scripts/security/secret-scan-allowlist.json`:
`{ file, rule, justification, addedBy, addedAt }`, where the justification
names the PUBLIC benign constant by its meaning and verification basis (e.g.
"OpenZeppelin MINTER_ROLE hash — public OZ constant"), never by its value.
Entries are security-relevant and go through code review. The
known-compromised-literal rules are never suppressible.

### 9.3 Exposed-credential incident procedure

1. **Contain spread (repository)** — run
   `bun run security:redact:execute` (fingerprint-anchored purge; dry-run
   first). Record findings with sha256 evidence.
2. **Report** — record the incident (identifier, fingerprint, exposure
   channels, window) in the audit register and, for platform-side surfaces,
   to the owner's security lead. Do not reproduce the secret while reporting.
3. **Rotate reachable credentials** — rotate every service credential that
   could have touched the affected surfaces (per D2 §1.3:
   TURSO_AUTH_TOKEN / TURSO_DATABASE_URL creds / FRED_API_KEY /
   DISCORD_WEBHOOK / KEEPER_URL / any PAT) — conditional on the
   remote-existence attestation (OWNER-ATT-1).
4. **Rotate the KEY ITSELF on-chain** — repository cleanup is NOT revocation:
   follow the migration packages
   (`audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md`,
   `D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md`) through the owner-approval
   checkpoints (`D8-OWNER-APPROVAL-CHECKLIST.md`).
5. **Verify replacement** — post-remediation verification is performed by an
   independent party per
   `audit-work/task12/D9-INDEPENDENT-VERIFICATION-PLAN.md` (fresh role
   matrices, destination dossiers, balance evacuation proofs) BEFORE any
   "contained/rotated/revoked" language is used.

### 9.4 Key-generation hygiene

Keys for rotation are generated owner-side by
`scripts/generate-new-evm-key.mjs` (writes a 0600 file; never prints
secrets). No AI-accessible signing workflow exists for compromised accounts
(retired: `set-solana-multisig.mjs`, `solana-create-*`, `solana-set-metadata*`,
`verify-sol-key2.ts`).
