"""Compact, reversible book-illustration derivatives for PDF/HTML importers."""
import hashlib
from collections import deque
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter


def ink_impression(image, max_edge=560):
    """Separate printed ink from paper, retaining tone as translucent warm ink."""
    image=image.convert('RGBA');image.thumbnail((max_edge,max_edge),Image.Resampling.LANCZOS)
    grey=ImageOps.autocontrast(image.convert('L'),cutoff=.4).filter(ImageFilter.UnsharpMask(radius=.65,percent=70,threshold=3))
    w,h=image.size;alpha=[];source_alpha=image.getchannel('A')
    for i,(value,opacity) in enumerate(zip(grey.getdata(),source_alpha.getdata())):
        x,y=i%w,i//w
        coverage=max(0,min(1,(241-value)/225))**1.05
        coverage=round(coverage*15)/15
        edge=min(1,min(x+.5,y+.5,w-x-.5,h-y-.5)/3)
        alpha.append(round(coverage*232*edge*opacity/255))
    result=Image.new('RGBA',(w,h),(46,32,23,0));mask=Image.new('L',(w,h));mask.putdata(alpha);result.putalpha(mask)
    return result


def write_illustration(image, stem, root, *, alt, source):
    stem=Path(stem);stem.parent.mkdir(parents=True,exist_ok=True)
    original=image.convert('RGBA');original.thumbnail((1600,1600),Image.Resampling.LANCZOS)
    original_path=stem.with_name(stem.name+'-original.webp')
    original.save(original_path,'WEBP',quality=92,method=6)
    ink=ink_impression(original);w,h=ink.size
    path=stem.with_name(stem.name+'-ink.webp');ink.save(path,'WEBP',lossless=True,method=6)
    return {'src':path.relative_to(root).as_posix(),'originalSrc':original_path.relative_to(root).as_posix(),
            'processedSrc':path.relative_to(root).as_posix(),'width':w,'height':h,'alt':alt,'source':source,'lazy':True,
            'bytes':path.stat().st_size,'originalBytes':original_path.stat().st_size,
            'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'recipe':{'version':3,'treatment':'engraved-ink','removeWhite':True,'smooth':True,'gridMax':560}}
