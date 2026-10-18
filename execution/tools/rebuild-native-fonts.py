"""Decode the pinned Sync Manrope into native static weights, without redrawing glyphs.

Run with fonttools[woff]==4.60.1 in an isolated tool environment. No runtime
dependency, font download, or repository lockfile change is required.
"""
import hashlib
import json
from pathlib import Path

import fontTools
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[2]
source_path = "docs/sync-v1-rebuild/handoff/reference/sites-sync/public/assets/manrope.woff2"
source = root / source_path
target = root / "apps/control-mobile/assets/fonts"
assert fontTools.__version__ == "4.60.1", "Use the audited tool version"
source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
fonts = []
for weight in (400, 450, 500, 600, 650, 700, 750):
    font = TTFont(source, recalcTimestamp=False)
    glyph_count = font["maxp"].numGlyphs
    axes = {axis.axisTag: axis.defaultValue for axis in font["fvar"].axes}
    axes["wght"] = weight
    font = instantiateVariableFont(font, axes, inplace=True)
    font.flavor = None
    assert "fvar" not in font and font["maxp"].numGlyphs == glyph_count
    output = target / f"SyncManrope-{weight}.ttf"
    font.save(output)
    fonts.append({"path": output.name, "weight": weight,
                  "bytes": output.stat().st_size,
                  "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
                  "glyphCount": glyph_count})
provenance = {"sourcePath": source_path, "sourceSha256": source_sha,
              "tool": "fontTools 4.60.1",
              "operation": "WOFF2 decoding and static weight instancing at default remaining axes; unchanged glyph set",
              "license": "Manrope-OFL.txt", "fonts": fonts}
(target / "sync-font-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
license_source = source.with_name("Manrope-OFL.txt")
(target / "Manrope-OFL.txt").write_bytes(license_source.read_bytes())
print(f"Verified Sync Manrope {source_sha}; {len(fonts)} static native weights")
