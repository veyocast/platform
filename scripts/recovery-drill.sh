#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${VEYOCAST_ENVIRONMENT:-} != staging ]]; then
  echo "Recovery drill weigert iedere omgeving behalve staging." >&2
  exit 1
fi
if [[ ${RECOVERY_DRILL_CONFIRM:-} != RESTORE_STAGING ]]; then
  echo "RECOVERY_DRILL_CONFIRM=RESTORE_STAGING is verplicht." >&2
  exit 1
fi
if [[ -z ${SOURCE_DATABASE_URL:-} || -z ${RESTORE_DATABASE_URL:-} || -z ${SOURCE_PROJECT_REF:-} ]]; then
  echo "SOURCE_DATABASE_URL, RESTORE_DATABASE_URL en SOURCE_PROJECT_REF zijn verplicht." >&2
  exit 1
fi
if [[ ! ${SOURCE_PROJECT_REF} =~ ^[a-z0-9]{20}$ || ${SOURCE_DATABASE_URL} != *"${SOURCE_PROJECT_REF}"* ]]; then
  echo "De brondatabase hoort niet aantoonbaar bij het stagingproject." >&2
  exit 1
fi
if [[ ${SOURCE_DATABASE_URL} == "${RESTORE_DATABASE_URL}" ]]; then
  echo "Bron- en restoredatabase mogen nooit gelijk zijn." >&2
  exit 1
fi

for command_name in node pg_dump pg_restore psql sha256sum; do
  command -v "${command_name}" >/dev/null || {
    echo "Ontbrekend herstelcommando: ${command_name}." >&2
    exit 1
  }
done

drill_root=$(mktemp -d "${RUNNER_TEMP:-/tmp}/veyocast-recovery.XXXXXX")
service_file="${drill_root}/pg_service.conf"
backup_file="${drill_root}/staging.dump"
evidence_file="${drill_root}/recovery-evidence.json"
started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cleanup() {
  rm -f -- "${service_file}" "${backup_file}"
}
trap cleanup EXIT INT TERM

SERVICE_FILE=${service_file} node <<'NODE'
import { writeFileSync, chmodSync } from "node:fs";

function service(name, raw, requireDrillDatabase) {
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Alleen PostgreSQL is toegestaan.");
  if (!url.hostname || !database || !url.username || !url.password) throw new Error("Database-URL is incompleet.");
  if (requireDrillDatabase && !database.endsWith("_restore_drill")) throw new Error("Het restoredatabasedoel moet eindigen op _restore_drill.");
  if (!requireDrillDatabase && database.endsWith("_restore_drill")) throw new Error("De brondatabase mag geen restoredrilldoel zijn.");
  if (/production|prod\./i.test(`${url.hostname}/${database}`)) throw new Error("Een productionachtig database-doel wordt geweigerd.");
  const escape = (value) => value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  return `[${name}]\nhost='${escape(url.hostname)}'\nport='${escape(url.port || "5432")}'\ndbname='${escape(database)}'\nuser='${escape(decodeURIComponent(url.username))}'\npassword='${escape(decodeURIComponent(url.password))}'\nsslmode='${url.searchParams.get("sslmode") || "require"}'\n`;
}

const output = service("source", process.env.SOURCE_DATABASE_URL, false) + "\n" +
  service("restore", process.env.RESTORE_DATABASE_URL, true);
writeFileSync(process.env.SERVICE_FILE, output, { mode: 0o600 });
chmodSync(process.env.SERVICE_FILE, 0o600);
NODE

export PGSERVICEFILE=${service_file}
pg_dump service=source --format=custom --no-owner --no-privileges --file="${backup_file}"
backup_sha=$(sha256sum "${backup_file}" | cut -d ' ' -f 1)
pg_restore service=restore --clean --if-exists --no-owner --no-privileges "${backup_file}"

table_count=$(psql service=restore --no-psqlrc --tuples-only --no-align --command="select count(*) from information_schema.tables where table_schema = 'public';")
migration_count=$(psql service=restore --no-psqlrc --tuples-only --no-align --command="select count(*) from supabase_migrations.schema_migrations;" 2>/dev/null || printf '0')
if [[ ! ${table_count} =~ ^[0-9]+$ || ${table_count} -lt 1 ]]; then
  echo "Restorecontrole vond geen public tabellen." >&2
  exit 1
fi

finished_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EVIDENCE_FILE=${evidence_file} BACKUP_SHA=${backup_sha} STARTED_AT=${started_at} FINISHED_AT=${finished_at} TABLE_COUNT=${table_count} MIGRATION_COUNT=${migration_count} DEPLOYMENT_REVISION=${DEPLOYMENT_SHA:-unknown} node <<'NODE'
import { writeFileSync } from "node:fs";
const evidence = {
  backup_sha256: process.env.BACKUP_SHA,
  deployment_revision: process.env.DEPLOYMENT_REVISION,
  finished_at: process.env.FINISHED_AT,
  migration_count: Number(process.env.MIGRATION_COUNT),
  result: "pass",
  schema_version: 1,
  started_at: process.env.STARTED_AT,
  table_count: Number(process.env.TABLE_COUNT)
};
writeFileSync(process.env.EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
NODE

cat "${evidence_file}"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  {
    echo "## VeyoCast staging recovery drill"
    echo
    echo "- Resultaat: PASS"
    echo "- Revision: ${DEPLOYMENT_SHA:-unknown}"
    echo "- Backup SHA-256: ${backup_sha}"
    echo "- Public tabellen: ${table_count}"
    echo "- Migraties: ${migration_count}"
    echo "- Tijden: ${started_at} — ${finished_at}"
  } >> "${GITHUB_STEP_SUMMARY}"
fi
