#!/usr/bin/env bash
# EU Jobs API on the Ubuntu VPS behind nginx, at https://www.eu-jobs.kyptronix.net.
# Run as root: sudo bash setup-vps.sh   (safe to run again: it pulls the latest main and restarts the API)
#
# Put next to this script before running (each is used once, then deleted):
#   .env.production   the production API env (from server/.env.production on the dev machine) -> /etc/eujobs/api.env
#   uploads.tar.gz    the uploaded files the shared database points to (first run only)
#
# Touches only its own things: /opt/eujobs (code + its own Node 24), /etc/eujobs, the UPLOAD_DIR from the env,
# the systemd unit eujobs-api, and /etc/nginx/conf.d/eujobs-api.conf. Other sites and the system Node are left alone.
set -euo pipefail

DOMAINS=(www.eu-jobs.kyptronix.net eu-jobs.kyptronix.net)
REPO=https://github.com/Tushankar/eujobs-frontend.git
BRANCH=main
APP_DIR=/opt/eujobs
NODE_DIR=$APP_DIR/node
ENV_FILE=/etc/eujobs/api.env
SERVICE=eujobs-api
NGINX_CONF=/etc/nginx/conf.d/eujobs-api.conf
HERE=$(cd "$(dirname "$0")" && pwd)

step() { echo; echo "== $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run as root (sudo bash $0)"

step "Packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl xz-utils nginx certbot python3-certbot-nginx >/dev/null

step "Production env"
mkdir -p /etc/eujobs
if [ -f "$HERE/.env.production" ]; then
  install -m 640 "$HERE/.env.production" "$ENV_FILE"
  rm -f "$HERE/.env.production"
  echo "installed $ENV_FILE"
fi
[ -f "$ENV_FILE" ] || fail "$ENV_FILE missing: copy server/.env.production next to this script and run again"
env_value() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }
PORT=$(env_value PORT)
UPLOAD_DIR=$(env_value UPLOAD_DIR)
[ -n "$PORT" ] && [ -n "$UPLOAD_DIR" ] || fail "PORT and UPLOAD_DIR must be set in $ENV_FILE"

step "Node 24 (private to $APP_DIR)"
case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64) ARCH=arm64 ;; *) fail "unsupported CPU $(uname -m)" ;; esac
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -p 'process.versions.node.split(".")[0]')" != 24 ]; then
  TARBALL=$(curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt | grep -o "node-v[0-9.]*-linux-$ARCH.tar.xz" | head -1)
  mkdir -p "$NODE_DIR"
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/$TARBALL" | tar -xJ -C "$NODE_DIR" --strip-components=1
fi
export PATH=$NODE_DIR/bin:$PATH
echo "node $(node -v), npm $(npm -v)"

step "Code ($REPO, $BRANCH)"
if [ -d "$APP_DIR/src/.git" ]; then
  git -C "$APP_DIR/src" fetch -q origin "$BRANCH"
  git -C "$APP_DIR/src" reset -q --hard "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "$REPO" "$APP_DIR/src"
fi
echo "at $(git -C "$APP_DIR/src" log -1 --format='%h %s')"
cd "$APP_DIR/src/server"
npm ci --omit=dev --no-audit --no-fund

step "User and uploads"
id eujobs >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin eujobs
mkdir -p "$UPLOAD_DIR"
if [ -f "$HERE/uploads.tar.gz" ]; then
  tar -xzf "$HERE/uploads.tar.gz" -C "$UPLOAD_DIR"
  rm -f "$HERE/uploads.tar.gz"
  echo "uploads extracted into $UPLOAD_DIR"
fi
chown -R eujobs:eujobs "$UPLOAD_DIR"
chown root:eujobs "$ENV_FILE"
chmod 640 "$ENV_FILE"

step "Service $SERVICE"
cat >/etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=EU Jobs API
After=network-online.target
Wants=network-online.target

[Service]
User=eujobs
WorkingDirectory=$APP_DIR/src/server
ExecStart=$NODE_DIR/bin/node --env-file=$ENV_FILE server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q $SERVICE
systemctl stop $SERVICE 2>/dev/null || true
if ss -ltnH "sport = :$PORT" | grep -q .; then
  fail "port $PORT is already used by another program (ss -ltnp 'sport = :$PORT'); set a free PORT in $ENV_FILE and run again"
fi
systemctl start $SERVICE
echo -n "waiting for the API (startup takes ~20 s)"
for _ in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:$PORT/api/v1/health" >/dev/null; then echo " up"; break; fi
  echo -n "."; sleep 2
done
curl -fs "http://127.0.0.1:$PORT/api/v1/health" >/dev/null || { journalctl -u $SERVICE -n 40 --no-pager; fail "API did not become healthy"; }

step "nginx"
if [ ! -f "$NGINX_CONF" ]; then
  cat >"$NGINX_CONF" <<EOF
# EU Jobs API (written by setup-vps.sh; certbot adds the HTTPS part).
map \$http_upgrade \$eujobs_connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAINS[*]};

    # Lesson videos go up to 500 MB.
    client_max_body_size 510m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # The API trusts this header only from a local Cloudflare tunnel; never pass a client's value through.
        proxy_set_header CF-Connecting-IP "";
        # Interview call signaling WebSocket.
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$eujobs_connection_upgrade;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_request_buffering off;
    }
}
EOF
  echo "wrote $NGINX_CONF"
fi
nginx -t
systemctl reload nginx

step "HTTPS certificate"
if [ ! -d "/etc/letsencrypt/live/${DOMAINS[0]}" ]; then
  certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    $(printf -- '-d %s ' "${DOMAINS[@]}")
else
  echo "certificate exists (certbot renews it automatically)"
fi

step "Check"
curl -fsS "https://${DOMAINS[0]}/api/v1/health" && echo
echo "Done: https://${DOMAINS[0]}  (logs: journalctl -u $SERVICE -f)"
