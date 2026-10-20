const fs=require('node:fs'),path=require('node:path');
function inspectFonts(folder){
const results=[];
for(const file of fs.readdirSync(folder).filter(f=>/\.(ttf|otf)$/i.test(f))){
  const bytes=fs.readFileSync(path.join(folder,file)),tables={};
  for(let i=0;i<bytes.readUInt16BE(4);i++){const p=12+i*16;tables[bytes.toString('ascii',p,p+4)]=bytes.readUInt32BE(p+8);}
  const base=tables.name,strings=base+bytes.readUInt16BE(base+4),names={};
  for(let i=0;i<bytes.readUInt16BE(base+2);i++){
    const p=base+6+i*12,platform=bytes.readUInt16BE(p),language=bytes.readUInt16BE(p+4),id=bytes.readUInt16BE(p+6),length=bytes.readUInt16BE(p+8),offset=strings+bytes.readUInt16BE(p+10);
    const raw=Buffer.from(bytes.subarray(offset,offset+length));let text;
    if(platform===0||platform===3){if(raw.length%2)continue;text=raw.swap16().toString('utf16le');}else text=raw.toString('latin1');
    if(!names[id]||language===0x409)names[id]=text;
  }
  results.push({file,family:names[16]||names[1],style:names[17]||names[2],copyright:names[0],license:names[13],licenseURL:names[14],fsType:tables['OS/2']?bytes.readUInt16BE(tables['OS/2']+8):null});
}
return results;
}
module.exports=inspectFonts;
if(require.main===module)console.log(JSON.stringify(inspectFonts(process.argv[2]||'C:/Users/New User/Desktop/fonts'),null,2));
