# MolStar Server

A self-hosted [MolStar](https://molstar.org/) molecular visualization platform. Clients connect via browser with username/password authentication. All computation and storage happen server-side.

## Architecture

```
Browser (HTTPS 443)
    └─ Nginx 1.18 ── SSL termination, static files, reverse proxy
           ├─ /api/* ── Node.js 22 + Express 5 (Auth & API)
           │               └─ SQLite (users, files, sessions)
           └─ /*     ── MolStar 5.9.0 pre-built viewer + auth wrapper
```

## Prerequisites

- Ubuntu 22.04 LTS
- At minimum 4 vCPUs, 8 GB RAM, 100 GB disk
- Root/sudo access
- Ports 80 and 443 open in your cloud security group

## Quick Install

```bash
git clone https://github.com/KristinaGagalova/MoleStarServer.git
cd MoleStarServer
cp .env.example server/auth/.env
# Edit server/auth/.env — set ADMIN_INITIAL_PASSWORD and JWT_SECRET
nano server/auth/.env
bash scripts/install.sh
```

## Configuration

Copy `.env.example` to `server/auth/.env` and set:

| Variable | Description |
|---|---|
| `JWT_SECRET` | 64-char hex secret — generate with `openssl rand -hex 32` |
| `ADMIN_USERNAME` | Admin username (default: AdminMolstar) |
| `ADMIN_INITIAL_PASSWORD` | Admin password for first login — change after first use |
| `DB_PATH` | SQLite database path |
| `DATA_PATH` | User file storage root |
| `UPLOAD_LIMIT_MB` | Max upload size in MB (default: 500) |

**Never commit `.env` to git.** It is in `.gitignore`.

## Supported File Formats

`.pdb` `.cif` `.mmcif` `.mol2` `.sdf` `.xyz` `.ply` `.dcd` `.bcif` `.ent` `.gro`

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | none | Authenticate, set JWT cookie |
| POST | /api/auth/logout | required | Clear session |
| GET | /api/auth/me | required | Current user info |
| GET | /api/files | required | List uploaded files |
| POST | /api/files/upload | required | Upload molecular file |
| GET | /api/files/:id | required | Download/stream file |
| DELETE | /api/files/:id | required | Delete file |
| GET | /api/session | required | Load saved MolStar session |
| PUT | /api/session | required | Save MolStar session |
| GET | /api/admin/users | admin | List all users |
| POST | /api/admin/users | admin | Create user |
| DELETE | /api/admin/users/:id | admin | Delete user |

## Security Notes

- Passwords stored as bcrypt hashes (cost factor 12)
- Sessions use JWT in httpOnly cookies (24h expiry)
- Change default admin password immediately after first login
- SSL: self-signed cert by default — upgrade to Let's Encrypt when you have a domain
- Port 3001 (API) binds to 127.0.0.1 only — not exposed externally

## Stack

| Component | Version |
|---|---|
| Node.js | 22.22.2 |
| Express | 5.2.1 |
| better-sqlite3 | 12.10.0 |
| bcrypt | 6.0.0 |
| jsonwebtoken | 9.0.3 |
| multer | 2.1.1 |
| molstar | 5.9.0 |
| Nginx | 1.18.0 |
| PM2 | 7.0.1 |

## Backup

```bash
bash scripts/backup.sh
```

Backs up `db/molstar.db`, `data/users/`, and `server/auth/.env` to a timestamped archive.
