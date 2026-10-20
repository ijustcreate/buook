"""Extract placed PDF illustrations, retaining originals and compact pixel-ink variants.

Example: python scripts/extract-book-art.py source.pdf --book-id my-edition
For full-page scans, explicitly select illustration plates with --pages 17,18.
"""
import argparse
import hashlib
import json
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium
from book_art_pipeline import write_illustration


def main():
    parser=argparse.ArgumentParser();parser.add_argument('pdf',type=Path);parser.add_argument('--book-id',required=True);parser.add_argument('--pages',default='');args=parser.parse_args()
    if not args.book_id or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.book_id):parser.error('Use a lowercase hyphenated edition ID')
    root=Path(__file__).resolve().parent.parent;selected={int(n)-1 for n in args.pages.split(',') if n.strip()};result={'source':str(args.pdf.resolve()),'sha256':hashlib.sha256(args.pdf.read_bytes()).hexdigest(),'pages':{},'review':[]}
    raster=pdfium.PdfDocument(str(args.pdf))
    with pdfplumber.open(args.pdf) as doc:
        for n,page in enumerate(doc.pages):
            if selected and n not in selected:continue
            figures=[];seen=set()
            for image in page.images:
                box=(max(0,image['x0']),max(0,image['top']),min(page.width,image['x1']),min(page.height,image['bottom']))
                if box in seen:continue
                seen.add(box);x0,y0,x1,y1=box
                if x1-x0<12 or y1-y0<12:continue
                full=(x1-x0)*(y1-y0)/(page.width*page.height)>.8
                if full and not selected and len(page.chars)>80:
                    result['review'].append({'page':n+1,'reason':'Full-page scan: choose illustration plates or supply reviewed crops; do not duplicate text as an illustration.'});continue
                surface=raster[n].render(scale=1.5).to_pil();crop=surface.crop(tuple(round(v*1.5) for v in box))
                figure=write_illustration(crop,root/'assets'/'book-illustrations'/args.book_id/f'page-{n+1}-{len(figures)+1}',root,alt=f'{args.book_id}, illustration on source page {n+1}',source=str(args.pdf.name))
                figure.update(sourcePage=n+1,sourceBox={'x':x0/page.width,'y':y0/page.height,'w':(x1-x0)/page.width,'h':(y1-y0)/page.height});figures.append(figure)
            if figures:result['pages'][str(n)]=figures
    raster.close();output=root/'assets'/'book-illustrations'/args.book_id/'manifest.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False),encoding='utf8');print(json.dumps({'manifest':str(output),'pagesWithArt':len(result['pages']),'needsReview':len(result['review'])}))


if __name__=='__main__':main()
