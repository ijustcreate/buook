"""Import only Cary/Dore's Inferno from Gutenberg 8800; never alter other editions."""
import concurrent.futures
import hashlib
import io
import json
import re
import ssl
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from book_art_pipeline import write_illustration

ROOT=Path(__file__).resolve().parent.parent
URL='https://www.gutenberg.org/cache/epub/8800/pg8800-images.html'


def main():
    context=ssl.create_default_context()
    # Honour this Windows host's installed CA roots, including its HTTPS proxy.
    if hasattr(ssl,'enum_certificates'):
        for store in ('ROOT','CA'):
            for certificate,encoding,_ in ssl.enum_certificates(store):
                if encoding=='x509_asn':context.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(certificate))
    cache=ROOT/'release'/'inferno-source-images';cache.mkdir(parents=True,exist_ok=True)
    html_path=ROOT/'release'/'inferno-gutenberg.html'
    if not html_path.exists():html_path.write_bytes(urllib.request.urlopen(URL,context=context,timeout=60).read())
    html=html_path.read_bytes();soup=BeautifulSoup(html,'html.parser')
    chapters=[]
    for n in range(1,35):
        anchor=soup.find(id=f'cantoI.{n}')
        if not anchor:raise ValueError(f'Missing Inferno canto {n}')
        chapters.append(anchor.find_parent('div',class_='chapter'))
    images={image['src'] for chapter in chapters for image in chapter.find_all('img')}
    def acquire(src):
        url=urllib.parse.urljoin(URL,src);local=cache/Path(src).name
        if not local.exists():
            data=urllib.request.urlopen(url,context=context,timeout=60).read();local.write_bytes(data)
        with Image.open(local) as image:
            return src,write_illustration(image,ROOT/'assets'/'book-illustrations'/'inferno-dore'/Path(src).stem,ROOT,
                alt='Gustave Doré, Inferno illustration '+Path(src).stem,source=url)
    figures={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for src,figure in pool.map(acquire,sorted(images)):figures[src]=figure;print('Illustration '+src,flush=True)
    text_pages=['Inferno\nDante Alighieri\nHenry Francis Cary · Gustave Doré','','Contents','Contents - continued']
    pages={'0':{'role':'title','titlePage':{'title':'Inferno','author':'Dante Alighieri · translated by H. F. Cary\nIllustrated by Gustave Doré'}}}
    contents=[];total_lines=0
    for n,chapter in enumerate(chapters,1):
        heading=chapter.find('h2').get_text(' ',strip=True).title();start=len(text_pages);contents.append({'page':start,'label':heading,'sourceLabel':heading})
        first=True
        for child in chapter.children:
            if not getattr(child,'name',None):continue
            image=child.find('img') if child.name=='div' else None
            if image:
                number=len(text_pages);text_pages.append(heading if first else '')
                data={'role':'section' if first else 'body','sourceFigures':[figures[image['src']]],'body':heading if first else ''}
                if first:data.update(chapterOpening=heading,tocLabel=heading)
                pages[str(number)]=data;first=False
            elif child.name=='p':
                lines=[line.strip() for line in child.get_text('\n').splitlines() if line.strip()]
                total_lines+=len(lines)
                for offset in range(0,len(lines),22):
                    number=len(text_pages);body='\n'.join(lines[offset:offset+22]);text_pages.append((heading+'\n' if first else '')+body)
                    if first:pages[str(number)]={'role':'section','chapterOpening':heading,'tocLabel':heading}
                    first=False
        if first:raise ValueError('Empty canto '+str(n))
    for index in (2,3):
        rows=contents[(index-2)*17:(index-1)*17]
        pages[str(index)]={'role':'contents','tocTitle':'Contents' if index==2 else 'Contents - continued',
                           'tocRows':[{'label':row['label'],'target':row['page'],'folio':str(row['page']+1),'depth':0} for row in rows]}
    novel={'id':'inferno-dore','name':'Inferno · Illustrated','author':'Dante Alighieri · H. F. Cary','outside':'#70372d',
           'source':URL,'sourcePages':len(text_pages),'textPages':text_pages,'preserveLines':True,
           'chapters':[{'page':c['page'],'title':c['label']} for c in contents],
           'design':{'format':{'widthPt':553,'heightPt':734},'contents':contents,'pages':pages},
           'provenance':{'url':URL,'htmlSha256':hashlib.sha256(html).hexdigest(),'scope':'Inferno only; 34 cantos',
                         'pagination':'New illustrated HTML edition; 22 verse lines per text page, plates in source sequence.',
                         'sourceScanAlternative':'infernotranslate00dantuoft_bw.pdf','illustrations':len(figures),'verseLines':total_lines}}
    (ROOT/'assets'/'inferno-dore.json').write_text(json.dumps([novel],ensure_ascii=False),encoding='utf8')
    print(json.dumps({'pages':len(text_pages),'cantos':len(contents),'illustrations':len(figures),'verseLines':total_lines}),flush=True)


if __name__=='__main__':main()
