"""Download source PDFs locally and bundle their public-domain text page-for-page."""
import concurrent.futures
import hashlib
import json
import re
import unicodedata
import urllib.request
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    ('dorian-gray', 'The Picture of Dorian Gray', 'Oscar Wilde', '#533761', 'https://www.globalgreyebooks.com/ebooks/oscar-wilde_picture-of-dorian-gray.pdf'),
    ('peter-pan', 'Peter Pan (Peter and Wendy)', 'J. M. Barrie', '#326853', 'https://www.globalgreyebooks.com/ebooks/james-m-barrie_peter-pan.pdf'),
    ('divine-comedy', 'The Divine Comedy', 'Dante Alighieri', '#8c492e', 'https://www.globalgreyebooks.com/ebooks2/dante-alighieri_divine-comedy.pdf'),
    ('time-machine', 'The Time Machine', 'H. G. Wells', '#355776', 'https://www.globalgreyebooks.com/ebooks/h-g-wells_time-machine.pdf'),
    ('common-sense', 'Common Sense', 'Thomas Paine', '#80623a', 'https://loveman.sdsu.edu/docs/1776ThomasPaine.pdf'),
    ('secret-garden', 'The Secret Garden', 'Frances Hodgson Burnett', '#486d36', 'https://www.globalgreyebooks.com/ebooks/frances-hodgson-burnett_secret-garden.pdf'),
    ('romeo-juliet', 'Romeo and Juliet', 'William Shakespeare', '#813c50', 'https://www.globalgreyebooks.com/ebooks/william-shakespeare_romeo-and-juliet.pdf'),
]


def extract(source):
    key, name, author, color, url = source
    directory = ROOT / 'release' / 'library-pdfs'
    directory.mkdir(parents=True, exist_ok=True)
    filename = directory / (key + '.pdf')
    if not filename.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'PixelBook/1.0 (personal classic library)'})
        with urllib.request.urlopen(request, timeout=90) as response:
            data = response.read()
        if not data.startswith(b'%PDF'):
            raise ValueError('Not a PDF: ' + url)
        filename.write_bytes(data)
    reader = PdfReader(filename)
    pages = []
    for index, page in enumerate(reader.pages):
        text = unicodedata.normalize('NFKC', page.extract_text() or '')
        text = re.split(r"\*{5,}\s*\n\s*I'm Julie", text, maxsplit=1)[0]
        # Do not reproduce the PDF publisher's branding in the in-app edition.
        # Keep those source pages blank instead of changing page numbers.
        if key != 'common-sense' and index == 2:
            text = ''
        else:
            text = '\n'.join(line for line in text.splitlines()
                             if not re.search(r'global\s*grey|globalgreyebooks\.com', line, re.I))
        text = re.sub(r'(?m)^\s*\d+\s*$', '', text)
        text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)
        pages.append(text.replace('\x00', '').strip())
    chapters = []

    def visit(outline):
        for item in outline:
            if isinstance(item, list):
                visit(item)
                continue
            number = reader.get_destination_page_number(item)
            title = str(item.title).strip()
            if number is not None and 0 <= number < len(pages) and title and title not in ('Cover Page', 'Title Page', 'Colophon', 'Contents'):
                chapters.append(dict(page=number, title=title))
    visit(reader.outline)
    if key == 'common-sense':
        chapters = [dict(page=0, title='Introduction and the Origin of Government'),
                    dict(page=3, title='Of Monarchy and Hereditary Succession'),
                    dict(page=8, title='Thoughts on the Present State of American Affairs'),
                    dict(page=16, title='Of the Present Ability of America'),
                    dict(page=22, title='Appendix to the Third Edition')]
    if key == 'divine-comedy':
        part = ''
        for chapter in chapters:
            if chapter['title'] in ('Inferno', 'Purgatorio', 'Paradiso'):
                part = chapter['title']
            elif chapter['title'].startswith('Canto '):
                chapter['title'] = part + ' - ' + chapter['title']
    book = dict(id=key, name=name, author=author, outside=color,
                source=url, sourcePages=len(pages), textPages=pages, chapters=chapters,
                sourceSha256=hashlib.sha256(filename.read_bytes()).hexdigest())
    if key == 'divine-comedy':
        book['translator'] = 'Henry Wadsworth Longfellow'
    if key in ('divine-comedy', 'romeo-juliet'):
        book['preserveLines'] = True
    return book


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        books = list(pool.map(extract, SOURCES))
    destination = ROOT / 'assets' / 'classic-library.json'
    destination.write_text(json.dumps(books, ensure_ascii=False), encoding='utf-8')
    print(json.dumps([dict(name=b['name'], pages=b['sourcePages'], chapters=len(b['chapters']),
                           characters=sum(map(len, b['textPages']))) for b in books], ensure_ascii=False))
