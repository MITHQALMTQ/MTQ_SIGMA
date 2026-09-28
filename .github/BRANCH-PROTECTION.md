# Branch Protection Rules (enforce on GitHub Settings → Branches)

## main branch protection:
- Require pull request before merging: YES
- Require approvals: 2
- Dismiss stale pull request approvals when new commits are pushed: YES
- Require status checks to pass: YES (CI, Foundry Tests)
- Require branches to be up to date: YES
- Require conversation resolution before merging: YES
- Restrict who can push: Administrators only
- Do NOT allow force pushes
- Do NOT allow deletions

## autonoma-integration branch:
- Same as main but allow force pushes for development

## Preventing rollback:
- Force push disabled on main
- Delete disabled on main
- All changes via PR with 2 approvals
- CI must pass (typecheck + no-neon + tests)
