#!/usr/bin/env bash
# Bootstrap the GitHub repo for @bogdanrn/yt-embed.
#
# Run once after the initial commit is in place. Re-runs are mostly idempotent;
# operations that conflict with existing state fall back via `|| true`.
#
# The repo at https://github.com/bogdanrn/yt-embed is assumed to already exist
# (created via the GitHub web UI or a prior `gh repo create`). This script
# configures settings, branch protection, environment, and Pages — it does NOT
# create the repo.

set -euo pipefail

OWNER=${OWNER:-bogdanrn}
REPO=${REPO:-yt-embed}

echo "==> Pointing local origin at GitHub"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/${OWNER}/${REPO}.git"
else
  git remote add origin "https://github.com/${OWNER}/${REPO}.git"
fi

echo "==> Repo settings"
gh api -X PATCH "repos/${OWNER}/${REPO}" \
  -F delete_branch_on_merge=true \
  -F allow_squash_merge=true \
  -F allow_rebase_merge=true \
  -F allow_merge_commit=false \
  -F has_issues=true \
  -F has_wiki=false \
  -F has_projects=false

echo "==> Allow GitHub Actions to write"
gh api -X PUT "repos/${OWNER}/${REPO}/actions/permissions/workflow" \
  -F default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true

echo "==> Branch protection ruleset on main"
gh api -X POST "repos/${OWNER}/${REPO}/rulesets" --input - <<'JSON' || \
  echo "  (ruleset may already exist; ignoring conflict)"
{
  "name": "main protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [{ "context": "ci" }]
      }
    }
  ],
  "bypass_actors": [
    { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
  ]
}
JSON

echo "==> Release environment"
gh api -X PUT "repos/${OWNER}/${REPO}/environments/release" \
  -F 'wait_timer=0' >/dev/null

if [ -n "${NPM_TOKEN:-}" ]; then
  echo "==> Setting NPM_TOKEN env secret"
  echo "$NPM_TOKEN" | gh secret set NPM_TOKEN --repo "${OWNER}/${REPO}" --env release
else
  echo "WARN: NPM_TOKEN env var not set in shell. Set it manually with:"
  echo "  gh secret set NPM_TOKEN --repo ${OWNER}/${REPO} --env release"
  echo "Generate a publish token first with: npm token create --read-only=false"
fi

echo "==> GitHub Pages (workflow-driven)"
gh api -X POST "repos/${OWNER}/${REPO}/pages" \
  -F 'build_type=workflow' >/dev/null 2>&1 \
  || echo "  (Pages may already be enabled; ignoring conflict)"

echo
echo "Bootstrap done."
echo
echo "Manual step (only one): install CodeRabbit GitHub App"
echo "  https://github.com/apps/coderabbitai → install on ${OWNER}/${REPO}"
echo
echo "Then push: git push -u origin main"
