import { readFileSync } from "node:fs";

const drill = readFileSync(new URL("./recovery-drill.sh", import.meta.url), "utf8");
const deployment = readFileSync(new URL("./deploy-vps.sh", import.meta.url), "utf8");

const requiredDrillChecks = [
  "VEYOCAST_ENVIRONMENT:-} != staging",
  "RECOVERY_DRILL_CONFIRM:-} != RESTORE_STAGING",
  "SOURCE_PROJECT_REF} =~ ^[a-z0-9]{20}$",
  "database.endsWith(\"_restore_drill\")",
  "SOURCE_DATABASE_URL} == \"${RESTORE_DATABASE_URL}",
  "pg_restore service=restore --clean --if-exists",
  "backup_sha256"
];
for (const check of requiredDrillChecks) {
  if (!drill.includes(check)) throw new Error(`Recovery drill mist veiligheid: ${check}`);
}
if (!deployment.includes("restore_previous_release") || !deployment.includes("validate_release_images")) {
  throw new Error("Deployment bevat geen geverifieerde image rollback.");
}
const rollbackBody = deployment.slice(
  deployment.indexOf("restore_previous_release()"),
  deployment.indexOf("on_error()")
);
if (/supabase\s+db|migration|downmigration/i.test(rollbackBody)) {
  throw new Error("Image rollback mag geen databasemigratie uitvoeren.");
}

console.log("Recoverycontract: staging-only restore en application-only image rollback zijn geborgd.");
