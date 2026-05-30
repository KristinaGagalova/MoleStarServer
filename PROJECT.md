# MolStar Remote Server Project

**Goal:** Host a MolStar molecular visualization platform on a central server. Clients worldwide connect via browser, authenticate with username/password, and use MolStar as if it were running locally - while all computation and file storage happen server-side.

---

## Architecture Overview

    Client (any OS, any browser)
            |
            | HTTPS (443) - self-signed certificate
            v
       [ Nginx 1.18 ]  <-- SSL termination, static files, reverse proxy
            |
            |-- /api/*  -->  [ Auth & API Service ]  Node.js 22 + Express 5
            |                        |
            |                   [ SQLite DB ]  better-sqlite3 12.10.0
            |                        |
            |                   [ /mnt/MolStar/db/molstar.db ]
            |
            |-- /*      -->  [ MolStar Static Viewer ]
                             /mnt/MolStar/server/molstar-app/dist/
                             (molstar 5.9.0 pre-built viewer + custom auth wrapper)

### Components

| Component         | Technology                   | Purpose                                       |
|-------------------|------------------------------|-----------------------------------------------|
| Reverse proxy     | Nginx 1.18 (apt)             | TLS self-signed, routing, static file serving |
| Auth/API backend  | Node.js 22 + Express 5.2.1   | Login, JWT, user mgmt, file API, session API  |
| Database          | SQLite via better-sqlite3    | Users, hashed passwords, file refs, sessions  |
| MolStar frontend  | molstar 5.9.0 (pre-built)    | Full molecular viewer (no build step needed)  |
| Auth wrapper      | Custom index.html + JS       | Login modal, JWT check, file panel overlay    |
| File storage      | Filesystem per user          | /mnt/MolStar/data/users/<username>/files/     |
| Process manager   | PM2 7.0.1                    | Keep API alive, auto-restart on boot          |

---

## Decisions Log

| # | Topic            | Decision                                                                      |
|---|------------------|-------------------------------------------------------------------------------|
| 1 | SSL              | Self-signed certificate (openssl); Let's Encrypt upgrade when domain is ready |
| 2 | Session saving   | Manual save only; user clicks Save button to persist session state            |
| 3 | Initial users    | One user only: AdminMolstar / MolstarAdmin (admin role)                       |
| 4 | Node.js version  | Node 22 LTS (v22.22.2) - required by molstar 5.9.0 (engines: >=22.0.0)       |
| 5 | MolStar approach | Use molstar 5.9.0 pre-built viewer - no webpack build step needed             |
| 6 | Upload limit     | 500 MB per file (configurable in nginx and multer)                            |

---

## User Authentication

- Passwords stored as **bcrypt** hashes (cost factor 12) - bcrypt 6.0.0
- Sessions use **JWT** (httpOnly cookies, 24h expiry) - jsonwebtoken 9.0.3
- Each user has an isolated workspace directory created on first login
- Role field: 'admin' or 'user'

### Initial Users

| Username      | Password     | Role  |
|---------------|--------------|-------|
| AdminMolstar  | MolstarAdmin | admin |

---

## File and Session Model

- Supported formats: .pdb .cif .mmcif .mol2 .sdf .xyz .ply .dcd .bcif .ent .gro
- Files stored at: /mnt/MolStar/data/users/<username>/files/<uuid>_<original-name>
- File metadata (uuid, original name, size, uploaded_at) stored in SQLite
- Session state: MolStar snapshot JSON saved per user in SQLite
- Session saved only when user clicks Save button; restored on next login

---

## API Endpoints

| Method | Path                    | Auth     | Description                               |
|--------|-------------------------|----------|-------------------------------------------|
| POST   | /api/auth/login         | none     | Authenticate, set JWT httpOnly cookie     |
| POST   | /api/auth/logout        | required | Clear session cookie                      |
| GET    | /api/auth/me            | required | Return current user info                  |
| GET    | /api/files              | required | List user uploaded files (metadata only)  |
| POST   | /api/files/upload       | required | Upload molecular file (multipart)         |
| GET    | /api/files/:id          | required | Download/stream file content to viewer    |
| DELETE | /api/files/:id          | required | Delete a file                             |
| GET    | /api/session            | required | Load user saved MolStar session JSON      |
| PUT    | /api/session            | required | Save user MolStar session JSON (manual)   |
| GET    | /api/admin/users        | admin    | List all users                            |
| POST   | /api/admin/users        | admin    | Create a new user                         |
| DELETE | /api/admin/users/:id    | admin    | Delete a user                             |

---

## Client Usage

Clients need **only a modern web browser** (Chrome 80+, Firefox 80+, Edge 80+, Safari 14+).
No installation. Steps:
1. Open browser
2. Navigate to https://146.118.121.141 (accept self-signed cert warning once)
3. Log in with username and password
4. MolStar viewer loads; use "My Files" panel to upload and open molecular files
5. Click Save Session to persist camera/structure state
6. On next login, last saved session is restored automatically

---

## Directory Structure (server)

    /mnt/MolStar/
    |-- PROJECT.md
    |-- server/
    |   |-- auth/                       # Node.js API service
    |   |   |-- src/
    |   |   |   |-- index.js            # Express app entry point
    |   |   |   |-- db.js               # SQLite init, schema, seed AdminMolstar
    |   |   |   |-- middleware.js       # JWT cookie verification
    |   |   |   `-- routes/
    |   |   |       |-- auth.js         # POST /login, POST /logout, GET /me
    |   |   |       |-- files.js        # GET /, POST /upload, GET /:id, DELETE /:id
    |   |   |       |-- session.js      # GET /, PUT /
    |   |   |       `-- admin.js        # GET /users, POST /users, DELETE /users/:id
    |   |   |-- package.json
    |   |   `-- .env                    # JWT_SECRET, PORT, DB_PATH, DATA_PATH
    |   `-- molstar-app/
    |       |-- package.json
    |       `-- dist/                   # Served by Nginx as static root
    |           |-- index.html          # Custom auth-aware wrapper (our own)
    |           |-- molstar.js          # Copied from molstar@5.9.0 build/viewer/
    |           |-- molstar.css         # Copied from molstar@5.9.0 build/viewer/
    |           |-- favicon.ico         # Copied from molstar@5.9.0 build/viewer/
    |           `-- images/             # Copied from molstar@5.9.0 build/viewer/images/
    |-- nginx/
    |   |-- molstar.conf                # Nginx site config
    |   `-- certs/
    |       |-- molstar.crt             # Self-signed certificate (365 days)
    |       `-- molstar.key             # Private key (chmod 600)
    |-- data/
    |   `-- users/                      # Per-user file storage
    |       `-- AdminMolstar/
    |           `-- files/
    |-- db/
    |   `-- molstar.db                  # SQLite database (auto-created on first run)
    `-- scripts/
        |-- install.sh                  # Full automated install script
        `-- backup.sh                   # Backup db + user data

---

## Exact Package Versions (pinned)

| Package             | Version   | Source     | Notes                                     |
|---------------------|-----------|------------|-------------------------------------------|
| Node.js             | 22.22.2   | NodeSource | Required by molstar (engines: >=22.0.0)   |
| npm                 | 10.x      | bundled    | Bundled with Node 22                      |
| Nginx               | 1.18.0    | apt        | Ubuntu 22.04 jammy repo                   |
| PM2                 | 7.0.1     | npm -g     | Process manager                           |
| molstar             | 5.9.0     | npm        | 73MB unpacked; pre-built viewer included  |
| express             | 5.2.1     | npm        | Latest stable (Express 5)                 |
| better-sqlite3      | 12.10.0   | npm        | Explicit Node 22 support in engines field |
| bcrypt              | 6.0.0     | npm        | Password hashing, cost factor 12          |
| jsonwebtoken        | 9.0.3     | npm        | JWT sessions, httpOnly cookies            |
| multer              | 2.1.1     | npm        | Multipart file upload handling            |
| dotenv              | latest    | npm        | .env config loading                       |
| cors                | latest    | npm        | CORS headers for API                      |
| build-essential     | 12.9      | apt        | GCC/g++ for better-sqlite3 native build   |
| libsqlite3-dev      | 3.37.2    | apt        | SQLite headers for better-sqlite3 build   |

---

## DRY RUN RESULTS (2026-05-30)

All checks performed live against the server before installation.

### Server Environment

| Check                   | Result                                      | Status |
|-------------------------|---------------------------------------------|--------|
| OS                      | Ubuntu 22.04.5 LTS (Jammy Jellyfish)        | OK     |
| Kernel                  | Linux 5.15.0-177-generic x86_64             | OK     |
| CPU cores               | 32 vCPUs                                    | OK     |
| RAM                     | 125 GB total, 123 GB available              | OK     |
| Disk (/mnt)             | 3.4 TB total, 3.1 TB available              | OK     |
| /mnt/MolStar writable   | Write test passed                           | OK     |
| OpenSSL                 | 3.0.2 (supports -addext SAN flag)           | OK     |
| curl / wget             | curl 7.81.0, wget 1.21.2 available          | OK     |
| git                     | 2.34.1 available                            | OK     |
| python3                 | 3.10.12 (required by node-gyp)              | OK     |
| Ports 80/443/3001       | None in use (clean slate)                   | OK     |
| Node.js pre-installed   | Not installed                               | OK     |
| Nginx pre-installed     | Not installed                               | OK     |
| Existing services       | No conflicts with required ports            | OK     |
| Docker                  | Installed (snap) - no conflict              | OK     |

### Package Availability Checks

| Check                              | Result                                    | Status |
|------------------------------------|-------------------------------------------|--------|
| NodeSource GPG key fetch           | Successful                                | OK     |
| NodeSource GPG --batch --yes flag  | Required for non-interactive SSH          | NOTED  |
| Node 22 from NodeSource            | v22.22.2-1nodesource1 available           | OK     |
| Node 20 from NodeSource            | v20.20.2 available but EOL April 2026     | SKIP   |
| build-essential via apt            | 12.9ubuntu3 available                     | OK     |
| libsqlite3-dev via apt             | 3.37.2 available                          | OK     |
| nginx via apt                      | 1.18.0 available (sufficient)             | OK     |
| molstar@5.9.0 npm registry         | Available, 73MB unpacked                  | OK     |
| molstar engines field              | "node": ">=22.0.0" confirmed              | OK     |
| better-sqlite3@12.10.0 engines     | "20.x or 22.x or 23.x or 24.x ..."       | OK     |
| bcrypt@6.0.0 engines               | ">= 18" - Node 22 OK                      | OK     |
| express@5.2.1 npm registry         | Available (Express 5 now latest stable)   | OK     |
| jsonwebtoken@9.0.3 npm registry    | Available                                 | OK     |
| multer@2.1.1 npm registry          | Available                                 | OK     |
| pm2@7.0.1 npm registry             | Available                                 | OK     |

### Pre-built Viewer Files Check (no build step needed)

| File in molstar@5.9.0 npm package  | Status  |
|------------------------------------|---------|
| build/viewer/molstar.js            | Present |
| build/viewer/molstar.css           | Present |
| build/viewer/index.html            | Present |
| build/viewer/favicon.ico           | Present |
| build/viewer/images/               | Present |

### SSL Certificate Test

| Check                           | Result                                          | Status |
|---------------------------------|-------------------------------------------------|--------|
| openssl req -x509 generation    | Completed successfully                          | OK     |
| -addext subjectAltName support  | Supported by OpenSSL 3.0.2                      | OK     |
| SAN=IP:146.118.121.141          | Required by Chrome 58+ to avoid hard block      | OK     |

### Known Issues Found and Solutions

| Issue Found                                | Solution Applied                                    |
|--------------------------------------------|-----------------------------------------------------|
| apt default Node.js is v12 (too old)       | Install Node 22 via NodeSource repository           |
| GPG dearmor fails in non-interactive SSH   | Use: gpg --batch --yes --dearmor                    |
| molstar requires Node >=22.0.0             | Confirmed: using Node 22.22.2 (not Node 20)         |
| build-essential not installed              | Install via apt before npm install better-sqlite3   |
| Self-signed cert: Chrome SAN required      | Using -addext "subjectAltName=IP:146.118.121.141"   |
| No swap configured                         | 123GB free RAM; no swap needed for this workload    |
| Express latest is now v5 (not v4)          | Using Express 5.2.1 (stable, backward compatible)   |

---

## INSTALLATION STEPS (verified, ready to execute)

### Step 1 - System update and build tools

    sudo apt-get update && sudo apt-get upgrade -y
    sudo apt-get install -y build-essential libsqlite3-dev python3 curl gnupg

### Step 2 - Install Node.js 22 LTS via NodeSource

    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/nodesource.key
    sudo mkdir -p /etc/apt/keyrings
    sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg /tmp/nodesource.key
    rm /tmp/nodesource.key
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
    sudo apt-get update
    sudo apt-get install -y nodejs
    node --version   # expect: v22.22.2
    npm --version    # expect: 10.x.x

### Step 3 - Install Nginx

    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    nginx -v         # expect: nginx/1.18.0

### Step 4 - Install PM2 globally

    sudo npm install -g pm2@7.0.1
    pm2 --version    # expect: 7.0.1

### Step 5 - Create directory structure

    mkdir -p /mnt/MolStar/server/auth/src/routes
    mkdir -p /mnt/MolStar/server/molstar-app/dist/images
    mkdir -p /mnt/MolStar/nginx/certs
    mkdir -p /mnt/MolStar/data/users/AdminMolstar/files
    mkdir -p /mnt/MolStar/db
    mkdir -p /mnt/MolStar/scripts

### Step 6 - Generate self-signed SSL certificate

    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /mnt/MolStar/nginx/certs/molstar.key \
      -out /mnt/MolStar/nginx/certs/molstar.crt \
      -subj "/C=AU/ST=Server/L=Server/O=MolStar/CN=146.118.121.141" \
      -addext "subjectAltName=IP:146.118.121.141"
    sudo chmod 600 /mnt/MolStar/nginx/certs/molstar.key
    sudo chmod 644 /mnt/MolStar/nginx/certs/molstar.crt
    openssl x509 -in /mnt/MolStar/nginx/certs/molstar.crt -text -noout | grep -A1 "Subject Alternative"

### Step 7 - Install molstar and copy pre-built viewer files

    cd /mnt/MolStar/server/molstar-app
    npm init -y
    npm install molstar@5.9.0
    cp node_modules/molstar/build/viewer/molstar.js   dist/
    cp node_modules/molstar/build/viewer/molstar.css  dist/
    cp node_modules/molstar/build/viewer/favicon.ico  dist/
    cp -r node_modules/molstar/build/viewer/images/   dist/images/

### Step 8 - Write custom index.html

    # Written to /mnt/MolStar/server/molstar-app/dist/index.html by install.sh
    # Behaviour:
    #   1. Page load: GET /api/auth/me
    #   2. If 401 -> show login modal (full screen)
    #   3. If 200 -> hide modal, init MolStar viewer, load "My Files" panel
    #   4. Login: POST /api/auth/login -> success -> reload page
    #   5. My Files panel: GET /api/files -> click to load via viewer URL
    #   6. Upload button: POST /api/files/upload (multipart/form-data)
    #   7. Save Session button: viewer.getSnapshot() -> PUT /api/session
    #   8. Logout button: POST /api/auth/logout -> reload page

### Step 9 - Set up auth/API backend

    cd /mnt/MolStar/server/auth
    npm init -y
    npm install express@5.2.1 better-sqlite3@12.10.0 bcrypt@6.0.0 \
      jsonwebtoken@9.0.3 multer@2.1.1 cors dotenv

### Step 10 - Write backend source files (written by install.sh)

    # .env content:
    #   PORT=3001
    #   JWT_SECRET=<64-char hex generated with: openssl rand -hex 32>
    #   DB_PATH=/mnt/MolStar/db/molstar.db
    #   DATA_PATH=/mnt/MolStar/data/users
    #   UPLOAD_LIMIT_MB=500
    #
    # SQLite schema (db.js):
    #   users   : id, username, password_hash, role, created_at
    #   files   : id, user_id, filename, original_name, size, uploaded_at
    #   sessions: user_id (unique), snapshot_json, saved_at
    #
    # Seed (runs once if users table empty):
    #   AdminMolstar / MolstarAdmin / role: admin

### Step 11 - Configure and enable Nginx

    # Write /mnt/MolStar/nginx/molstar.conf:
    #   server { listen 80; return 301 https://$host$request_uri; }
    #   server {
    #     listen 443 ssl;
    #     ssl_certificate     /mnt/MolStar/nginx/certs/molstar.crt;
    #     ssl_certificate_key /mnt/MolStar/nginx/certs/molstar.key;
    #     ssl_protocols TLSv1.2 TLSv1.3;
    #     ssl_ciphers HIGH:!aNULL:!MD5;
    #     root /mnt/MolStar/server/molstar-app/dist;
    #     index index.html;
    #     client_max_body_size 500M;
    #     location /api/ {
    #       proxy_pass http://127.0.0.1:3001;
    #       proxy_http_version 1.1;
    #       proxy_set_header Host $host;
    #       proxy_set_header X-Real-IP $remote_addr;
    #       proxy_set_header X-Forwarded-Proto https;
    #       proxy_read_timeout 300s;
    #     }
    #     location / { try_files $uri $uri/ /index.html; }
    #   }
    sudo ln -sf /mnt/MolStar/nginx/molstar.conf /etc/nginx/sites-enabled/molstar
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx

### Step 12 - Start API service with PM2

    cd /mnt/MolStar/server/auth
    pm2 start src/index.js --name molstar-auth
    pm2 startup systemd -u ubuntu --hp /home/ubuntu
    # Run the exact sudo env PATH=... command pm2 outputs above
    pm2 save
    pm2 status   # expect: molstar-auth | online

### Step 13 - End-to-end tests (11 checks, automated in install.sh)

    curl -o /tmp/test.pdb "https://files.rcsb.org/download/1CRN.pdb"

    # T01: HTTP -> HTTPS redirect (expect 301)
    curl -k -I http://146.118.121.141 | grep -E "301|Location"

    # T02: Login correct credentials (expect 200 + ok:true)
    curl -k -c /tmp/tc.txt -X POST https://146.118.121.141/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"AdminMolstar","password":"MolstarAdmin"}'

    # T03: Auth check (expect 200 + username)
    curl -k -b /tmp/tc.txt https://146.118.121.141/api/auth/me

    # T04: Upload PDB (expect ok:true + file object)
    curl -k -b /tmp/tc.txt -X POST https://146.118.121.141/api/files/upload \
      -F "file=@/tmp/test.pdb"

    # T05: List files (expect array with 1 entry)
    curl -k -b /tmp/tc.txt https://146.118.121.141/api/files

    # T06: Save session (expect ok:true)
    curl -k -b /tmp/tc.txt -X PUT https://146.118.121.141/api/session \
      -H "Content-Type: application/json" -d '{"snapshot":{"version":1}}'

    # T07: Load session (expect snapshot back)
    curl -k -b /tmp/tc.txt https://146.118.121.141/api/session

    # T08: Wrong password (expect 401)
    curl -k -X POST https://146.118.121.141/api/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username":"AdminMolstar","password":"wrong"}'

    # T09: No auth cookie (expect 401)
    curl -k https://146.118.121.141/api/files

    # T10: Logout (expect ok:true)
    curl -k -b /tmp/tc.txt -X POST https://146.118.121.141/api/auth/logout

    # T11: Static viewer served (expect HTTP 200)
    curl -k -s -o /dev/null -w "%{http_code}" https://146.118.121.141/

    rm -f /tmp/tc.txt /tmp/test.pdb

---

## Status

- [x] Architecture designed
- [x] SSL decision: self-signed (SAN=IP for Chrome compatibility confirmed)
- [x] Session save decision: manual save via Save button
- [x] Initial users defined: AdminMolstar / MolstarAdmin
- [x] Node version: 22.22.2 LTS (required by molstar 5.9.0)
- [x] MolStar approach: pre-built viewer from npm package (no webpack build)
- [x] All package versions confirmed and pinned
- [x] Dry run completed on live server: 0 blockers found
- [x] Known issues documented with exact solutions
- [x] Installation steps written with exact verified commands
- [x] End-to-end test plan written (11 curl checks)
- [ ] Installation -- PENDING USER AUTHORIZATION
