#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

for variable in RCLONE_SOURCE_REMOTE RCLONE_BACKUP_REMOTE BACKUP_ENVIRONMENT; do
  if [[ -z ${!variable:-} ]]; then
    echo "${variable} ontbreekt." >&2
    exit 1
  fi
done

case "${BACKUP_ENVIRONMENT}" in
  staging|production) ;;
  *) echo "BACKUP_ENVIRONMENT moet staging of production zijn." >&2; exit 1 ;;
esac

snapshot=$(date --utc +'%Y/%m/%d/%H%M%S')
destination="${RCLONE_BACKUP_REMOTE%/}/${BACKUP_ENVIRONMENT}/${snapshot}"

# Copy maakt een immutable herstelpunt; sync zou verwijderingen uit de bron
# onmiddellijk naar de back-up kunnen doorzetten.
rclone copy \
  "${RCLONE_SOURCE_REMOTE%/}/tenant-media" \
  "${destination}/tenant-media" \
  --checksum \
  --immutable \
  --metadata \
  --transfers 4 \
  --checkers 8

rclone lsf "${destination}/tenant-media" --recursive --files-only \
  | LC_ALL=C sort \
  | sha256sum \
  | awk '{print $1}' \
  | rclone rcat "${destination}/MANIFEST.sha256"

echo "Storageherstelpunt geschreven: ${BACKUP_ENVIRONMENT}/${snapshot}"
