"""Compact, reversible book-illustration derivatives for PDF/HTML importers."""
import hashlib
from collections import deque
from pathlib import Path
from PIL import Image


def write_illustration(image, stem, root, *, alt, source):
    stem=Path(stem);stem.parent.mkdir(parents=True,exist_ok=True)
    original=image.convert('RGBA');original.thumbnail((1600,1600),Image.Resampling.LANCZOS)
    original_path=stem.with_name(stem.name+'-original.webp')
    original.save(original_path,'WEBP',quality=92,method=6)
    ink=original.copy();ink.thumbnail((480,480),Image.Resampling.LANCZOS)
    pixels=ink.load();w,h=ink.size;seen=set();queue=deque()
    border=[min(pixels[x,y][:3]) for x,y in ([(x,0) for x in range(w)]+[(x,h-1) for x in range(w)]+[(0,y) for y in range(h)]+[(w-1,y) for y in range(h)])]
    white_cutoff=max(208,min(240,sorted(border)[int(len(border)*.9)]-8))
    def add(x,y):
        if not (0<=x<w and 0<=y<h) or (x,y) in seen:return
        seen.add((x,y));r,g,b,a=pixels[x,y]
        if a<8 or min(r,g,b)>white_cutoff and max(r,g,b)-min(r,g,b)<32:queue.append((x,y))
    for x in range(w):add(x,0);add(x,h-1)
    for y in range(h):add(0,y);add(w-1,y)
    while queue:
        x,y=queue.popleft();r,g,b,a=pixels[x,y];pixels[x,y]=(r,g,b,0)
        for X,Y in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):add(X,Y)
    grey=ink.convert('L');levels=[round(max(0,min(1,(v/255-.12)/.76))**.9*7)/7 for v in range(256)]
    ink=Image.merge('RGBA',(grey.point([round(37+v*209) for v in levels]),grey.point([round(25+v*202) for v in levels]),grey.point([round(19+v*158) for v in levels]),ink.getchannel('A')))
    path=stem.with_name(stem.name+'-ink.webp');ink.save(path,'WEBP',quality=90,method=6)
    return {'src':path.relative_to(root).as_posix(),'originalSrc':original_path.relative_to(root).as_posix(),
            'processedSrc':path.relative_to(root).as_posix(),'width':w,'height':h,'alt':alt,'source':source,'lazy':True,
            'bytes':path.stat().st_size,'originalBytes':original_path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'recipe':{'version':2,'treatment':'pixel-ink','removeWhite':True,'smooth':True,'gridMax':480,'whiteCutoff':white_cutoff}}
