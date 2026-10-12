"""Reproduce native static TTFs from the audited Sites Inter WOFF2 (fontTools 4.60.1)."""
from pathlib import Path
import hashlib,json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
root=Path(__file__).resolve().parents[3]
source=root/'apps/player/public/fonts/inter.woff2'
manifest=json.loads((root/'packages/content-templates/src/sites-system-assets.json').read_text())
expected=next(row['sha256'] for row in manifest['files'] if row['path']=='/fonts/inter.woff2')
assert hashlib.sha256(source.read_bytes()).hexdigest()==expected
out=root/'apps/control-mobile/assets/fonts';out.mkdir(parents=True,exist_ok=True)
records=[]
for weight,label in [(400,'Regular'),(500,'Medium'),(600,'SemiBold'),(700,'Bold')]:
 font=TTFont(source,recalcTimestamp=False)
 axes={axis.axisTag:axis.defaultValue for axis in font['fvar'].axes};axes['wght']=weight
 instance=instantiateVariableFont(font,axes,inplace=False)
 instance.flavor=None;instance.recalcTimestamp=False
 path=out/f'SitesInter-{weight}.ttf';instance.save(path)
 records.append({'path':path.name,'weight':weight,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'glyphCount':instance['maxp'].numGlyphs})
(out/'sites-font-provenance.json').write_text(json.dumps({'sourcePath':'/fonts/inter.woff2','sourceSha256':expected,'tool':'fontTools 4.60.1','operation':'Lossless WOFF2 decoding and static default-axis weight instancing; no glyph substitutions','fonts':records},indent=2)+'\n')
