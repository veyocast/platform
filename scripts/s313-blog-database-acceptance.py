#!/usr/bin/env python3
"""Run VeyoCast database gates only against one disposable local database.

Copies Supabase's schema definitions (never data) from the existing local stack,
excludes application schemas/objects, then uses the repository's real pnpm gates.
No container/volume reset, image pull, hosted target or secret output is allowed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import tomllib
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = "supabase_db_veyocast-s295"
DATABASE = "s313_blog_acceptance_final"
PORT = 64422
URL = f"postgresql://postgres@127.0.0.1:{PORT}/{DATABASE}?sslmode=disable"
EVIDENCE = ROOT / "docs/s313-blog-socialhero/evidence/database/final"
DOCKER = ["docker", "exec", "-i", CONTAINER]
SUMMARY: dict = {}
PASSWORD = ""


def clean(value: str) -> str:
    if PASSWORD:
        value = value.replace(PASSWORD, "[REDACTED]")
    return re.sub(r"(postgres(?:ql)?://[^:/@\s]+:)[^@\s]+@", r"\1[REDACTED]@", value)


def run(args: list[str], *, data: bytes | None = None, env: dict | None = None) -> bytes:
    result = subprocess.run(args, input=data, capture_output=True, cwd=ROOT, env=env)
    if result.returncode:
        raise RuntimeError(clean(result.stderr.decode(errors="replace")))
    return result.stdout


def sql(query: str, database: str = "postgres", *, admin: bool = False) -> str:
    global PASSWORD
    if database not in ("postgres", DATABASE):
        raise RuntimeError("Database target is outside this runner's fixed allowlist")
    if database == "postgres":
        query = "BEGIN READ ONLY;\n" + query.rstrip().rstrip(";") + ";\nCOMMIT;"
    command = DOCKER + ["psql", "-U", "postgres", "-d", database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
    if admin:
        if database != DATABASE:
            raise RuntimeError("Superuser writes are restricted to the disposable database")
        # pg_restore 16 emits \restrict directives supported by the matching
        # host psql client, whereas the old image's psql 15 does not parse them.
        PASSWORD = run(DOCKER + ["sh", "-c", 'printf %s "$POSTGRES_PASSWORD"']).decode()
        environment = os.environ.copy()
        environment["PGPASSWORD"] = PASSWORD
        command = ["psql", URL.replace("postgres@", "supabase_admin@"), "-X", "-qAt", "-v", "ON_ERROR_STOP=1"]
        return run(command, data=query.encode(), env=environment).decode().strip()
    return run(command, data=query.encode()).decode().strip()


def source_snapshot() -> dict:
    return json.loads(sql("""
      select json_build_object(
        'database',current_database(),
        'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
        'migrationTip',(select max(version) from supabase_migrations.schema_migrations),
        'authUsers',(select count(*) from auth.users),
        'storageObjects',(select count(*) from storage.objects),
        'tenants',(select count(*) from public.tenants),
        'profiles',(select count(*) from public.profiles),
        'blogInstalled',to_regclass('public.platform_blog_posts') is not null,
        'rolesDigest',(select md5(string_agg(rolname||':'||rolsuper::text||':'||rolcanlogin::text,',' order by rolname)) from pg_roles));
    """))


def prepare() -> None:
    if sql("select count(*) from pg_database where datname='s313_blog_acceptance_final'") != "0":
        raise RuntimeError("Disposable database already exists; preparation refuses to overwrite it")
    archive = run(DOCKER + ["pg_dump", "-U", "postgres", "-d", "postgres", "--schema-only", "--format=custom"])
    toc = run(["pg_restore", "--list"], data=archive).decode()
    # Storage triggers that invoke application helpers are recreated by migrations.
    app_triggers = sql("""select t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
      join pg_namespace pn on pn.oid=p.pronamespace where not t.tgisinternal
      and n.nspname not in ('public','private') and pn.nspname in ('public','private')""").splitlines()
    selected, excluded = [], []
    for line in toc.splitlines():
        if line.startswith(";") or not line.strip():
            selected.append(line)
            continue
        # Keep Supabase's default API grants, without retaining application objects.
        public_base = " DEFAULT ACL public " in line or " ACL - SCHEMA public " in line
        reject = (
            " private " in line or " supabase_migrations " in line
            or (" public " in line and not public_base)
            or " POLICY " in line
            or " FOREIGN SERVER " in line or " USER MAPPING " in line
            # The dynamically generated GraphQL entry has an image-version-specific ACL.
            or " ACL graphql_public FUNCTION graphql(" in line
            or any(" TRIGGER " in line and f" {name} " in line for name in app_triggers)
        )
        (excluded if reject else selected).append(line)
    with tempfile.TemporaryDirectory(prefix="s313-blog-db-") as temporary:
        selection = Path(temporary) / "base.list"
        selection.write_text("\n".join(selected) + "\n")
        base_sql = run(["pg_restore", "--use-list", str(selection), "--file", "-"], data=archive)
    # Schema-only archives have no table data, sequence values, users or credentials.
    if re.search(rb"(?m)^(COPY |INSERT INTO |SELECT pg_catalog.setval)", base_sql):
        raise RuntimeError("Base archive unexpectedly contains data")
    run(DOCKER + ["createdb", "-U", "postgres", DATABASE])
    sql(base_sql.decode(), DATABASE, admin=True)
    baseline = json.loads(sql("""select json_build_object(
      'database',current_database(),'publicTables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
      'privateSchema',to_regnamespace('private') is not null,
      'authUsers',(select count(*) from auth.users),'storageObjects',(select count(*) from storage.objects),
      'appHistory',to_regclass('supabase_migrations.schema_migrations') is not null)""", DATABASE))
    if baseline != {"database": DATABASE, "publicTables": 0, "privateSchema": False, "authUsers": 0, "storageObjects": 0, "appHistory": False}:
        raise RuntimeError("Disposable Supabase base is not empty: " + json.dumps(baseline))
    manifest = {"archiveSha256": hashlib.sha256(archive).hexdigest(), "baseSqlSha256": hashlib.sha256(base_sql).hexdigest(), "archiveBytes": len(archive), "selectedObjects": sum(not x.startswith(';') and bool(x.strip()) for x in selected), "excludedObjects": len(excluded), "baseline": baseline, "source": "schema-only Supabase-managed objects from local PG15.8 image; application public/private objects and every policy excluded; Supabase API default grants retained; no data or roles copied"}
    (EVIDENCE / "base-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    SUMMARY["preparation"] = manifest
    print("Prepared empty Supabase base:", json.dumps(baseline), flush=True)


def gate(name: str) -> None:
    global PASSWORD
    if name == "test:rls":
        # The official CLI uses this cached runner; never permit an implicit image pull.
        run(["docker", "image", "inspect", "public.ecr.aws/supabase/pg_prove:3.36", "--format", "{{.Id}}"])
    PASSWORD = run(DOCKER + ["sh", "-c", 'printf %s "$POSTGRES_PASSWORD"']).decode()
    environment = os.environ.copy()
    environment.update({"PGPASSWORD": PASSWORD, "PGSSLMODE": "disable", "SUPABASE_DB_PASSWORD": PASSWORD, "SUPABASE_INTERNAL_IMAGE_REGISTRY": "public.ecr.aws", "COREPACK_ENABLE_DOWNLOAD_PROMPT": "0"})
    # Explicitly disable pnpm's automatic dependency installation before executing a script.
    args = ["pnpm", "--config.verify-deps-before-run=false", name, "--db-url", URL, "--workdir", str(ROOT)]
    if name == "db:reset":
        args.append("--yes")
    # Port differs from config.toml db.port/shadow_port, so CLI's pinned
    # IsLocalDatabase cannot enter the destructive container-reset code path.
    target = run(["psql", URL, "-X", "-qAt", "-c", "select current_database()"], env=environment).decode().strip()
    db_config = tomllib.loads((ROOT / "supabase/config.toml").read_text())["db"]
    if target != DATABASE or PORT in (db_config["port"], db_config.get("shadow_port")):
        raise RuntimeError("Refusing database gate against an unexpected target")
    started = datetime.now(timezone.utc).isoformat()
    stem = "reset" if name == "db:reset" else "rls"
    logfile = EVIDENCE / f"{stem}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}.log"
    print("Running", " ".join(args), flush=True)
    with logfile.open("w") as log:
        process = subprocess.Popen(args, cwd=ROOT, env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        assert process.stdout
        for line in process.stdout:
            safe_line = clean(line)
            log.write(safe_line)
            log.flush()
            print(safe_line, end="", flush=True)
        code = process.wait()
    if name in SUMMARY:
        SUMMARY.setdefault("attempts", []).append(SUMMARY[name])
    SUMMARY[name] = {"command": " ".join(args), "startedAt": started, "finishedAt": datetime.now(timezone.utc).isoformat(), "exitCode": code, "log": str(logfile.relative_to(ROOT))}
    if code:
        raise RuntimeError(f"{name} failed with exit {code}; see sanitized log")
    if name == "db:reset":
        SUMMARY["migrationReadback"] = json.loads(sql("select json_build_object('count',count(*),'latest',max(version)) from supabase_migrations.schema_migrations", DATABASE))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", choices=("all", "prepare", "reset", "test"), default="all")
    args = parser.parse_args()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    summary_file = EVIDENCE / "summary.json"
    if summary_file.exists():
        SUMMARY.update(json.loads(summary_file.read_text()))
    if SUMMARY.get("error"):
        SUMMARY.setdefault("previousErrors", []).append(SUMMARY.pop("error"))
    migration_files = sorted((ROOT / "supabase/migrations").glob("*.sql"))
    migrations_hash = hashlib.sha256()
    for migration in migration_files:
        migrations_hash.update(migration.name.encode() + b"\0" + migration.read_bytes())
    SUMMARY["sourceFiles"] = {
        "migrationCount": len(migration_files),
        "migrationsSha256": migrations_hash.hexdigest(),
        "blogMigrationSha256": hashlib.sha256((ROOT / "supabase/migrations/20261113124946_s313_blog_publication_kernel.sql").read_bytes()).hexdigest(),
        "blogTestSha256": hashlib.sha256((ROOT / "supabase/tests/s313_blog_publication.sql").read_bytes()).hexdigest(),
        "sharedDocumentSha256": hashlib.sha256((ROOT / "packages/blog/src/document.ts").read_bytes()).hexdigest(),
    }
    SUMMARY.update({"database": DATABASE, "host": "127.0.0.1", "port": PORT, "role": "postgres", "container": CONTAINER, "branch": run(["git", "branch", "--show-current"]).decode().strip(), "head": run(["git", "rev-parse", "HEAD"]).decode().strip(), "sourceBefore": source_snapshot()})
    try:
        if args.stage in ("all", "prepare"):
            prepare()
        if args.stage in ("all", "reset"):
            gate("db:reset")
        if args.stage in ("all", "test"):
            gate("test:rls")
    except Exception as error:
        SUMMARY["error"] = clean(str(error))
        raise
    finally:
        SUMMARY["sourceAfter"] = source_snapshot()
        SUMMARY["sourceUnchanged"] = SUMMARY["sourceBefore"] == SUMMARY["sourceAfter"]
        summary_file.write_text(json.dumps(SUMMARY, indent=2) + "\n")
    if not SUMMARY["sourceUnchanged"]:
        raise RuntimeError("Original database snapshot changed; investigate before proceeding")
    print("Original local database snapshot unchanged; disposable database retained for integration.", flush=True)


if __name__ == "__main__":
    main()
