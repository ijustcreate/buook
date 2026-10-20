const fs=require('node:fs'),path=require('node:path'),inspect=require('./inspect-fonts.cjs');
const source=process.argv[2]||'C:/Users/New User/Desktop/fonts',root=path.resolve(__dirname,'..');
const groups={public:[],local:[]};
for(const font of inspect(source)){
  // User-supplied prototype collection; retain each file's existing notices.
  const group='public';
  const folder=path.join(root,'assets',group==='public'?'fonts':'local-fonts');fs.mkdirSync(folder,{recursive:true});
  fs.copyFileSync(path.join(source,font.file),path.join(folder,font.file));
  const id=font.file.toLowerCase().replace(/\.(ttf|otf)$/,'').replace(/[^a-z0-9]+/g,'-');
  groups[group].push({...font,id,label:font.family,family:'PBFont-'+id,url:(group==='public'?'assets/fonts/':'assets/local-fonts/')+encodeURIComponent(font.file)});
}
for(const [group,entries] of Object.entries(groups)){
  const folder=path.join(root,'assets',group==='public'?'fonts':'local-fonts');
  fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(entries,null,2));
  fs.writeFileSync(path.join(folder,'FONT-NOTICES.txt'),entries.map(f=>[f.file,f.copyright||'Copyright: not supplied in font metadata.',f.license||'License: not supplied in font metadata; user-provided local font.',f.licenseURL||''].join('\n')).join('\n\n---\n\n'));
}
console.log(JSON.stringify({publicFonts:groups.public.length,localFonts:groups.local.length,total:groups.public.length+groups.local.length}));
