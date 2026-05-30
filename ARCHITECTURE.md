# MolStar Server — Architecture & Flow

> **Live instance:** `https://146.118.121.141` (accept self-signed cert)  
> **Stack:** Nginx 1.18 · Node.js 22 · Express 5 · SQLite · MolStar 5.9.0 · PM2

---

## 1 · System Architecture

```mermaid
flowchart TB
    Browser(["🌐 Browser\nChrome · Firefox · Edge · Safari"])

    subgraph SERVER ["☁️  Ubuntu 22.04 — 146.118.121.141  |  32 vCPU · 125 GB RAM · 3.4 TB disk"]

        subgraph NGINX ["🔒 Nginx 1.18"]
            P80["Port 80 HTTP"]
            P443["Port 443 HTTPS\nTLS 1.2 / 1.3 · Self-signed cert (SAN=IP)"]
            STATIC["Static file root\n/dist/  index.html · molstar.js · molstar.css"]
            PROXY["Reverse proxy  /api/* → 127.0.0.1:3001\n500 MB max body · 300 s timeout"]
        end

        subgraph PM2 ["⚙️  PM2 7.0.1 — molstar-auth (auto-restart on boot)"]
            subgraph API ["Node.js 22 + Express 5 — Port 3001 localhost only"]
                MW["JWT Middleware\nhttpOnly cookie · 24 h · bcrypt pw hashing"]
                RA["/api/auth\nPOST /login  POST /logout  GET /me"]
                RF["/api/files\nGET /  POST /upload  GET /:id  DELETE /:id"]
                RS["/api/session\nGET /  PUT /"]
                RX["/api/admin\nGET /users  POST /users  DELETE /users/:id"]
            end
        end

        subgraph STORE ["💾 Storage"]
            DB[("SQLite\nbetter-sqlite3\n/db/molstar.db")]
            FS["📁 Filesystem\n/data/users/{username}/files/\n{uuid}.pdb · .cif · .mmcif · .mol2 …"]
        end

        FW["🛡️ UFW Firewall\nports 80 · 443 open  |  3001 localhost only"]
    end

    Browser <-->|"HTTPS :443"| P443
    P80 -->|"301 redirect"| P443
    P443 --> STATIC
    P443 --> PROXY
    PROXY --> MW
    MW --> RA & RF & RS & RX
    RA --> DB
    RF --> DB
    RF <--> FS
    RS --> DB
    RX --> DB
    FW -. protects .-> API
```

---

## 2 · Authentication & Session Startup Flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Nginx :443
    participant A as Express API :3001
    participant D as SQLite DB

    Note over B,D: Page load — check existing session
    B->>N: GET / (HTTPS)
    N-->>B: 200 index.html + molstar.js

    B->>N: GET /api/auth/me (no cookie yet)
    N->>A: proxy → GET /api/auth/me
    A-->>N: 401 Not authenticated
    N-->>B: 401 → show login modal

    Note over B,D: User submits credentials
    B->>N: POST /api/auth/login {username, password}
    N->>A: proxy → POST /api/auth/login
    A->>D: SELECT * FROM users WHERE username = ?
    D-->>A: user row with password_hash
    A->>A: bcrypt.compare(password, hash)
    A-->>N: 200  Set-Cookie: token=JWT; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
    N-->>B: 200 + JWT cookie (24 h) → hide modal, show viewer

    Note over B,D: App initialises — restore last saved session
    B->>N: GET /api/session (JWT cookie attached)
    N->>A: proxy → GET /api/session
    A->>A: JWT middleware — verify cookie
    A->>D: SELECT snapshot_json FROM sessions WHERE user_id = ?
    D-->>A: snapshot JSON or null
    A-->>N: 200 {snapshot} or null
    N-->>B: viewer.setSnapshot(data) — session restored
```

---

## 3 · File Upload & Visualisation Flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Nginx :443
    participant A as Express API :3001
    participant FS as Filesystem
    participant D as SQLite DB
    participant M as MolStar Viewer

    Note over B,M: Upload a structure file
    B->>N: POST /api/files/upload  multipart/form-data  (≤ 500 MB)
    N->>A: proxy (500 MB body limit · 300 s timeout)
    A->>A: JWT middleware — verify cookie
    A->>A: multer: validate extension (.pdb .cif .mmcif .mol2 .sdf .xyz .ply .dcd .bcif .ent .gro)
    A->>FS: write /data/users/{user}/files/{uuid}.{ext}
    A->>D: INSERT INTO files (id, user_id, filename, original_name, size)
    A-->>N: 200 {ok:true, file:{id, original_name, size}}
    N-->>B: file appears in side panel

    Note over B,M: User clicks a file to visualise it
    B->>N: GET /api/files/:id  (JWT cookie)
    N->>A: proxy → GET /api/files/:id
    A->>D: SELECT * FROM files WHERE id=? AND user_id=?
    D-->>A: file row
    A->>FS: read /data/users/{user}/files/{uuid}.{ext}
    A-->>N: 200 binary stream
    N-->>B: file bytes streamed
    B->>M: viewer.loadStructureFromUrl('/api/files/:id', format, isBinary)
    M-->>B: 3-D structure rendered in viewport

    Note over B,M: Delete a file
    B->>N: DELETE /api/files/:id
    N->>A: proxy → DELETE /api/files/:id
    A->>D: SELECT + ownership check (user_id)
    A->>FS: fs.unlinkSync(path)
    A->>D: DELETE FROM files WHERE id=?
    A-->>N: 200 {ok:true}
    N-->>B: file removed from panel
```

