'use strict';

// A small, dependency-free 3D renderer. Physical boards, paper and spine share
// world coordinates and one perspective camera; the open renderer is separate.
class ClosedBooks3D {
  constructor({canvas, context, materials, changed, open, storage=localStorage}) {
    Object.assign(this,{canvas,ctx:context,materials,changed,open,storage});
    this.yaw=-.55;this.pitch=.85;this.distance=1000;this.models=[];
    this.selected=null;this.mode='orbit';this.table=false;this.faces=[];this.gesture=null;
    try {this.layout=JSON.parse(storage.getItem('pixel-book-table-v1')||'{}');} catch {this.layout={};}
    if(!this.layout||Array.isArray(this.layout)||typeof this.layout!=='object')this.layout={};
  }
  setBooks(books,table=false,selected=null) {
    this.table=table;
    this.models=books.map((book,i)=>{
      const old=table?this.layout[book.id]:null;
      const finite=(key,fallback)=>Number.isFinite(old?.[key])?Math.max(-2000,Math.min(2000,old[key])):fallback;
      return {book,id:book.id,x:finite('x',(i%3-1)*380),z:finite('z',Math.floor(i/3)*500),
        y:finite('y',0),angle:finite('angle',i%2?.05:-.04),height:25+(book.pageCount||28)*.7,width:320,length:450};
    });
    if(!table&&this.models[0])Object.assign(this.models[0],{x:0,z:0,y:0,angle:0});
    this.selected=this.models.find(m=>m.id===selected)||this.models[0]||null;
    this.settle();this.reset();
  }
  reset(back=false) {this.center=null;this.yaw=-.55;this.pitch=back?-1.05:.85;this.distance=this.table?1500:1000;this.gesture=null;this.changed();}
  target() {
    if(this.center)return this.center;
    if(!this.models.length)return {x:0,y:0,z:0};
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
    return {x:500+this.dot(r,b.right)*scale,y:345-this.dot(r,b.up)*scale,depth};
  }
  world(m,x,y,z) {const c=Math.cos(m.angle),s=Math.sin(m.angle);return{x:m.x+x*c+z*s,y:m.y+y,z:m.z-x*s+z*c};}
  normal(m,n) {return this.world({...m,x:0,y:0,z:0},...n);}
  ground(point,y=0) {
    const b=this.basis(),t=this.dragTarget||this.target();
    const eye={x:t.x+b.toward.x*this.distance,y:t.y+b.toward.y*this.distance,z:t.z+b.toward.z*this.distance};
    const x=(point.x-500)/1000,v=(345-point.y)/1000;
    const ray={x:-b.toward.x+x*b.right.x+v*b.up.x,y:-b.toward.y+x*b.right.y+v*b.up.y,z:-b.toward.z+x*b.right.z+v*b.up.z};
    if(Math.abs(ray.y)<.05)return null;
    const k=(y-eye.y)/ray.y;
    return k>0?{x:eye.x+k*ray.x,z:eye.z+k*ray.z}:null;
  }
  overlapping(a,b) {
    // Oriented rectangle SAT, with a small inset so edge touches do not stack.
    const corners=m=>[[-159,-224],[159,-224],[159,224],[-159,224]].map(([x,z])=>this.world(m,x,0,z));
    const ac=corners(a),bc=corners(b);
    for(const angle of [a.angle,b.angle])for(const offset of [0,Math.PI/2]){
      const x=Math.cos(angle+offset),z=-Math.sin(angle+offset);
      const aa=ac.map(p=>p.x*x+p.z*z),bb=bc.map(p=>p.x*x+p.z*z);
      if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;
    }
    return true;
  }
  settle(last=null) {
    const ordered=this.models.filter(m=>m!==last).sort((a,b)=>a.y-b.y||this.models.indexOf(a)-this.models.indexOf(b));
    if(last)ordered.push(last);
    const placed=[];
    for(const model of ordered){model.y=Math.max(0,...placed.filter(other=>this.overlapping(model,other)).map(other=>other.y+other.height));placed.push(model);}
  }
  save() {
    if(!this.table)return;
    for(const m of this.models)this.layout[m.id]={x:m.x,y:m.y,z:m.z,angle:m.angle};
    try{this.storage.setItem('pixel-book-table-v1',JSON.stringify(this.layout));}catch{}
  }
  arrange(stack=false) {
    this.models.forEach((m,i)=>Object.assign(m,{x:stack?0:(i%3-1)*380,z:stack?0:Math.floor(i/3)*500,y:stack?i*100:0,angle:stack?(i%2?.05:-.05):0}));
    this.settle();this.save();this.reset();
  }
  rotateBook(amount) {if(!this.selected)return;this.selected.angle+=amount;this.settle(this.selected);this.save();this.changed();}
  hit(p) {
    for(const face of [...this.faces].reverse()){
      const points=face.screen;let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[i],b=points[j];if(((a.y>p.y)!==(b.y>p.y))&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
      }
      if(inside)return face.model;
    }
    return null;
  }
  pointerDown(p) {
    const hit=this.hit(p);if(hit)this.selected=hit;
    this.dragTarget=this.target();
    const move=this.table&&this.mode==='move'&&hit;
    this.gesture={p,yaw:this.yaw,pitch:this.pitch,move,hit,start:move?this.ground(p,hit.y+hit.height):null,x:hit?.x,z:hit?.z};
    this.changed();return true;
  }
  pointerMove(p) {
    const g=this.gesture;if(!g)return;
    if(g.move&&g.start){
      const target=this.ground(p,g.hit.y+g.hit.height);
      if(target){g.hit.x=Math.max(-1800,Math.min(1800,g.x+target.x-g.start.x));g.hit.z=Math.max(-1800,Math.min(1800,g.z+target.z-g.start.z));}
    }else{
      this.yaw=g.yaw+(p.x-g.p.x)*.008;
      this.pitch=Math.max(this.table?.14:-1.48,Math.min(1.48,g.pitch+(p.y-g.p.y)*.006));
    }
    this.changed();
  }
  pointerUp(cancel=false) {
    const g=this.gesture;if(!g)return;
    if(g.move){if(cancel)Object.assign(g.hit,{x:g.x,z:g.z});this.settle(cancel?null:g.hit);this.save();}
    this.gesture=null;this.dragTarget=null;this.changed();
  }
  zoom(delta) {this.distance=Math.max(650,Math.min(3400,this.distance*Math.exp(delta*.001)));this.changed();}
  poly(points,color,alpha=1) {
    const p=this.ctx;p.save();p.globalAlpha=alpha;p.beginPath();points.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.fillStyle=color;p.fill();p.restore();
  }
  textured(face) {
    const {ctx:p}=this,texture=face.texture;
    this.poly(face.screen,face.color);
    if(texture){
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
    const light={x:-.3,y:.86,z:.42},shade=.08+.23*(1-Math.max(0,this.dot(face.normal,light)));
    this.poly(face.screen,'#080b10',shade);
    p.save();p.strokeStyle='rgba(0,0,0,.35)';p.lineWidth=.7;p.beginPath();face.screen.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.stroke();p.restore();
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
    const p=this.ctx;this.faces=[];
    const target=this.dragTarget||this.target();
    // Floor and contact shadows establish scale without flattening the books.
    if(this.table||this.pitch>0){
      const floor=[[-1400,-1200],[1400,-1200],[1400,1700],[-1400,1700]].map(([x,z])=>this.project({x:x+target.x,y:-3,z:z+target.z}));
      this.poly(floor,'#182023',.5);
      for(const m of this.models){const outline=[];for(let i=0;i<40;i++){const a=i*Math.PI/20;outline.push(this.project(this.world({...m,y:0},Math.cos(a)*210,-1,Math.sin(a)*285)));}this.poly(outline,'#000',.30);}
    }
    const basis=this.basis(),eye={x:target.x+basis.toward.x*this.distance,y:target.y+basis.toward.y*this.distance,z:target.z+basis.toward.z*this.distance};
    for(const m of this.models){
      const material=this.materials(m.book),w=m.width/2,l=m.length/2,h=m.height,board=5,paper=h-board*2;
      const add=(vertices,normal,texture,color,kind='edge',uv=null)=>{
        const world=vertices.map(v=>this.world(m,...v)),n=this.normal(m,normal),center=world.reduce((a,v)=>({x:a.x+v.x/4,y:a.y+v.y/4,z:a.z+v.z/4}),{x:0,y:0,z:0});
        if(this.dot(n,{x:eye.x-center.x,y:eye.y-center.y,z:eye.z-center.z})<=0)return;
        const screen=world.map(v=>this.project(v));if(screen.some(v=>v.depth<80))return;
        this.faces.push({model:m,world,screen,normal:n,texture,color,kind,uv,depth:screen.reduce((a,v)=>a+v.depth/4,0)});
      };
      add([[-w,h,-l],[w,h,-l],[w,h,l],[-w,h,l]],[0,1,0],material.front,material.leather,'cover');
      add([[-w,0,l],[w,0,l],[w,0,-l],[-w,0,-l]],[0,-1,0],material.back,material.leather,'cover');
      for(const y of [0,h-board]){
        add([[w,y+board,-l],[w,y+board,l],[w,y,l],[w,y,-l]],[1,0,0],null,material.leather);
        add([[-w,y+board,l],[w,y+board,l],[w,y,l],[-w,y,l]],[0,0,1],null,material.leather);
        add([[w,y+board,-l],[-w,y+board,-l],[-w,y,-l],[w,y,-l]],[0,0,-1],null,material.leather);
      }
      const x=w-7,z=l-7;
      add([[x,board+paper,-z],[x,board+paper,z],[x,board,z],[x,board,-z]],[1,0,0],material.paper,'#bf965d','paper',material.paperUV);
      add([[-x,board+paper,z],[x,board+paper,z],[x,board,z],[-x,board,z]],[0,0,1],material.paper,'#bf965d','paper',material.paperUV);
      add([[x,board+paper,-z],[-x,board+paper,-z],[-x,board,-z],[x,board,-z]],[0,0,-1],material.paper,'#bf965d','paper',material.paperUV);
      add([[-w,h,-l],[-w,0,-l],[-w,0,l],[-w,h,l]],[-1,0,0],material.spine,material.leather,'spine');
    }
    this.faces.sort((a,b)=>b.depth-a.depth);
    for(const face of this.faces)this.textured(face);
    if(this.table&&this.selected){
      const m=this.selected,outline=[[-166,-231],[166,-231],[166,231],[-166,231]].map(([x,z])=>this.project(this.world(m,x,m.height+1,z)));
      p.save();p.strokeStyle='#cbb580';p.lineWidth=1.5;p.setLineDash([5,5]);p.beginPath();outline.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));p.closePath();p.stroke();p.restore();
    }
  }
}
window.ClosedBooks3D=ClosedBooks3D;
