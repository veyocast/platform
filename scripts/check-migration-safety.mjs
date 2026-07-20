import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const migrationRoot = resolve(process.argv[2] ?? "supabase/migrations");

function fail(message) {
  console.error(message);
  process.exit(1);
}

try {
  if (!(await stat(migrationRoot)).isDirectory()) {
    fail(`Migratiemap bestaat niet: ${migrationRoot}.`);
  }
} catch {
  fail(`Migratiemap bestaat niet: ${migrationRoot}.`);
}

const migrations = (await readdir(migrationRoot))
  .filter((migration) => migration.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right, "en"));

if (migrations.length === 0) {
  fail("Geen Supabase-migraties gevonden.");
}

let previous = "";
for (const migration of migrations) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(migration);
  if (!match) {
    fail(`Migratievolgorde is ongeldig: ${migration}.`);
  }

  const current = match[1];
  if (previous && current <= previous) {
    fail(`Migratieversies moeten uniek en strikt oplopend zijn: ${migration}.`);
  }
  previous = current;
}

const destructiveSchemaPattern =
  /(?:^|[\s;])(?:drop\s+(?:table|schema|type)|truncate\s+)/i;
const unboundedDeletePattern =
  /(?:^|[\s;])delete\s+from\s+(?:(?!\bwhere\b)[^;])*(?:;|$)/is;

for (const migration of migrations) {
  const sql = await readFile(resolve(migrationRoot, migration), "utf8");
  if (destructiveSchemaPattern.test(sql)) {
    fail(
      `${migration}: potentieel destructieve migratie gedetecteerd; handmatige review is verplicht.`
    );
  }
  if (unboundedDeletePattern.test(sql)) {
    fail(
      `${migration}: onbegrensde DELETE in migratie gedetecteerd; handmatige review is verplicht.`
    );
  }
}
