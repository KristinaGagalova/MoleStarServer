#!/usr/bin/env bash
# MolStar Backup Script — backs up database and user files
MOLSTAR_DIR="${MOLSTAR_DIR:-/mnt/MolStar}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/molstar-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/molstar_backup_$TIMESTAMP.tar.gz"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_FILE" \
  -C "$MOLSTAR_DIR" \
  db/molstar.db \
  data/users/ \
  server/auth/.env
echo "Backup created: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"
