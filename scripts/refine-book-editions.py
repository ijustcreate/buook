"""Generate reversible ink plates and source-grounded paragraph boundaries."""
import json,hashlib,re,unicodedata,statistics
from pathlib import Path
from PIL import Image
import pymupdf
from book_art_pipeline import ink_impression
ROOT=Path(__file__).resolve().parent.parent
designs=json.loads((ROOT/'assets/book-designs.json').read_text(encoding='utf8'))
novels=json.loads((ROOT/'assets/starter-novels.json').read_text(encoding='utf8'))+json.loads((ROOT/'assets/classic-library.json').read_text(encoding='utf8'))
inferno=json.loads((ROOT/'assets/inferno-dore.json').read_text(encoding='utf8'))
if isinstance(inferno,list):inferno=inferno[0]
all_designs={**designs,inferno['id']:inferno['design']}
manifest={}
for book_id,design in all_designs.items():
    for number,page in design['pages'].items():
        for figure in page.get('sourceFigures',[]):
            original=figure.get('originalSrc',figure['src'])
            if original in manifest:continue
            with Image.open(ROOT/original) as image:
                treated=ink_impression(image)
                output=ROOT/'assets/book-illustrations/print-ink-v3'/f'{book_id}-{int(number)+1}-{len(manifest)}.webp'
                output.parent.mkdir(parents=True,exist_ok=True);treated.save(output,'WEBP',lossless=True,method=6)
                manifest[original]={'originalSrc':original,'processedSrc':output.relative_to(ROOT).as_posix(),'width':treated.width,'height':treated.height,'recipe':{'version':3,'treatment':'engraved-ink','paper':'transparent-luminance','gridMax':560},'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}
(ROOT/'assets/book-illustration-treatments.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8')

def tokens(text):return re.findall(r'\S+',unicodedata.normalize('NFKC',text).replace('\x00',''))
profiles={}
for book in novels:
    name=book['id'];source=(Path('C:/Users/New User/Desktop/Book working files')/book['source']) if name in ('dracula','frankenstein') else ROOT/'release/library-pdfs'/f'{name}.pdf'
    doc=pymupdf.open(source);paragraphs={};matched=0
    if not book.get('preserveLines'):
        for index,pdf_page in enumerate(doc):
            existing=designs[name]['pages'].get(str(index),{});text=existing.get('body',book['textPages'][index]);words=tokens(text)
            if not words or existing.get('tocRows') or existing.get('titlePage'):continue
            lines=[]
            for block in pdf_page.get_text('dict')['blocks']:
                for line in block.get('lines',[]):
                    value=''.join(span['text'] for span in line['spans']).strip();parts=tokens(value)
                    if parts:lines.append({'words':parts,'x':line['bbox'][0],'y':line['bbox'][1],'h':line['bbox'][3]-line['bbox'][1]})
            if not lines:continue
            # Match exact token sequences to the retained source text. Never
            # rewrite prose, discard words or infer paragraphs from punctuation.
            cursor=0;placed=[]
            for line in lines:
                segment=line['words'];start=None
                for offset in range(cursor,min(len(words),cursor+18)):
                    if words[offset:offset+len(segment)]==segment:start=offset;break
                if start is None:continue
                placed.append({**line,'start':start});cursor=start+len(segment)
            if len(placed)<4:continue
            gaps=[b['y']-a['y'] for a,b in zip(placed,placed[1:]) if 0<b['y']-a['y']<60]
            leading=statistics.median(gaps) if gaps else 14
            left=statistics.median(sorted(p['x'] for p in placed)[:max(1,len(placed)//2)])
            starts=[]
            for previous,line in zip(placed,placed[1:]):
                indent=line['x']-left;gap=line['y']-previous['y']
                if line['start']>0 and (3<indent<28 or leading*1.35<gap<leading*3):starts.append(line['start'])
            if starts:paragraphs[str(index)]={'paragraphStarts':sorted(set(starts)),'textSha256':hashlib.sha256(' '.join(words).encode()).hexdigest()};matched+=1
    profiles[name]={'pages':paragraphs,'sourcePages':book['sourcePages']}
    print(json.dumps({'book':name,'pages':book['sourcePages'],'paragraphPages':matched}),flush=True);doc.close()
(ROOT/'assets/book-composition.json').write_text(json.dumps(profiles,separators=(',',':')),encoding='utf8')
print(json.dumps({'inkPlates':len(manifest),'originalsPreserved':True}),flush=True)
