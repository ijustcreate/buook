"""Expose the three original bitmap hands as real, bundled font choices."""
import json,subprocess
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
ROOT=Path(__file__).resolve().parent.parent
glyphs=json.loads(subprocess.check_output(['node','-e',"const fs=require('fs'),vm=require('vm');const s={};vm.runInNewContext(fs.readFileSync('ink.js','utf8')+';globalThis.glyphs=INK_GLYPHS',s);process.stdout.write(JSON.stringify(s.glyphs));"],cwd=ROOT,encoding='utf8'))
manifest_path=ROOT/'assets/fonts/manifest.json';manifest=json.loads(manifest_path.read_text(encoding='utf8'))
for key,label,hand in [('keeper-hand','Keeper Hand','keeper'),('wanderer-hand','Wanderer Hand','wanderer'),('grudgebearer-hand','Grudgebearer Hand','grudge')]:
    fb=FontBuilder(1000,isTTF=True);names=['.notdef','space']+[f'uni{ord(c):04X}' for c in glyphs];fb.setupGlyphOrder(names)
    outlines={};metrics={};cmap={32:'space'}
    for c,rows in glyphs.items():
        pen=TTGlyphPen(None)
        for y,row in enumerate(rows.split('/')):
            for x,bit in enumerate(row):
                if bit!='1':continue
                lean=(6-y)*.19 if hand=='wanderer' else y*.08 if hand=='grudge' else 0
                left=round((x+lean)*100);bottom=(6-y)*100;width=135 if hand=='grudge' else 100
                pen.moveTo((left,bottom));pen.lineTo((left,bottom+100));pen.lineTo((left+width,bottom+100));pen.lineTo((left+width,bottom));pen.closePath()
        name=f'uni{ord(c):04X}';outlines[name]=pen.glyph();metrics[name]=(680 if hand=='grudge' else 650,0);cmap[ord(c)]=name
        if c.isalpha():cmap[ord(c.lower())]=name
    for name in ['.notdef','space']:outlines[name]=TTGlyphPen(None).glyph();metrics[name]=(350,0)
    fb.setupCharacterMap(cmap);fb.setupGlyf(outlines);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=800,descent=-200)
    fb.setupNameTable({'familyName':label,'styleName':'Regular','uniqueFontIdentifier':'PixelBook-'+key,'fullName':label,'psName':'PixelBook-'+key,'version':'Version 1.0'})
    fb.setupOS2(sTypoAscender=800,sTypoDescender=-200,usWinAscent=850,usWinDescent=200);fb.setupPost();fb.setupMaxp()
    target=ROOT/'assets/fonts'/f'{key}.ttf';fb.save(target)
    if not any(f['id']==key for f in manifest):manifest.append({'id':key,'label':label,'family':'PBFont-'+key,'url':'assets/fonts/'+target.name})
manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf8')
print('Bundled three original handwriting fonts in the main font manifest.')
