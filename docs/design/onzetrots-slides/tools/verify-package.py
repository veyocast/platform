#!/usr/bin/env python3
"""Controleer inhoud en integriteit van de overdracht; geen productiechecks."""
from pathlib import Path
import hashlib
import json
import re
import sys

root = Path(__file__).resolve().parents[1]
errors = []

def check(ok, message):
    if not ok:
        errors.append(message)

manifest = json.loads((root / 'MANIFEST.json').read_text())
inventory = json.loads((root / 'broncode/repo-inventory.json').read_text())
families = inventory['families']
check(len(families) == 36, 'Catalogus moet 36 families bevatten')
check(len({f['id'] for f in families}) == 36, 'Familie-ID’s zijn niet uniek')

audit = json.loads((root / 'inventaris/asset-audit.json').read_text())
source_files = {f.relative_to(root / 'broncode').as_posix(): f
                for f in (root / 'broncode').rglob('*') if f.is_file()}
check(len(source_files) == manifest['prototype']['fileCount'], 'Bronbestandsaantal wijkt af')
check(sum(f.stat().st_size for f in source_files.values()) == manifest['prototype']['sourceBytes'],
      'Brontotaal bytes wijkt af')
for record in audit['files']:
    path = source_files.get(record['path'])
    check(path is not None, 'Ontbrekende bron: ' + record['path'])
    if path:
        check(hashlib.sha256(path.read_bytes()).hexdigest() == record['sha256'],
              'Bronhash wijkt af: ' + record['path'])

for orientation in manifest['coverage']['orientations']:
    for theme in manifest['coverage']['themes']:
        folder = root / 'voorbeelden/alle-slides' / f'{orientation}-{theme}'
        check(len(list(folder.glob('*.jpg'))) == 36, 'Geen 36 beelden in ' + str(folder))
        for i, family in enumerate(families, 1):
            check((folder / f'{i:02d}-{family["id"]}.jpg').is_file(),
                  'Basisbeeld ontbreekt: ' + orientation + '-' + theme + '/' + family['id'])

captures = json.loads((root / 'inventaris/captures.json').read_text())
check(captures['count'] == 219, 'Er moeten 219 individuele captures zijn')
check(len(captures['captures']) == 219, 'Capturelijst heeft verkeerde lengte')
check(len({c['packagePath'] for c in captures['captures']}) == 219, 'Dubbele capturepaden')
for capture in captures['captures']:
    f = root / capture['packagePath']
    check(f.is_file() and f.stat().st_size > 1000, 'Ontbrekende/lege capture: ' + str(f))
check(len(list((root / 'voorbeelden/details').glob('*.jpg'))) == 75, 'Er moeten 75 detailbeelden zijn')
check(len(list((root / 'voorbeelden/overzichten').glob('*.jpg'))) == 4, 'Er moeten vier contactbladen zijn')

gallery = (root / 'voorbeelden/index.html').read_text()
for value in re.findall(r'(?:href|src)="([^"]+)"', gallery):
    if value.startswith(('#', 'http:', 'https:', 'data:')):
        continue
    check((root / 'voorbeelden' / value).resolve().is_file(), 'Galerijlink ontbreekt: ' + value)

checksum_file = root / 'SHA256SUMS.txt'
check(checksum_file.is_file(), 'SHA256SUMS.txt ontbreekt')
listed = set()
if checksum_file.is_file():
    for line in checksum_file.read_text().splitlines():
        expected, name = line.split('  ', 1)
        listed.add(name)
        path = root / name
        check(path.is_file(), 'Bestand uit checksums ontbreekt: ' + name)
        if path.is_file():
            check(hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'Checksum fout: ' + name)
    actual = {f.relative_to(root).as_posix() for f in root.rglob('*')
              if f.is_file() and f.name != 'SHA256SUMS.txt'}
    check(actual == listed, 'Bestandslijst wijkt af van SHA256SUMS.txt')

for f in root.rglob('*'):
    check(f.name not in {'.git', '.openai', '.env', '.env.local', 'hosting.json'},
          'Niet-toegestane projectmetadata: ' + str(f))

if errors:
    print('\n'.join('FOUT: ' + x for x in errors), file=sys.stderr)
    sys.exit(1)
print(f'OK: {len(source_files)} exacte bronbestanden; 36 families; 219 beelden; 4 contactbladen; alle checksums en galerijlinks kloppen.')
