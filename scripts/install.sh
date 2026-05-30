#!/usr/bin/env bash
# MolStar Server Installation Script
# Tested on Ubuntu 22.04 LTS with 32 vCPUs, 125GB RAM
# Run as: bash scripts/install.sh

set -euo pipefail

MOLSTAR_DIR="${MOLSTAR_DIR:-/mnt/MolStar}"
SERVER_IP="${SERVER_IP:-$(curl -s ifconfig.me)}"

echo "=== MolStar Server Installation ==="
echo "Install dir: $MOLSTAR_DIR"
echo "Server IP:   $SERVER_IP"

# Step 1 — System packages
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y build-essential libsqlite3-dev python3 curl gnupg nginx

# Step 2 — Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.key
sudo mkdir -p /etc/apt/keyrings
sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource.key
rm /tmp/nodesource.key
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update -y && sudo apt-get install -y nodejs
echo "Node: $(node --version)"

# Step 3 — PM2
sudo npm install -g pm2@7.0.1
echo "PM2: $(pm2 --version)"

# Step 4 — Directory structure
sudo mkdir -p "$MOLSTAR_DIR/server/auth/src/routes"
sudo mkdir -p "$MOLSTAR_DIR/server/molstar-app/dist/images"
sudo mkdir -p "$MOLSTAR_DIR/nginx/certs"
sudo mkdir -p "$MOLSTAR_DIR/data/users"
sudo mkdir -p "$MOLSTAR_DIR/db"
sudo mkdir -p "$MOLSTAR_DIR/scripts"
sudo chown -R "$(whoami):$(whoami)" "$MOLSTAR_DIR"

# Step 5 — Copy source files from this repo
cp -r server/auth/src/         "$MOLSTAR_DIR/server/auth/"
cp    server/auth/package.json  "$MOLSTAR_DIR/server/auth/"
cp    server/molstar-app/index.html "$MOLSTAR_DIR/server/molstar-app/dist/"

# Step 6 — SSL certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$MOLSTAR_DIR/nginx/certs/molstar.key" \
  -out    "$MOLSTAR_DIR/nginx/certs/molstar.crt" \
  -subj "/C=AU/ST=Server/L=Server/O=MolStar/CN=$SERVER_IP" \
  -addext "subjectAltName=IP:$SERVER_IP"
sudo chmod 600 "$MOLSTAR_DIR/nginx/certs/molstar.key"
sudo chmod 644 "$MOLSTAR_DIR/nginx/certs/molstar.crt"

# Step 7 — Install molstar npm package and copy viewer files
cd "$MOLSTAR_DIR/server/molstar-app"
npm install molstar@5.9.0
cp node_modules/molstar/build/viewer/molstar.js  dist/
cp node_modules/molstar/build/viewer/molstar.css dist/
cp node_modules/molstar/build/viewer/favicon.ico dist/
cp -r node_modules/molstar/build/viewer/images/  dist/images/

# Step 8 — Install auth backend dependencies
cd "$MOLSTAR_DIR/server/auth"
npm install express@5.2.1 better-sqlite3@12.10.0 bcrypt@6.0.0 \
  jsonwebtoken@9.0.3 multer@2.1.1 cors dotenv cookie-parser

# Step 9 — Generate .env
JWT_SECRET=$(openssl rand -hex 32)
cat > "$MOLSTAR_DIR/server/auth/.env" << ENVEOF
PORT=3001
JWT_SECRET=$JWT_SECRET
DB_PATH=$MOLSTAR_DIR/db/molstar.db
DATA_PATH=$MOLSTAR_DIR/data/users
UPLOAD_LIMIT_MB=500
ADMIN_USERNAME=AdminMolstar
ADMIN_INITIAL_PASSWORD=$(openssl rand -base64 16)
ENVEOF
echo ".env generated (JWT_SECRET and ADMIN_INITIAL_PASSWORD are randomised)"
echo "Edit $MOLSTAR_DIR/server/auth/.env to set your desired ADMIN_INITIAL_PASSWORD before starting"

# Step 10 — Nginx config
cp nginx/molstar.conf /etc/nginx/sites-available/molstar
sudo ln -sf /etc/nginx/sites-available/molstar /etc/nginx/sites-enabled/molstar
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

# Step 11 — Start with PM2
cd "$MOLSTAR_DIR/server/auth"
pm2 delete molstar-auth 2>/dev/null || true
pm2 start src/index.js --name molstar-auth
STARTUP_CMD=$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>&1 | grep "sudo env PATH")
eval "$STARTUP_CMD"
pm2 save

echo ""
echo "=== Installation complete ==="
echo "Access at: https://$SERVER_IP"
echo "Login with: ADMIN_USERNAME and ADMIN_INITIAL_PASSWORD from .env"
echo "IMPORTANT: Open ports 80 and 443 in your cloud security group."
