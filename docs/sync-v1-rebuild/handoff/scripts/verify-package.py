#!/usr/bin/env python3
"""Read-only offline integrity checks. Run on the original extracted package."""
import csv
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
errors = []

def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

def digest(data):
    return hashlib.sha256(data).hexdigest()

def checked_path(relative):
    p = ROOT / relative
    if not p.resolve().is_relative_to(ROOT) or p.is_symlink():
        errors.append(f"Unsafe path: {relative}")
        return None
    if not p.is_file():
        errors.append(f"Missing file: {relative}")
        return None
    return p

def verify_manifest(name):
    rows = read_json(name)["files"]
    for row in rows:
        p = checked_path(row["path"])
        if p is None:
            continue
        raw = p.read_bytes()
        if len(raw) != row["bytes"] or digest(raw) != row["sha256"]:
            errors.append(f"Changed file: {row['path']}")
    return rows

def verify_git_blobs(base, entries, key):
    for row in entries:
        p = checked_path(f"{base}/baseline/{row['path']}")
        if p is None:
            continue
        raw = p.read_bytes()
        actual = hashlib.sha1(f"blob {len(raw)}\0".encode() + raw).hexdigest()
        if actual != row[key]:
            errors.append(f"Git blob mismatch: {p.relative_to(ROOT)}")

try:
    package = verify_manifest("manifests/package-files.json")
    sites = verify_manifest("manifests/sites-files.json")
    assets = verify_manifest("manifests/assets.json")
    expected = {r["path"] for r in package} | {"manifests/package-files.json"}
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob("*") if p.is_file()}
    errors.extend(f"Unexpected file: {p}" for p in sorted(actual - expected))

    dep = "reference/legacy-baseline/deploy"
    baseline = read_json(f"{dep}/baseline-manifest.json")
    deploy_files = baseline["files"] + read_json(f"{dep}/additional-source-manifest.json")
    verify_git_blobs(dep, deploy_files, "git_blob_sha")
    android = "reference/legacy-baseline/android"
    android_files = read_json(f"{android}/evidence.json")["files"]
    verify_git_blobs(android, android_files, "blobSha")

    coverage = read_json("reference/sites-sync/src/coverage.json")
    ids = [x["id"] for x in coverage]
    with (ROOT / "execution/scenario-acceptatie.csv").open(encoding="utf-8", newline="") as f:
        scenarios = list(csv.DictReader(f))
    register_ids = [x["scenario_id"] for x in scenarios]
    if len(ids) != 148 or len(set(ids)) != 148 or register_ids != ids:
        errors.append("Scenario register does not match all 148 unique source IDs in order")
    matrix = (ROOT / "docs/LOGICA-PARITEITSMATRIX.md").read_text()
    for sid in ids:
        if f"`{sid}`" not in matrix:
            errors.append(f"Scenario missing in matrix: {sid}")
    for domain in range(1, 37):
        if f"| L{domain:02d} |" not in matrix:
            errors.append(f"Domain contract missing: L{domain:02d}")

    for asset in ["brand-icon.svg", "full-light.svg"]:
        a = ROOT / "reference/sites-sync/public/assets" / asset
        b = ROOT / "assets/android-icon-kit/source" / asset
        if a.read_bytes() != b.read_bytes():
            errors.append(f"Android vector source differs from Sites: {asset}")
    workflows = list((ROOT / dep / "baseline/.github/workflows").glob("*.yml"))
    if len(workflows) != 25 or len(baseline["branches"]) != 178:
        errors.append("Baseline workflow/branch inventory mismatch")

    result = {"status": "PASS" if not errors else "FAIL", "package_files": len(package),
              "sites_files": len(sites), "asset_files": len(assets),
              "legacy_blob_files": len(deploy_files) + len(android_files),
              "workflows": len(workflows), "branches_in_snapshot": len(baseline["branches"]),
              "scenarios": len(ids), "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
except (OSError, KeyError, ValueError) as exc:
    print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False))
    sys.exit(1)
sys.exit(1 if errors else 0)
