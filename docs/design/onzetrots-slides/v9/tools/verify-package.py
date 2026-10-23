#!/usr/bin/env python3
"""Controleer de exacte overdracht en captures; geen VeyoCast-productiechecks."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import re
import struct
import sys

root = Path(__file__).resolve().parents[1]
errors = []
def check(ok, message):
    if not ok:
        errors.append(message)
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def local_path(name):
    p = PurePosixPath(name)
    check(not p.is_absolute() and '..' not in p.parts and '\\' not in name,
          'Onveilig pakketpad: ' + name)
    return root / name
def jpeg_dimensions(path):
    data = path.read_bytes()
    if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):
        raise ValueError('Ongeldige JPEG-markeringen')
    pos = 2
    while pos < len(data):
        if data[pos] != 255:
            raise ValueError('Ongeldige JPEG-segmentgrens')
        while pos < len(data) and data[pos] == 255:
            pos += 1
        marker = data[pos]
        pos += 1
        if marker in (0xd8, 0xd9) or 0xd0 <= marker <= 0xd7:
            continue
        length = struct.unpack('>H', data[pos:pos+2])[0]
        if length < 2 or pos + length > len(data):
            raise ValueError('Ongeldige JPEG-segmentlengte')
        if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
            height, width = struct.unpack('>HH', data[pos+3:pos+7])
            return {'width': width, 'height': height}
        if marker == 0xda:
            break
        pos += length
    raise ValueError('Geen JPEG-afmetingen gevonden')

manifest = json.loads((root / 'MANIFEST.json').read_text())
coverage = manifest['coverage']
commit = manifest['prototype']['commit']
layout_commit = coverage.get('staticLayoutSourceCommit', commit)
inventory = json.loads((root / 'broncode/repo-inventory.json').read_text())
families = inventory['families']
family_count = coverage['families']
check(len(families) == family_count, 'Familieaantal wijkt af van manifest')
check(len({f['id'] for f in families}) == family_count, 'Familie-ID’s zijn niet uniek')
check(coverage['baseScreenshots'] == family_count * len(coverage['themes']) * len(coverage['orientations']),
      'Basiscapturedekking wijkt af van productmatrix')

source_root = root / manifest['prototype']['sourceDirectory']
source_files = {f.relative_to(source_root).as_posix(): f for f in source_root.rglob('*') if f.is_file()}
audit = json.loads((root / manifest['assets']['audit']).read_text())
check(audit['authoritative_prototype_commit'] == commit, 'Assetaudit gebruikt verkeerde broncommit')
check(len(source_files) == manifest['prototype']['fileCount'], 'Bronbestandsaantal wijkt af')
check(sum(f.stat().st_size for f in source_files.values()) == manifest['prototype']['sourceBytes'], 'Brontotaal bytes wijkt af')
check(len(audit['files']) == len(source_files), 'Assetaudit heeft verkeerd bestandsaantal')
check({r['path'] for r in audit['files']} == set(source_files), 'Assetaudit en exacte bronbestandslijst verschillen')
for record in audit['files']:
    path = source_files.get(record['path'])
    if path:
        check(path.stat().st_size == record['bytes'], 'Bronbytes wijken af: ' + record['path'])
        check(digest(path) == record['sha256'], 'Bronhash wijkt af: ' + record['path'])

captures = json.loads((root / coverage['captureInventory']).read_text())
expected_count = coverage['baseScreenshots'] + coverage['detailScreenshots']
check(captures['sourceCommit'] == layout_commit, 'Statische captures gebruiken verkeerde layoutbroncommit')
check(captures.get('appliesToPrototypeCommit', commit) == commit, 'Statische layoutcompatibiliteit wijkt af')
check(captures['count'] == expected_count == len(captures['captures']), 'Captureaantal wijkt af van manifest')
check(captures['baseCount'] == coverage['baseScreenshots'], 'Basiscount wijkt af')
check(captures['detailCount'] == coverage['detailScreenshots'], 'Detailcount wijkt af')
check(captures['captureDefaults'] == coverage['captureDefaults'], 'Capturedefaults wijken af')
records = captures['captures']
paths = [r['packagePath'] for r in records]
check(len(set(paths)) == expected_count, 'Dubbele capturepaden')
base = [r for r in records if r['kind'] == 'base']
details = [r for r in records if r['kind'] == 'detail']
expected_base = {
    f'voorbeelden/alle-slides/{orientation}-{theme}/{i:02d}-{family["id"]}.jpg'
    for orientation in coverage['orientations'] for theme in coverage['themes']
    for i, family in enumerate(families, 1)
}
expected_details = {
    f'voorbeelden/details/visitors-{count}-{orientation}-{theme}.jpg'
    for orientation in coverage['orientations'] for theme in coverage['themes'] for count in range(1, 5)
}
check(len(base) == coverage['baseScreenshots'] and {r['packagePath'] for r in base} == expected_base,
      'Basisbeelden vormen niet de exacte familie/thema/formaatmatrix')
check(len(details) == coverage['detailScreenshots'] and {r['packagePath'] for r in details} == expected_details,
      'Bezoekersdetails vormen niet de exacte1–4/thema/formaatmatrix')
contacts = captures['contactSheets']
expected_contacts = {f'voorbeelden/overzichten/{o}-{t}.jpg' for o in coverage['orientations'] for t in coverage['themes']}
check(len(contacts) == coverage['contactSheets'] == captures['contactSheetCount'], 'Contactbladaantal wijkt af')
check({r['packagePath'] for r in contacts} == expected_contacts, 'Contactbladmatrix wijkt af')
for record in records + contacts:
    path = local_path(record['packagePath'])
    check(path.is_file(), 'Capture ontbreekt: ' + record['packagePath'])
    check(record['sourceCommit'] == layout_commit, 'Layoutbroncommit verschilt: ' + record['packagePath'])
    if path.is_file():
        check(path.stat().st_size == record['bytes'], 'Capturebytes wijken af: ' + record['packagePath'])
        check(digest(path) == record['sha256'], 'Capturehash wijkt af: ' + record['packagePath'])
        try:
            check(jpeg_dimensions(path) == record['dimensions'], 'JPEG-afmetingen wijken af: ' + record['packagePath'])
        except (ValueError, IndexError, struct.error) as exc:
            check(False, 'Ongeldige JPEG: ' + record['packagePath'] + ': ' + str(exc))
    if record in records:
        check(record['id'] in {family['id'] for family in families}, 'Onbekende slidefamilie')
        check(record['captureDefaults'] == captures['captureDefaults'], 'Framecapturedefaults wijken af')
    else:
        expected = {r['packagePath'] for r in base if r['orientation'] == record['orientation'] and r['theme'] == record['theme']}
        check(set(record['generatedFrom']) == expected and len(record['generatedFrom']) == family_count,
              'Contactblad is niet van de volledige juiste basisgroep afgeleid')
evidence_record = coverage['browserEvidence']
evidence_path = local_path(evidence_record['packagePath'])
check(evidence_path.is_file(), 'Oorspronkelijk v8-browserbewijs ontbreekt')
evidence = json.loads(evidence_path.read_text())
check(digest(evidence_path) == evidence_record['sha256'] and evidence_path.stat().st_size == evidence_record['bytes'], 'Browserbewijs hash/bytes wijken af')
check(evidence['sourceCommit'] == commit == evidence_record['sourceCommit'], 'Browserbewijs broncommit wijkt af')
check(len(evidence['checks']) == family_count * len(coverage['orientations']) == evidence_record['checkCount'], 'Verkeerd aantal daadwerkelijke pre-capture checks')
for block, orientation in enumerate(evidence_record['checkOrdering']):
    group = evidence['checks'][block*family_count:(block+1)*family_count]
    check({r['family'] for r in group} == {family['id'] for family in families}, 'Browserbewijs familiematrix wijkt af')
    for record in group:
        check(record['headerCount'] == 1 and record['copyOverflow'] is False and bool(record['fonts']) and all('Rubik Distressed' in font for font in record['fonts']), 'V8 kop/font/overflowcontrole niet geslaagd: ' + record['family'])
frames = evidence.get('frames', [])
check(len(frames) == evidence_record.get('frameCount', 0), 'Per-frame evidence count mismatch')
if frames:
    check(len(frames) == expected_count, 'Per-frame evidence must cover all individual captures')
    check(len({frame['name'] for frame in frames}) == expected_count, 'Duplicate observed frame names')
    for record in records:
        observed = frames[record['observedFrameIndex']]
        check(observed['name'] == record['file'] and observed['family'] == record['id'] and observed['orientation'] == record['orientation'] and observed['theme'] == record['theme'], 'Actual frame evidence context mismatch')
        check(observed['headerCount'] == 1 and observed['logoCount'] == 1 and observed['copyOverflow'] is False, 'Actual frame header/logo/overflow assertion failed')
        check(observed['innerHeads'] == (3 if record['id'] == 'matchday' else 0), 'Actual frame inner-header assertion failed')
        check(bool(observed['fonts']) and all('Rubik Distressed' in font for font in observed['fonts']), 'Actual frame Rubik font assertion failed')
        check(abs(record['dimensions']['width'] - observed['rect']['width']) <= 1 and abs(record['dimensions']['height'] - observed['rect']['height']) <= 1, 'Observed frame rectangle differs from image')
        if record['id'] == 'birthdays':
            check(len(observed['birthdays']) == 6, 'Birthday frame should show6records')
            for birthday in observed['birthdays']:
                check(birthday['greetingBeforeAge'] is True and 'Rubik Distressed' in birthday['ageFont'], 'Birthday order/age font mismatch')
                check(birthday['dateSize'] == ('13px' if record['orientation'] == 'landscape' else '12px'), 'Birthday date size mismatch')
                check(bool(re.search(r' [A-Z]\.!$', birthday['greeting'])), 'Birthday surname initial missing')
for record in base:
    index = record['preCaptureDomCheckIndex']
    observed = evidence['checks'][index]
    check(observed['family'] == record['id'] and evidence_record['checkOrdering'][index // family_count] == record['orientation'], 'Capture verwijst naar verkeerd pre-capture bewijs')
check(len(evidence['details']) == coverage['detailScreenshots'], 'Detailopnamecontext wijkt af')
for record in details:
    observed = evidence['details'][record['detailMetadataIndex']]
    check(observed['id'] == record['id'] and observed['count'] == record['count'] and observed['orientation'] == record['orientation'] and observed['theme'] == record['theme'], 'Detailcapture context wijkt af')
    check(abs(record['dimensions']['width'] - observed['rect']['width']) <= 1 and abs(record['dimensions']['height'] - observed['rect']['height']) <= 1, 'Detailcapture afmetingen/rect wijken af')

motion = manifest.get('motionProof', {})
motion_frames = motion.get('frames', [])
motion_paths = {r['packagePath'] for r in motion_frames}
if motion:
    motion_commit = motion['sourceCommit']
    historical_motion = motion.get('historical', False)
    check(bool(re.fullmatch(r'[0-9a-f]{40}', motion_commit)), 'Ongeldige motionbroncommit')
    check(motion_commit == commit or (historical_motion and bool(motion.get('historicalReason'))), 'Motionbron moet actueel zijn of expliciet historisch met reden')
    check(len(motion_frames) == motion['frameCount'] == 3, 'Verkeerd aantal gedeclareerde motionframes')
    expected_motion = {motion['directory'] + '/' + name for name in ['01-achtergrond.jpg', '02-header.jpg', '03-containers.jpg']}
    check(motion_paths == expected_motion, 'Motionframelijst wijkt af')
    for record in motion_frames:
        path = local_path(record['packagePath'])
        check(path.is_file(), 'Motionframe ontbreekt: ' + record['packagePath'])
        if path.is_file():
            check(path.stat().st_size == record['bytes'] and digest(path) == record['sha256'], 'Motionframehash/bytes wijken af')
            check(jpeg_dimensions(path) == record['dimensions'], 'Motionframeafmetingen wijken af')
        check(record['sourceCommit'] == motion_commit, 'Motionframe gebruikt verkeerde broncommit')
    observation = motion['observations']
    path = local_path(observation['packagePath'])
    check(path.is_file(), 'Motionobservaties ontbreken')
    if path.is_file():
        check(path.stat().st_size == observation['bytes'] and digest(path) == observation['sha256'], 'Motionobservatiehash/bytes wijken af')
        check(json.loads(path.read_text())['sourceRevision'] == motion_commit, 'Motionobservaties gebruiken verkeerde broncommit')
    actual_motion = {f.relative_to(root).as_posix() for f in (root / motion['directory']).rglob('*') if f.is_file()}
    check(actual_motion == motion_paths | {observation['packagePath']}, 'Onverwachte/verouderde motionbestanden')
actual_images = {f.relative_to(root).as_posix() for f in (root / 'voorbeelden').rglob('*.jpg')}
check(actual_images == set(paths) | expected_contacts | motion_paths, 'Ontbrekende of verouderde voorbeeld-JPEG’s in pakket')

gallery = (root / 'voorbeelden/index.html').read_text()
for value in re.findall(r'(?:href|src)="([^"]+)"', gallery):
    if value.startswith(('#', 'http:', 'https:', 'data:')):
        continue
    check((root / 'voorbeelden' / value).resolve().is_file(), 'Galerijlink ontbreekt: ' + value)
for record in records + contacts + motion_frames:
    check(record['packagePath'].removeprefix('voorbeelden/') in gallery,
          'Beeld ontbreekt in galerij: ' + record['packagePath'])

menu = manifest.get('menuStudioReference')
if menu:
    menu_inventory = json.loads((root / menu['inventory']).read_text())
    check(menu_inventory['sourceCommit'] == menu['sourceCommit'], 'MenuStudio broncommit wijkt af')
    check(len(menu_inventory['files']) == menu['fileCount'], 'MenuStudio bestandsaantal wijkt af')
    actual_menu = {f.relative_to(root).as_posix() for f in (root / menu['directory']).rglob('*') if f.is_file()}
    check(actual_menu == {r['path'] for r in menu_inventory['files']}, 'MenuStudio bronbestandslijst wijkt af')
    for record in menu_inventory['files']:
        path = local_path(record['path'])
        check(path.is_file() and path.stat().st_size == record['bytes'] and digest(path) == record['sha256'], 'MenuStudio bronhash/bytes wijken af: ' + record['path'])

    menu_proof = menu.get('browserProof')
    if menu_proof:
        check(menu_proof['sourceCommit'] == menu['sourceCommit'], 'MenuStudio proof source mismatch')
        check(sum('dimensions' in r for r in menu_proof['files']) == menu_proof['frameCount'] == 4, 'MenuStudio proof count mismatch')
        actual = {f.relative_to(root).as_posix() for f in (root / menu_proof['directory']).rglob('*') if f.is_file()}
        check(actual == {r['packagePath'] for r in menu_proof['files']}, 'MenuStudio proof file set mismatch')
        for record in menu_proof['files']:
            path = local_path(record['packagePath'])
            check(path.is_file() and path.stat().st_size == record['bytes'] and digest(path) == record['sha256'], 'MenuStudio proof hash/bytes mismatch')
            check(record['sourceCommit'] == menu['sourceCommit'], 'MenuStudio proof frame source mismatch')

checksum_file = root / manifest['checks']['checksums']
check(checksum_file.is_file(), 'SHA256SUMS.txt ontbreekt')
listed = set()
if checksum_file.is_file():
    for line in checksum_file.read_text().splitlines():
        expected, name = line.split('  ', 1)
        check(name not in listed, 'Dubbel checksumpad: ' + name)
        listed.add(name)
        path = local_path(name)
        check(path.is_file(), 'Bestand uit checksums ontbreekt: ' + name)
        if path.is_file():
            check(digest(path) == expected, 'Checksum fout: ' + name)
    actual = {f.relative_to(root).as_posix() for f in root.rglob('*') if f.is_file() and f != checksum_file}
    check(actual == listed, 'Bestandslijst wijkt af van SHA256SUMS.txt')
for path in root.rglob('*'):
    check(path.name not in {'.git', '.openai', '.env', '.env.local', 'hosting.json'},
          'Niet-toegestane projectmetadata: ' + str(path))
if errors:
    print('\n'.join('FOUT: ' + x for x in errors), file=sys.stderr)
    sys.exit(1)
print(f'OK: {len(source_files)} exacte bronbestanden; {family_count} families; {len(base)} basisbeelden + {len(details)} details; {len(contacts)} contactbladen; {len(motion_frames)} motionframes; hashes, afmetingen, daadwerkelijke browserchecks, galerijlinks en volledige checksumlijst kloppen.')
