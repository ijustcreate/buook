"""Repair invalid cmap references in two CC BY-SA FontStruct fonts.

Only character-map references are cleaned; glyph outlines and attribution
are preserved. This compatibility change is recorded in the font notices.
"""
from pathlib import Path
from fontTools.ttLib import TTFont

folder = Path(__file__).resolve().parent.parent / 'assets' / 'fonts'
for name in ['pixel_pirate.ttf', 'sd_auto_pilot.ttf']:
    target = folder / name
    font = TTFont(target)
    valid = set(font.getGlyphOrder())
    for table in font['cmap'].tables:
        if hasattr(table, 'cmap'):
            table.cmap = {code: glyph for code, glyph in table.cmap.items() if glyph in valid}
    font.save(target)
    print('Repaired character map: ' + name)
notice = folder / 'FONT-NOTICES.txt'
text = notice.read_text(encoding='utf-8')
marker = 'Pixel Book compatibility repairs'
if marker not in text:
    notice.write_text(text + '\n\n' + marker + '\nPixel Pirate and SD Auto Pilot: invalid character-map references removed for Chromium compatibility. Glyph outlines and author attribution are unchanged. The modified fonts retain their original CC BY-SA terms.\n', encoding='utf-8')
