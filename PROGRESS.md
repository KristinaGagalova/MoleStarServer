# MolStar Installation Progress

Last updated: 2026-05-30 08:39 UTC

## Phases

| Phase | Steps | Status | Started | Completed |
|-------|-------|--------|---------|-----------|
| 1 | System setup (apt, Node 22, Nginx, PM2, dirs, SSL) | DONE | 08:41 UTC | 08:41 UTC |
| 2a | molstar npm install + copy viewer files | DONE | done | done |
| 2b | auth backend npm install | DONE | done | done |
| 3a | Write index.html (frontend auth wrapper) | DONE | done | done |
| 3b | Write backend source files | DONE | done | done |
| 4 | Nginx config + PM2 start + 11 end-to-end tests | DONE | done | done |
| 5 | Send email to kristina.gagalova@gmail.com | PENDING | - | - |

## Resume Instructions

If session was interrupted, check which phases say DONE above and skip them.
All installation commands are in /mnt/MolStar/PROJECT.md.

## Quick State Check

Run this to see what is installed:
  node --version 2>/dev/null && echo node_ok || echo node_missing
  nginx -v 2>/dev/null && echo nginx_ok || echo nginx_missing
  pm2 --version 2>/dev/null && echo pm2_ok || echo pm2_missing
  ls /mnt/MolStar/server/auth/src/index.js 2>/dev/null && echo backend_ok || echo backend_missing
  ls /mnt/MolStar/server/molstar-app/dist/molstar.js 2>/dev/null && echo molstar_ok || echo molstar_missing
  pm2 list 2>/dev/null | grep molstar-auth || echo pm2_not_started

## Firewall
UFW: ports 80/tcp and 443/tcp OPEN, 22/tcp OPEN, 3001 localhost-only
Configured: Sat May 30 08:49:35 UTC 2026

## Email Status
- Email to kristina.gagalova@gmail.com: PENDING USER ACTION
- Gmail blocks all unauthenticated SMTP since 2024 (SPF/DKIM required)
- 9 SMTP approaches tried: all blocked by Gmail policy
- Public tunnel URL (working NOW): https://remind-meat-law-forge.trycloudflare.com
- To send email: user must run /mcp in Claude Code and select claude.ai Gmail

## Credentials (for reference)
- Username: AdminMolstar
- Password: MolstarAdmin
- GitHub repo: https://github.com/KristinaGagalova/MoleStarServer