---

## 4 · Session Save Flow

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant M as MolStar Viewer
    participant N as Nginx :443
    participant A as Express API :3001
    participant D as SQLite DB

    Note over B,D: User clicks "Save Session" button
    B->>M: viewer.plugin.state.getSnapshot()
    M-->>B: snapshot JSON (camera · loaded structures · representations)

    B->>N: PUT /api/session  {snapshot: {...}}  (JWT cookie)
    N->>A: proxy → PUT /api/session
    A->>A: JWT middleware — verify cookie
    A->>D: INSERT OR REPLACE INTO sessions (user_id, snapshot_json, saved_at)
    D-->>A: ok
    A-->>N: 200 {ok:true}
    N-->>B: status bar → "Session saved"
```

---

## 5 · Database Schema

```mermaid
erDiagram
    users {
        INTEGER  id            PK
        TEXT     username      UK
        TEXT     password_hash
        TEXT     role
        DATETIME created_at
    }
    files {
        TEXT     id            PK
        INTEGER  user_id       FK
        TEXT     filename
        TEXT     original_name
        INTEGER  size
        DATETIME uploaded_at
    }
    sessions {
        INTEGER  user_id       PK
        TEXT     snapshot_json
        DATETIME saved_at
    }

    users ||--o{ files    : owns
    users ||--o| sessions : has
```

---

## 6 · Directory Layout

```
/mnt/MolStar/
├── server/
│   ├── auth/                        # Node.js API service (PM2: molstar-auth)
│   │   ├── src/
│   │   │   ├── index.js             # Express entry — PORT 3001
│   │   │   ├── db.js                # SQLite init, schema, seed AdminMolstar
│   │   │   ├── middleware.js        # requireAuth · requireAdmin (JWT cookie)
│   │   │   └── routes/
│   │   │       ├── auth.js          # POST /login  POST /logout  GET /me
│   │   │       ├── files.js         # GET /  POST /upload  GET /:id  DELETE /:id
│   │   │       ├── session.js       # GET /  PUT /
│   │   │       └── admin.js         # GET /users  POST /users  DELETE /users/:id
│   │   ├── package.json
│   │   └── .env                     # JWT_SECRET · PORT · DB_PATH · DATA_PATH
│   └── molstar-app/
│       └── dist/                    # Served by Nginx as static root
│           ├── index.html           # Auth wrapper (login modal + MolStar init)
│           ├── molstar.js           # MolStar 5.9.0 pre-built viewer bundle
│           ├── molstar.css
│           └── favicon.ico
├── nginx/
│   ├── molstar.conf                 # 80→443 redirect + HTTPS + proxy config
│   └── certs/
│       ├── molstar.crt              # Self-signed (SAN=IP, 365 days)
│       └── molstar.key
├── data/
│   └── users/
│       └── {username}/
│           └── files/               # Per-user uploaded structures
│               └── {uuid}.{ext}
├── db/
│   └── molstar.db                   # SQLite — users · files · sessions
└── scripts/
    ├── install.sh
    └── backup.sh
```

---

## 7 · API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | — | Authenticate, set JWT httpOnly cookie |
| `POST` | `/api/auth/logout` | user | Clear JWT cookie |
| `GET` | `/api/auth/me` | user | Return current user info |
| `GET` | `/api/files` | user | List uploaded files (metadata only) |
| `POST` | `/api/files/upload` | user | Upload structure file (multipart, ≤ 500 MB) |
| `GET` | `/api/files/:id` | user | Stream file content to viewer |
| `DELETE` | `/api/files/:id` | user | Delete a file |
| `GET` | `/api/session` | user | Load saved MolStar session snapshot |
| `PUT` | `/api/session` | user | Save MolStar session snapshot |
| `GET` | `/api/admin/users` | admin | List all users |
| `POST` | `/api/admin/users` | admin | Create a user |
| `DELETE` | `/api/admin/users/:id` | admin | Delete a user |

---

## 8 · Security Model

| Layer | Mechanism |
|-------|-----------|
| Transport | TLS 1.2/1.3 (self-signed, SAN=IP for Chrome compatibility) |
| Authentication | JWT in httpOnly + Secure + SameSite=Strict cookie (24 h) |
| Password storage | bcrypt, cost factor 12 |
| Authorisation | Middleware-enforced: `requireAuth` / `requireAdmin` |
| File isolation | Server-side ownership check (user_id) on every file request |
| Upload safety | Extension allowlist · multer · 500 MB hard limit |
| Network | UFW: only ports 80/443 open · API port 3001 localhost-only |
| CORS | Disabled (`origin: false`) — same-origin only |
