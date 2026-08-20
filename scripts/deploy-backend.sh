#!/usr/bin/env bash
# Pushes to origin, triggers a Render deploy, and verifies the commit that's
# actually live matches what was just pushed — fails loudly instead of
# silently redeploying stale code (which is exactly what happened once:
# several commits sat local-only while `render deploys` kept redeploying an
# old commit with no error, because the Render API has no way to know your
# local HEAD moved).
#
# Usage: RENDER_API_KEY=... ./scripts/deploy-backend.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SERVICE_ID="srv-d9vjkjnlk1mc7389if30"

: "${RENDER_API_KEY:?Set RENDER_API_KEY first (Render dashboard > Account Settings > API Keys)}"

if [ -n "$(git status --porcelain -- backend)" ]; then
  echo "ERROR: uncommitted changes in backend/. Commit them first — deploying only ever ships what's committed." >&2
  git status --short -- backend
  exit 1
fi

echo "Pushing to origin/main..."
git push origin main

LOCAL_HEAD="$(git rev-parse HEAD)"
echo "Local HEAD: $LOCAL_HEAD"

DEPLOY_ID=$(curl -s -X POST "https://api.render.com/v1/services/$SERVICE_ID/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")
echo "Deploy: $DEPLOY_ID"

STATUS=""
for i in $(seq 1 60); do
  RES=$(curl -s "https://api.render.com/v1/services/$SERVICE_ID/deploys/$DEPLOY_ID" -H "Authorization: Bearer $RENDER_API_KEY")
  STATUS=$(echo "$RES" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).status))")
  echo "[$i] $STATUS"
  case "$STATUS" in
    live) break ;;
    build_failed|update_failed|canceled|deactivated)
      echo "ERROR: deploy ended in status '$STATUS'." >&2
      exit 1
      ;;
  esac
  sleep 10
done

if [ "$STATUS" != "live" ]; then
  echo "ERROR: deploy did not reach 'live' within the wait window (last status: $STATUS)." >&2
  exit 1
fi

DEPLOYED_COMMIT=$(curl -s "https://api.render.com/v1/services/$SERVICE_ID/deploys/$DEPLOY_ID" -H "Authorization: Bearer $RENDER_API_KEY" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.commit&&j.commit.id)})")

if [ "$DEPLOYED_COMMIT" != "$LOCAL_HEAD" ]; then
  echo "ERROR: Render deployed commit $DEPLOYED_COMMIT, but local HEAD is $LOCAL_HEAD." >&2
  echo "The push above may not have reached the branch Render builds from — check manually." >&2
  exit 1
fi

echo "Live and verified: backend is running commit $DEPLOYED_COMMIT"
