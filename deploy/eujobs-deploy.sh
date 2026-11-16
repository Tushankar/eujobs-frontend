#!/usr/bin/env bash
# Updates the EU Jobs API on the VPS to the latest main: git pull, npm ci, restart, health check.
# Installed once as /usr/local/bin/eujobs-deploy (root, 755). The GitHub Action's SSH key may run only this.
# The installed copy is NOT replaced by pushes: after changing this file, install it on the server again by hand.
set -euo pipefail
exec 9>/run/eujobs-deploy.lock
flock 9   # one deploy at a time

export PATH=/opt/eujobs/node/bin:$PATH
PORT=$(grep -E '^PORT=' /etc/eujobs/api.env | tail -1 | cut -d= -f2-)

cd /opt/eujobs/src
git fetch -q origin main
git reset -q --hard origin/main
echo "deploying $(git log -1 --format='%h %s')"

cd server
npm ci --omit=dev --no-audit --no-fund
systemctl restart eujobs-api

for _ in $(seq 1 45); do
  if curl -fs "http://127.0.0.1:$PORT/api/v1/health"; then echo; echo "API healthy"; exit 0; fi
  sleep 2
done
journalctl -u eujobs-api -n 40 --no-pager
echo "API did not become healthy" >&2
exit 1
