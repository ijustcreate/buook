'use strict';

// A small, dependency-free 3D renderer. Physical boards, paper and spine share
// world coordinates and one perspective camera; the open renderer is separate.
class ClosedBooks3D {
  static thickness(pages){return 12+Math.min(200,Math.max(0,Number(pages)||28)*.12);}
  constructor({canvas, context, materials, changed, open, storage=localStorage}) {
    Object.assign(this,{canvas,ctx:context,materials,changed,open,storage});
    this.yaw=-Math.PI/2;this.pitch=.43;this.roll=Math.PI/2;this.distance=1050;this.models=[];
    this.selected=null;this.mode='orbit';this.table=false;this.faces=[];this.gesture=null;
    try {this.layout=JSON.parse(storage.getItem('pixel-book-table-v1')||'{}');} catch {this.layout={};}
    if(!this.layout||Array.isArray(this.layout)||typeof this.layout!=='object')this.layout={};
  }
  setBooks(books,table=false,selected=null,shelfOnly=false) {
    this.table=table;
    this.shelfOnly=shelfOnly;
    this.models=books.map((book,i)=>{
      const old=table?this.layout[book.id]:null;
      const finite=(key,fallback)=>Number.isFinite(old?.[key])?Math.max(-2000,Math.min(2000,old[key])):fallback;
      return {book,id:book.id,x:finite('x',(i%3-1)*380),z:finite('z',Math.floor(i/3)*500),
        y:finite('y',0),angle:finite('angle',i%2?.05:-.04),shelved:old?.location==='shelf',shelfOrder:finite('shelfOrder',i),height:ClosedBooks3D.thickness(book.pageCount),width:450*bookFormatRatio(book),length:450};
    });
    if(!table&&this.models[0])Object.assign(this.models[0],{x:0,z:0,y:0,angle:0});
    this.selected=this.models.find(m=>m.id===selected)||this.models[0]||null;
    this.placeShelf();this.settle();this.reset();
  }
  reset(back=false) {this.center=null;this.yaw=this.shelfOnly?0:this.table?-.35:-Math.PI/2;this.pitch=this.shelfOnly?.32:this.table?.85:(back?-.43:.43);this.roll=this.table?0:Math.PI/2;this.distance=this.shelfOnly?Math.max(1500,(this.shelfWidth||1150)*1.3):this.table?3200:1050;this.gesture=null;this.changed();}
  target() {
    if(this.center)return this.center;
    if(!this.models.length)return {x:0,y:0,z:0};
    if(this.shelfOnly)return this.center={x:0,y:280,z:-850};
    if(this.table)return this.center={x:0,y:170,z:300};
    const bounds=this.models;
    return this.center={x:(Math.min(...bounds.map(m=>m.x))+Math.max(...bounds.map(m=>m.x)))/2,
      y:this.table?40:(this.models[0].height/2),z:(Math.min(...bounds.map(m=>m.z))+Math.max(...bounds.map(m=>m.z)))/2};
  }
  basis() {
    const c=Math.cos(this.yaw),s=Math.sin(this.yaw),p=Math.sin(this.pitch),q=Math.cos(this.pitch);
    return {right:{x:c,y:0,z:-s},up:{x:-s*p,y:q,z:-c*p},toward:{x:s*q,y:p,z:c*q}};
  }
  dot(a,b) {return a.x*b.x+a.y*b.y+a.z*b.z;}
  project(p) {
    const b=this.basis(),t=this.dragTarget||this.target(),r={x:p.x-t.x,y:p.y-t.y,z:p.z-t.z};
    const depth=this.distance-this.dot(r,b.toward),scale=1000/Math.max(80,depth);
    const x=this.dot(r,b.right)*scale,y=-this.dot(r,b.up)*scale,c=Math.cos(this.roll||0),s=Math.sin(this.roll||0);
    return {x:500+x*c-y*s,y:(this.table?345:332)+x*s+y*c,depth};
  }
  world(m,x,y,z) {
    if((m.shelved||this.shelfOnly)&&this.table)return{x:m.shelfX+y-m.height/2,y:24+m.length/2-z,z:-730-x-m.width/2};
    const c=Math.cos(m.angle),s=Math.sin(m.angle);return{x:m.x+x*c+z*s,y:m.y+y,z:m.z-x*s+z*c};
  }
  local(m,p){
    if((m.shelved||this.shelfOnly)&&this.table)return{x:-730-p.z-m.width/2,y:p.x-m.shelfX+m.height/2,z:24+m.length/2-p.y};
    const c=Math.cos(m.angle),s=Math.sin(m.angle),x=p.x-m.x,z=p.z-m.z;return{x:x*c-z*s,y:p.y-m.y,z:x*s+z*c};
  }
  normal(m,n) {
    if((m.shelved||this.shelfOnly)&&this.table)return{x:n[1],y:-n[2],z:-n[0]};
    return this.world({...m,x:0,y:0,z:0},...n);
  }
  placeShelf(){
    const books=this.models.filter(m=>m.shelved||this.shelfOnly).sort((a,b)=>a.shelfOrder-b.shelfOrder||a.id.localeCompare(b.id));
    const span=books.reduce((n,m)=>n+m.height+10,0);let x=-span/2;
    for(const m of books){m.shelfX=x+m.height/2;x+=m.height+10;}
    this.shelfWidth=Math.max(this.shelfOnly?600:1150,span+100);
  }
  moveSelected(toShelf){
    const m=this.selected;if(!this.table||!m)return;
    m.shelved=toShelf;
    if(toShelf)m.shelfOrder=Math.max(0,...this.models.map(b=>b.shelfOrder||0))+1;
    else{
      const slots=Array.from({length:30},(_,i)=>({x:(i%5-2)*350,z:Math.floor(i/5)*470-400}));
      const slot=slots.find(s=>!this.models.some(b=>b!==m&&!b.shelved&&this.overlapping({...m,...s,angle:0},b)))||{x:0,z:700};
      Object.assign(m,slot,{y:0,angle:0});
    }
    this.placeShelf();this.settle();this.save();this.changed();
  }
  ground(point,y=0) {
    const b=this.basis(),t=this.dragTarget||this.target();
    const eye={x:t.x+b.toward.x*this.distance,y:t.y+b.toward.y*this.distance,z:t.z+b.toward.z*this.distance};
    const c=Math.cos(this.roll||0),s=Math.sin(this.roll||0),dx=point.x-500,dy=point.y-(this.table?345:332);
    const x=(dx*c+dy*s)/1000,v=(dx*s-dy*c)/1000;
    const ray={x:-b.toward.x+x*b.right.x+v*b.up.x,y:-b.toward.y+x*b.right.y+v*b.up.y,z:-b.toward.z+x*b.right.z+v*b.up.z};
    if(Math.abs(ray.y)<.05)return null;
    const k=(y-eye.y)/ray.y;
    return k>0?{x:eye.x+k*ray.x,z:eye.z+k*ray.z}:null;
  }
  overlapping(a,b) {
    // Oriented rectangle SAT, with a small inset so edge touches do not stack.
    const corners=m=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>this.world(m,x*(m.width/2-1),0,z*(m.length/2-1)));
    const ac=corners(a),bc=corners(b);
    for(const angle of [a.angle,b.angle])for(const offset of [0,Math.PI/2]){
      const x=Math.cos(angle+offset),z=-Math.sin(angle+offset);
      const aa=ac.map(p=>p.x*x+p.z*z),bb=bc.map(p=>p.x*x+p.z*z);
      if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;
    }
    return true;
  }
  settle(last=null) {
    const ordered=this.models.filter(m=>m!==last&&!m.shelved).sort((a,b)=>a.y-b.y||this.models.indexOf(a)-this.models.indexOf(b));
    if(last&&!last.shelved)ordered.push(last);
    const placed=[];
    for(const model of ordered){model.y=Math.max(0,...placed.filter(other=>this.overlapping(model,other)).map(other=>other.y+other.height));placed.push(model);}
  }
  save() {
    if(!this.table)return;
    for(const m of this.models)this.layout[m.id]={x:m.x,y:m.y,z:m.z,angle:m.angle,location:m.shelved?'shelf':'table',shelfOrder:m.shelfOrder};
    try{this.storage.setItem('pixel-book-table-v1',JSON.stringify(this.layout));}catch{}
  }
  arrange(stack=false) {
    this.models.filter(m=>!m.shelved).forEach((m,i)=>Object.assign(m,{x:stack?0:(i%3-1)*380,z:stack?0:Math.floor(i/3)*500,y:stack?i*100:0,angle:stack?(i%2?.05:-.05):0}));
    this.settle();this.save();this.reset();
  }
  rotateBook(amount) {if(!this.selected||this.selected.shelved)return;this.selected.angle+=amount;this.settle(this.selected);this.save();this.changed();}
  hitFace(p) {
    for(const face of [...this.faces].reverse()){
      if(!face.model)continue;
      const points=face.screen;let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      if(inside&&this.opaqueFaceHit(face,p))return face;
    }
    return null;
  }
  hit(p){return this.hitFace(p)?.model||null;}
  opaqueFaceHit(face,point) {
    if(!face.triUV)return true;
    const [a,b,c]=face.screen,det=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const u=((point.x-a.x)*(c.y-a.y)-(point.y-a.y)*(c.x-a.x))/det,v=((b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x))/det;
    this.alphaCache??=new WeakMap();let data=this.alphaCache.get(face.texture);
    if(!data){const c=document.createElement('canvas');c.width=face.texture.width;c.height=face.texture.height;const p=c.getContext('2d');p.drawImage(face.texture,0,0);data=p.getImageData(0,0,c.width,c.height).data;this.alphaCache.set(face.texture,data);}
    const [A,B,C]=face.triUV,x=Math.floor(A.x+u*(B.x-A.x)+v*(C.x-A.x)),y=Math.floor(A.y+u*(B.y-A.y)+v*(C.y-A.y));
    return x>=0&&y>=0&&x<face.texture.width&&y<face.texture.height&&data[(y*face.texture.width+x)*4+3]>=64;
  }
  pointerDown(p) {
    const face=this.hitFace(p),hit=face?.model;if(hit)this.selected=hit;
    this.dragTarget=this.target();
    const move=this.table&&!this.shelfOnly&&this.mode==='move'&&hit&&!hit.shelved;
    this.gesture={p,yaw:this.yaw,pitch:this.pitch,move,hit,bookmarkPage:face?.bookmarkPage,moved:false,start:move?this.ground(p,hit.y+hit.height):null,x:hit?.x,z:hit?.z};
    this.changed();return true;
  }
  pointerMove(p) {
    const g=this.gesture;if(!g)return;
    if(Math.hypot(p.x-g.p.x,p.y-g.p.y)>4)g.moved=true;
    if(g.move&&g.start){
      const target=this.ground(p,g.hit.y+g.hit.height);
      if(target){g.hit.x=Math.max(-1800,Math.min(1800,g.x+target.x-g.start.x));g.hit.z=Math.max(-1800,Math.min(1800,g.z+target.z-g.start.z));}
    }else{
      this.orbitBy(p.x-g.p.x,p.y-g.p.y,g);
    }
    this.changed();
  }
  orbitBy(dx,dy,start=this){
    const c=Math.cos(this.roll||0),s=Math.sin(this.roll||0);
    const direction=this.table?1:-1;
    this.yaw=start.yaw+direction*(-dx*c+dy*s)*.008;
    this.pitch=Math.max(this.table?.14:-1.48,Math.min(1.48,start.pitch-direction*(-dx*s+dy*c)*.006));
  }
  pointerUp(cancel=false) {
    const g=this.gesture;if(!g)return;
    if(g.move){if(cancel)Object.assign(g.hit,{x:g.x,z:g.z});this.settle(cancel?null:g.hit);this.save();}
    this.gesture=null;this.dragTarget=null;this.changed();
    if(!cancel&&!g.moved&&Number.isInteger(g.bookmarkPage))this.open?.(g.bookmarkPage);
  }
  zoom(delta) {this.distance=Math.max(650,Math.min(3400,this.distance*Math.exp(delta*.001)));this.changed();}
  poly(points,color,alpha=1) {
    const p=this.ctx;p.save();p.globalAlpha*=alpha;p.beginPath();points.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.fillStyle=color;p.fill();p.restore();
  }
  textured(face) {
    this.projectedModel=face.model;
    const {ctx:p}=this;
    const alphaArt=face.kind==='cover'||face.kind==='spine';
    const light={x:-.3,y:.86,z:.42},shade=(.08+.23*(1-Math.max(0,this.dot(face.normal,light))))*(this.lightStrength??1);
    const texture=alphaArt?this.shadedTexture(face.texture,shade):face.texture;
    if(!alphaArt)this.poly(face.screen,face.color);
    if(texture&&face.triUV)this.triangle(texture,face.triUV,face.screen);
    else if(texture){
      const b=face.uv||{x:0,y:0,w:texture.width,h:texture.height};
      const steps=face.kind==='cover'?8:4;
      const at=(u,v)=>{
        const [a,c,d,e]=face.world;
        return {x:(1-v)*((1-u)*a.x+u*c.x)+v*((1-u)*e.x+u*d.x),
          y:(1-v)*((1-u)*a.y+u*c.y)+v*((1-u)*e.y+u*d.y),z:(1-v)*((1-u)*a.z+u*c.z)+v*((1-u)*e.z+u*d.z)};
      };
      for(let row=0;row<steps;row++)for(let col=0;col<steps;col++){
        const u=col/steps,v=row/steps,U=(col+1)/steps,V=(row+1)/steps;
        const src=[[u,v],[U,v],[U,V],[u,V]].map(([x,y])=>({x:b.x+x*b.w,y:b.y+y*b.h}));
        const dst=[[u,v],[U,v],[U,V],[u,V]].map(([x,y])=>this.project(at(x,y)));
        this.triangle(texture,[src[0],src[1],src[2]],[dst[0],dst[1],dst[2]]);
        this.triangle(texture,[src[0],src[2],src[3]],[dst[0],dst[2],dst[3]]);
      }
    }
    if(face.kind==='bookmark'||alphaArt)return;
    this.poly(face.screen,'#080b10',shade);
    p.save();p.strokeStyle='rgba(0,0,0,.35)';p.lineWidth=.7;p.beginPath();face.screen.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.stroke();p.restore();
  }
  shadedTexture(texture,shade){
    if(!texture)return texture;
    this.shades??=new WeakMap();let cache=this.shades.get(texture);if(!cache){cache=new Map();this.shades.set(texture,cache);}
    const bucket=Math.round(shade*32);if(!bucket)return texture;if(cache.has(bucket))return cache.get(bucket);
    const result=document.createElement('canvas');result.width=texture.width;result.height=texture.height;
    const p=result.getContext('2d');p.drawImage(texture,0,0);p.globalCompositeOperation='source-atop';p.fillStyle=`rgba(8,11,16,${bucket/32})`;p.fillRect(0,0,result.width,result.height);
    if(cache.size>=6)cache.delete(cache.keys().next().value);cache.set(bucket,result);return result;
  }
  triangle(image,src,dst) {
    const [a,b,c]=src,[A,B,C]=dst,p=this.ctx;
    const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<1e-9)return;
    const u=(B.x-A.x)*(c.y-a.y)-(C.x-A.x)*(b.y-a.y),v=(C.x-A.x)*(b.x-a.x)-(B.x-A.x)*(c.x-a.x);
    const s=(B.y-A.y)*(c.y-a.y)-(C.y-A.y)*(b.y-a.y),t=(C.y-A.y)*(b.x-a.x)-(B.y-A.y)*(c.x-a.x);
    p.save();p.beginPath();p.moveTo(A.x,A.y);p.lineTo(B.x,B.y);p.lineTo(C.x,C.y);p.closePath();p.clip();
    p.transform(u/det,s/det,v/det,t/det,A.x-(u*a.x+v*a.y)/det,A.y-(s*a.x+t*a.y)/det);p.drawImage(image,0,0);p.restore();
  }
  draw() {
    const p=this.ctx;this.faces=[];this.projectedModel=null;
    const target=this.dragTarget||this.target();
    // Floor and contact shadows establish scale without flattening the books.
    if(this.table&&!this.shelfOnly){
      const floor=[[-1400,-1200],[1400,-1200],[1400,1700],[-1400,1700]].map(([x,z])=>this.project({x:x+target.x,y:-3,z:z+target.z}));
      this.poly(floor,'#182023',.5*(this.floorOpacity??1));
      for(const m of this.models.filter(m=>!m.shelved)){const outline=[];for(let i=0;i<40;i++){const a=i*Math.PI/20;outline.push(this.project(this.world({...m,y:0},Math.cos(a)*210,-1,Math.sin(a)*285)));}this.poly(outline,'#000',.30*(this.floorOpacity??1));}
    }else if(!this.shelfOnly){p.save();p.globalAlpha*=this.floorOpacity??1;p.fillStyle='rgba(0,0,0,.35)';p.beginPath();p.ellipse(500,560,105,10,0,0,Math.PI*2);p.fill();p.restore();}
    const basis=this.basis(),eye={x:target.x+basis.toward.x*this.distance,y:target.y+basis.toward.y*this.distance,z:target.z+basis.toward.z*this.distance};
    if(this.table){
      const box=(x,y,z,w,h,d,color)=>{
        const add=(vertices,normal)=>{
          const world=vertices.map(([a,b,c])=>({x:x+a,y:y+b,z:z+c}));
          const center={x:x+w/2,y:y+h/2,z:z+d/2};if(this.dot(normal,{x:eye.x-center.x,y:eye.y-center.y,z:eye.z-center.z})<=0)return;
          const screen=world.map(p=>this.project(p));if(screen.some(p=>p.depth<80))return;
          this.faces.push({model:null,world,screen,normal,color,kind:'furniture',depth:screen.reduce((n,p)=>n+p.depth/4,0)});
        };
        add([[0,h,0],[w,h,0],[w,h,d],[0,h,d]],{x:0,y:1,z:0});
        add([[0,0,d],[w,0,d],[w,h,d],[0,h,d]],{x:0,y:0,z:1});
        add([[0,0,0],[0,0,d],[0,h,d],[0,h,0]],{x:-1,y:0,z:0});
        add([[w,0,d],[w,0,0],[w,h,0],[w,h,d]],{x:1,y:0,z:0});
        add([[w,0,0],[0,0,0],[0,h,0],[w,h,0]],{x:0,y:0,z:-1});
      };
      const w=this.shelfWidth||1150,left=-w/2;
      box(left-28,0,-1100,w+56,24,410,'#65442d');
      box(left-28,24,-1100,28,535,410,'#513725');box(w/2,24,-1100,28,535,410,'#513725');
      box(left,24,-1100,w,520,20,'#2d251f');box(left-34,559,-1110,w+68,28,430,'#715038');
      box(left-30,4,-691,w+60,8,4,'#a4864e');box(left-34,568,-680,w+68,5,4,'#b09359');
    }
    for(const m of this.models){
      this.projectedModel=m;
      const material=this.materials(m.book),w=m.width/2,l=m.length/2,h=m.height,board=5,paper=h-board*2;
      const add=(vertices,normal,texture,color,kind='edge',uv=null,triUV=null,bookmarkPage=undefined)=>{
        const world=vertices.map(v=>this.world(m,...v)),n=this.normal(m,normal),center=world.reduce((a,v)=>({x:a.x+v.x/vertices.length,y:a.y+v.y/vertices.length,z:a.z+v.z/vertices.length}),{x:0,y:0,z:0});
        if(this.dot(n,{x:eye.x-center.x,y:eye.y-center.y,z:eye.z-center.z})<=0)return;
        const screen=world.map(v=>this.project(v));if(screen.some(v=>v.depth<80))return;
        this.faces.push({model:m,world,screen,normal:n,texture,color,kind,uv,triUV,bookmarkPage,depth:screen.reduce((a,v)=>a+v.depth/screen.length,0)});
      };
      add([[-w,h,-l],[w,h,-l],[w,h,l],[-w,h,l]],[0,1,0],material.front,material.leather,'cover');
      add([[-w,0,l],[w,0,l],[w,0,-l],[-w,0,-l]],[0,-1,0],material.back,material.leather,'cover');
      for(const [edge,y] of [['back',0],['front',h-board]]){
        const profile=material.profiles[edge],flip=edge==='back'?-1:1;
        for(let i=0;i<profile.length;i++){
          const a=profile[i],b=profile[(i+1)%profile.length],ax=(a.u-.5)*m.width,az=(a.v-.5)*m.length*flip,bx=(b.u-.5)*m.width,bz=(b.v-.5)*m.length*flip;
          const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz);if(length<.001)continue;
          add([[ax,y+board,az],[bx,y+board,bz],[bx,y,bz],[ax,y,az]],[dz/length*flip,0,-dx/length*flip],null,material.leather);
        }
      }
      const x=w-7,z=l-7;
      add([[x,board+paper,-z],[x,board+paper,z],[x,board,z],[x,board,-z]],[1,0,0],material.paper,'#bf965d','paper',material.paperUV);
      add([[-x,board+paper,z],[x,board+paper,z],[x,board,z],[-x,board,z]],[0,0,1],material.paper,'#bf965d','paper',material.paperUV);
      add([[x,board+paper,-z],[-x,board+paper,-z],[-x,board,-z],[x,board,-z]],[0,0,-1],material.paper,'#bf965d','paper',material.paperUV);
      // Image U goes from back board to front board. The old opposite
      // ordering viewed the inscription from inside the binding (mirrored).
      for(let i=0;i<8;i++){
        const u=i/8,U=(i+1)/8,at=t=>[-w-Math.sin(Math.PI*t)*4.5,t*h];
        const [ax,ay]=at(u),[bx,by]=at(U),length=Math.hypot(bx-ax,by-ay);
        add([[ax,ay,-l],[bx,by,-l],[bx,by,l],[ax,ay,l]],[-(by-ay)/length,(bx-ax)/length,0],material.spine,material.leather,'spine',{x:u*material.spine.width,y:0,w:(U-u)*material.spine.width,h:material.spine.height});
      }
      for(const mark of material.bookmarks||[]){
        const width=128*208/180*mark.size/400*m.width,height=96*164/136*mark.size/350*m.length;
        const angle=mark.rotation*(mark.page%2?-1:1),c=Math.cos(angle),s=Math.sin(angle);
        const y=board+(1-mark.depthFraction)*paper;
        let polygon=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([u,v])=>({x:-w+mark.u*m.width+u*width*c-v*height*s,z:-l+mark.v*m.length+u*width*s+v*height*c,u:u+.5,v:v+.5}));
        const distance=p=>mark.edge==='top'?-l-p.z:mark.edge==='bottom'?p.z-l:p.x-w;
        const clipped=[];
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],A=distance(a),B=distance(b);
          if(A>=0)clipped.push(a);
          if((A>=0)!==(B>=0)){const t=A/(A-B);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
        }
        for(let i=1;i<clipped.length-1;i++)for(const normal of [[0,1,0],[0,-1,0]]){
          const triangle=[clipped[0],clipped[i],clipped[i+1]],front=(normal[1]>0)!==!!(mark.page%2),texture=front?mark.front:mark.back;
          add(triangle.map(p=>[p.x,y,p.z]),normal,texture,'rgba(0,0,0,0)','bookmark',null,triangle.map(p=>({x:p.u*texture.width,y:p.v*texture.height})),mark.page);
        }
      }
    }
    this.faces.sort((a,b)=>b.depth-a.depth);
    for(const face of this.faces){p.save();p.globalAlpha*=this.faceOpacity?.(face)??1;this.textured(face);p.restore();}
    if(this.table&&this.selected&&!this.noSelection){
      const m=this.selected,w=m.width/2+6,l=m.length/2+6,vertices=m.shelved||this.shelfOnly?[[-w,0,-l],[-w,m.height,-l],[-w,m.height,l],[-w,0,l]]:[[-w,m.height+1,-l],[w,m.height+1,-l],[w,m.height+1,l],[-w,m.height+1,l]];
      const outline=vertices.map(v=>this.project(this.world(m,...v)));
      p.save();p.strokeStyle='#cbb580';p.lineWidth=1.5;p.setLineDash([5,5]);p.beginPath();outline.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.stroke();p.restore();
    }
  }
}
window.ClosedBooks3D=ClosedBooks3D;
