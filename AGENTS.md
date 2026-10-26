# AGENTS.md — MTQΣ

## Git policy — latest-first, forward-only (owner directive 2026-10-25)

Owner directive (verbatim intent): *"be sure we are at the latest git, and we
never roll back to older git."* Binding on every session and agent:

1. **Fetch before work.** ALWAYS `git fetch origin` at session start and
   compare local `main` vs `origin/main`. The 2026-10-24 stale-preview incident
   (owner saw "unfixed" UI because a parallel session had never fetched) must
   never recur. If behind, advance ONLY via fast-forward (`git merge --ff-only
   origin/main`) — local work must first be committed/merged so the FF is clean.
2. **Forward-only.** NEVER `git reset --hard` to an older commit, never
   `git checkout <old-sha> -- …` to restore old file versions, never
   `git revert` a whole batch blindly, never force-push. The only lawful
   direction is forward: new commits, fast-forwards, and merge commits.
3. **Guardrails in force.** GitHub `main` is branch-protected
   (force-pushes and deletions BLOCKED, enforced on admins — deliberately
   WITHOUT required PR reviews so direct-push automation keeps working).
   Local repo: `receive.denyNonFastForwards`, `receive.denyDeletes`,
   `push.useForceIfIncludes`. The anchor tag `no-rollback-anchor-2026-10-25`
   marks a verified high-water mark: if `git merge-base --is-ancestor
   no-rollback-anchor-2026-10-25 main` ever fails, main has been rolled back —
   stop and restore forward history. Supersede the anchor only with a NEW,
   LATER tag; never move it backward.
4. **Latest wins, nothing lost.** Before advancing, verify untracked working
   files are preserved (commit them or confirm they are byte-identical to
   incoming tracked versions — as done for the owner's 2026-10-24 upload
   screenshots). Deletions are owner-approved, documented, and
   git-recoverable only (D3 disposition).
