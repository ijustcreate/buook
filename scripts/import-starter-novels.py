"""Extract the user's public-domain novel PDFs; bundle text, not source PDFs."""
import json
import re
import unicodedata
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).resolve().parent.parent
books = []
for key, title, author, filename, color in [
    ('dracula', 'Dracula', 'Bram Stoker', 'Dracula - Bram Stoker.pdf', '#9b382d'),
    ('frankenstein', 'Frankenstein', 'Mary Shelley', 'frank-a5.pdf', '#31594c'),
]:
    reader = PdfReader(Path('C:/Users/New User/Desktop') / filename)
    pages = []
    for page in reader.pages:
        text = unicodedata.normalize('NFKC', page.extract_text() or '')
        # Keep prose, headings, and paragraph breaks, but not printed folios.
        text = re.sub(r'(?m)^\s*\d+\s*$', '', text)
        text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)
        text = text.replace('\x00', '').strip()
        # Preserve blank source pages so PDF page N remains book page N.
        pages.append(text)
    books.append(dict(id=key, name=title, author=author, outside=color,
                      source=filename, sourcePages=len(reader.pages), textPages=pages))
destination = root / 'assets' / 'starter-novels.json'
destination.write_text(json.dumps(books, ensure_ascii=False), encoding='utf-8')
print(json.dumps([dict(name=b['name'], sourcePages=b['sourcePages'], characters=sum(map(len,b['textPages']))) for b in books]))
