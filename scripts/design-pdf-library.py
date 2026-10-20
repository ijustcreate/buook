"""Recover book semantics, native TOC destinations and placed illustrations.

Produces read-only design metadata; never repaginates or modifies source PDFs.
"""
import json
import re
import statistics
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent


def design_book(book, filename):
    reader = PdfReader(filename)
    design = {'pages': {}, 'contents': [], 'format': {
        'widthPt': statistics.median(float(p.mediabox.width) for p in reader.pages),
        'heightPt': statistics.median(float(p.mediabox.height) for p in reader.pages)}}
    current_volume = ''

    def outlines(items, parent=''):
        nonlocal current_volume
        for item in items:
            if isinstance(item, list):
                outlines(item, current_volume)
                continue
            target = reader.get_destination_page_number(item)
            label = str(item.title).strip()
            if target is None or label in ('Cover Page', 'Title Page', 'Colophon', 'Contents') or label.casefold() == book['name'].casefold():
                continue
            if label.startswith(('Volume ', 'Act ')) or label in ('Inferno', 'Purgatorio', 'Paradiso'):
                current_volume = label
            qualified = parent + ' - ' + label if parent and label != parent else label
            design['contents'].append({'page': target, 'label': qualified, 'sourceLabel': label})
    outlines(reader.outline)
    if not design['contents']:
        design['contents'] = [{'page': c['page'], 'label': c['title'], 'sourceLabel': c['title']}
                              for c in book.get('chapters', [])]

    page_refs = {p.indirect_reference.idnum: i for i, p in enumerate(reader.pages)}

    def target_page(dest):
        if isinstance(dest, str):
            named = reader.named_destinations.get(dest)
            return reader.get_destination_page_number(named) if named else None
        if isinstance(dest, list) and dest:
            return page_refs.get(getattr(dest[0], 'idnum', None))
        return None

    doc = pdfplumber.open(filename)
    raster = None
    image_count = 0
    for index, page in enumerate(reader.pages):
        data = {}
        text = book['textPages'][index]
        if book['id'] == 'divine-comedy' and any(c['title'] == 'Appendix' and c['page'] <= index for c in book.get('chapters', [])):
            data['preserveLines'] = False
        # Title and author belong in an intentional centered title composition.
        title_index = 1 if book['id'] == 'dracula' else 0
        if index == title_index and len(text) < 600:
            data.update(role='title', titlePage={'title': book['name'], 'author': book['author']})
        # Remove isolated Roman folios from otherwise blank verso pages.
        if re.fullmatch(r'[ivxlcdm]+', text.strip()):
            data['body'] = ''
        lines=text.splitlines()
        if lines and (re.match(r'^\s*(?:\d+|[ivxlcdm]+)\s+(?:Chapter|CHAPTER|PREFACE)\b', lines[0])
                      or re.match(r'^\s*(?:Chapter|CHAPTER|PREFACE).*\s+(?:\d+|[ivxlcdm]+)\s*$', lines[0])):
            data['body']='\n'.join(lines[1:]).strip()
        body=data.get('body', text)
        first=body.splitlines()[0].strip() if body.strip() else ''
        if re.fullmatch(r'(?:Chapter|CHAPTER|Canto|Act)\s+(?:[IVXLCDM]+|\d+)', first):
            data['chapterOpening']=first
        rows = []
        for ref in page.get('/Annots', []):
            link = ref.get_object()
            action = link.get('/A', {})
            if link.get('/Subtype') != '/Link' or (action and action.get('/S') != '/GoTo'):
                continue
            target = target_page(action.get('/D', link.get('/Dest')))
            if target is None:
                continue
            x0, y0, x1, y1 = map(float, link['/Rect'])
            top, bottom = float(page.mediabox.height)-y1, float(page.mediabox.height)-y0
            words = [w for w in doc.pages[index].extract_words()
                     if top-3 <= (w['top']+w['bottom'])/2 <= bottom+3]
            if not words:
                continue
            line = ' '.join(w['text'] for w in sorted(words, key=lambda w: w['x0']))
            match = re.match(r'(.+?)\s+([ivxlcdm]+|\d+)\s*$', line, re.I)
            label = match[1] if match else line
            folio = match[2] if match else str(target+1)
            if any(r['target'] == target and r['label'] == label for r in rows):
                continue
            rows.append({'label': label, 'target': target, 'folio': folio,
                         'depth': 0 if label.startswith(('Volume ', 'Act ')) else 1})
        # Only actual contents pages become navigation; other internal links stay text.
        if rows and (index < 8 or text.lstrip().lower().startswith('contents')):
            data.update(role='contents', tocRows=rows, tocTitle='Contents' if 'Contents' in text else 'Contents - continued')

        # Inspect placed image resources rather than silently discarding art.
        # Skip new PDF publisher covers/colophons, not the user's original PDFs.
        resource_ref=page.get('/Resources')
        resources = resource_ref.get_object() if resource_ref else {}
        xobjects = resources.get('/XObject', {}).get_object() if resources.get('/XObject') else {}
        has_image = any(obj.get_object().get('/Subtype') == '/Image' for obj in xobjects.values())
        if has_image and not (book['id'] not in ('dracula', 'frankenstein') and index < 3):
            figures = []
            for image in doc.pages[index].images:
                x0, x1 = max(0, image['x0']), min(doc.pages[index].width, image['x1'])
                top, bottom = max(0, image['top']), min(doc.pages[index].height, image['bottom'])
                if x1-x0 < 12 or bottom-top < 12:
                    continue
                if raster is None:
                    raster = pdfium.PdfDocument(str(filename))
                surface = raster[index].render(scale=1.5).to_pil()
                crop = surface.crop((round(x0*1.5), round(top*1.5), round(x1*1.5), round(bottom*1.5)))
                path = ROOT/'assets'/'book-illustrations'/f"{book['id']}-{index+1}-{len(figures)+1}.png"
                path.parent.mkdir(parents=True, exist_ok=True)
                crop.save(path)
                figures.append({'src': path.relative_to(ROOT).as_posix(), 'width': crop.width, 'height': crop.height,
                                'alt': f"{book['name']}, source illustration on page {index+1}"})
                image_count += 1
            if figures:
                data['sourceFigures'] = figures
        if data:
            design['pages'][str(index)] = data
    doc.close()
    if raster:
        raster.close()
    return design, image_count


if __name__ == '__main__':
    originals = json.loads((ROOT/'assets/starter-novels.json').read_text(encoding='utf8'))
    classics = json.loads((ROOT/'assets/classic-library.json').read_text(encoding='utf8'))
    all_designs = {}
    for book in originals+classics:
        if book['id'] in ('dracula', 'frankenstein'):
            filename = Path('C:/Users/New User/Desktop/Book working files')/book['source']
        else:
            filename = ROOT/'release/library-pdfs'/f"{book['id']}.pdf"
        design, count = design_book(book, filename)
        all_designs[book['id']] = design
        print(json.dumps({'book': book['id'], 'designedPages': len(design['pages']),
                          'contents': len(design['contents']), 'illustrations': count}), flush=True)
    (ROOT/'assets/book-designs.json').write_text(json.dumps(all_designs, ensure_ascii=False), encoding='utf8')
