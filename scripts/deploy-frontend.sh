#!/usr/bin/env bash
# Vercel deploys straight from the local frontend/ directory, not from git,
# so it can't silently ship a stale commit the way Render did — but it CAN
# ship uncommitted local changes that never make it into git history,
# leaving the live site out of sync with what the repo says is deployed.
# This script keeps "what's live" traceable to a real commit.
#
# Usage: ./scripts/deploy-frontend.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -n "$(git status --porcelain -- frontend/src frontend/public frontend/package.json frontend/next.config.ts)" ]; then
  echo "ERROR: uncommitted frontend changes. Commit them first so the deployed build matches git history." >&2
  git status --short -- frontend/src frontend/public frontend/package.json frontend/next.config.ts
  exit 1
fi

echo "Pushing to origin/main..."
git push origin main

cd frontend
vercel deploy --prod --yes
