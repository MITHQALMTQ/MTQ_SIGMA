# Vault snapshot provenance (durable mirror of mtq-sigma-backups/recovery-v27-critical-20261108T052951Z)

The on-box vault directory is inside gitignored /mtq-sigma-backups/* — this snapshot
mirrors its TEXT evidence into the tracked tree (committed + pushed = durable).
Big binaries are NOT mirrored; their durable recovery paths:

| Vault item | Durable copy |
|---|---|
| git-state/local-line-compact.bundle (ff67aa2..9fe4058: 11 owner screenshots, task46-amend dumps, PCC.tsx, worklog) | **origin branch backup-incident10-amend** (pushed 2026-11-08 ~05:57Z — fetchable: git fetch origin backup-incident10-amend) |
| dumps/origin-latest-chain.sql, dumps/origin-latest-custom.sql | origin/main @ 6243041 tree: backups/db-snapshots/latest-*.sql (byte-identical, GIT-VERIFIED) |
| dumps/disk-latest-*.sql | re-derivable from the live DB by the write-behind loop (60-block threshold) |
| db-live/chain.db, db-live/custom.db | regressed pre-recovery snapshot state — new-checksum-only evidence (SHA256SUMS.txt); superseded by the recovered live DBs |
| selfheal-archive 20261108T0505* entries | documented in CUSTODY-README (wiped-chain.db-at-boot evidence, incident class #6) |

SHA256SUMS.txt covers the on-box vault files byte-for-byte; every file mirrored here
hashes identically to its vault original.
