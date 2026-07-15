# Branch Protection Checklist

Configure GitHub branch protection for `main` with these required status checks:

1. `smoke-deploy`
2. `smoke-edge-security`

Recommended settings:

1. Require a pull request before merging
2. Require approvals (at least 1)
3. Dismiss stale approvals when new commits are pushed
4. Require branches to be up to date before merging
5. Include administrators
6. Restrict force pushes
7. Restrict branch deletions
