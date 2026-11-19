import * as T from 'three';
import {circuit,pitLane,circuitAccess,at,offset,nearestOnRoad} from './highway-layout.js';

export function buildCircuit(scene,{block,pole,solid,paintTexture}){
  const mat=color=>new T.MeshStandardMaterial({color,roughness:.88});
  const white=mat(0xeee9da),red=mat(0xb63831),concrete=mat(0x969c99),steel=mat(0x34474b),blue=mat(0x386270),gravel=mat(0xb7a484),green=mat(0x64816a);
  const texture=new T.TextureLoader().load('assets/street.jpg');texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const asphalt=new T.MeshStandardMaterial({map:texture,color:0x898d90,roughness:.95});
  const batches=new Map();
  function strip(road,start,end,left,right,y,material,mask=null){
    if(left>right)[left,right]=[right,left];
    let b=batches.get(material);if(!b)batches.set(material,b={positions:[],uv:[],indices:[]});
    if(mask){
      // Clip each small ribbon triangle at the adjoining road edge. This makes
      // one paved junction, without crossing paint, curb strips or coplanar decks.
      const pair=s=>{const p=at(road,s);return [left,right].map(side=>{const q=offset(p,side);return [q.x,y,q.z,side/6,s/6];});};
      function triangle(vertices){
        const polygon=[];
        for(let i=0;i<3;i++){
          const a=vertices[i],c=vertices[(i+1)%3],inside=mask(a[0],a[2])>=0,nextInside=mask(c[0],c[2])>=0;
          if(inside)polygon.push(a);
          if(inside!==nextInside){
            let lo=0,hi=1;
            for(let j=0;j<16;j++){const t=(lo+hi)/2;if((mask(a[0]+(c[0]-a[0])*t,a[2]+(c[2]-a[2])*t)>=0)===inside)lo=t;else hi=t;}
            const t=(lo+hi)/2;polygon.push(a.map((v,j)=>v+(c[j]-v)*t));
          }
        }
        const base=b.positions.length/3;
        for(const p of polygon){b.positions.push(...p.slice(0,3));b.uv.push(...p.slice(3));}
        for(let j=1;j<polygon.length-1;j++)b.indices.push(base,base+j,base+j+1);
      }
      let a=pair(start);
      for(let s=start;s<end;s+=2){const c=pair(Math.min(end,s+2));triangle([a[0],a[1],c[0]]);triangle([a[1],c[1],c[0]]);a=c;}
      return;
    }
    let n=b.positions.length/3;
    const pair=s=>{const p=at(road,s);for(const side of [left,right]){const q=offset(p,side);b.positions.push(q.x,y,q.z);b.uv.push(side/6,s/6);}};
    pair(start);for(let s=start+4;s<end;s+=4){pair(s);b.indices.push(n,n+1,n+2,n+1,n+3,n+2);n+=2;}pair(end);b.indices.push(n,n+1,n+2,n+1,n+3,n+2);
  }
  function wall(p,q,material=concrete,h=1){
    const x=(p.x+q.x)/2,z=(p.z+q.z)/2,d=Math.hypot(q.x-p.x,q.z-p.z),yaw=Math.atan2(q.x-p.x,q.z-p.z);
    block(material,x,h/2,z,.65,h,d+.03,0,yaw);solid(x,z,.65,d+.03,yaw,0,h);
  }
  function board(text,x,z,yaw=0,width=8,y=3){
    const face=new T.MeshBasicMaterial({map:paintTexture(768,128,g=>{g.fillStyle='#203c42';g.fillRect(0,0,768,128);g.fillStyle='#e7ecbf';g.font='bold 52px Arial';g.textAlign='center';g.fillText(text,384,84,740);})});
    const mesh=new T.Mesh(new T.BoxGeometry(width,1.35,.15),[steel,steel,steel,steel,face,face]);mesh.position.set(x,y,z);mesh.rotation.y=yaw;scene.add(mesh);
  }
  for(const road of [circuit,pitLane,circuitAccess]){
    const w=road.halfWidth;
    if(road===circuit){strip(road,0,road.length,-22,22,-.07,gravel);strip(road,0,road.length,-14,14,-.035,green);}
    const outsideCircuit=(x,z)=>nearestOnRoad(circuit,x,z).distance-circuit.halfWidth;
    const outsidePit=(x,z)=>nearestOnRoad(pitLane,x,z).distance-pitLane.halfWidth-.08;
    const paintMask=road===circuit?outsidePit:road===pitLane?(x,z)=>outsideCircuit(x,z)-circuit.surfaceMargin-.08:null;
    strip(road,0,road.length,-w,w,road===pitLane?.024:.025,asphalt,road===pitLane?outsideCircuit:null);
    for(const side of [-1,1]){
      strip(road,0,road.length,side*(w-.18)-.07,side*(w-.18)+.07,.047,white,paintMask);
      if(road===circuit)for(let s=0;s<road.length;s+=5)strip(road,s,Math.min(s+5,road.length),side*w,side*(w+1.2),.036,Math.floor(s/5)%2?white:red,outsidePit);
    }
    if(road===circuitAccess)for(let s=15;s<road.length-20;s+=12)strip(road,s,s+4,-.07,.07,.05,white);
  }
  // Keep both pit merges and the paddock entrance completely open.
  for(let s=0;s<circuit.length;s+=8)for(const side of [-1,1]){
    const p=offset(at(circuit,s),side*23),q=offset(at(circuit,Math.min(s+8,circuit.length)),side*23);
    if([p,q].some(p=>nearestOnRoad(pitLane,p.x,p.z).distance<20||nearestOnRoad(circuitAccess,p.x,p.z).distance<17))continue;
    wall(p,q,Math.floor(s/32)%2?white:red);
    if(s%32===0){pole(steel,p.x,2,p.z,.1,4,.1);block(steel,p.x,2.8,p.z,.07,.07,8,0,Math.atan2(q.x-p.x,q.z-p.z));}
  }
  block(asphalt,-465.5,.005,830,29,.025,280);
  wall({x:-493,z:690},{x:-493,z:990},concrete,1.1);
  // Two garage wings leave a road-width opening into the pit lane.
  for(const z of [740,910]){
    block(concrete,-435,3,z,32,6,100);solid(-435,z,32,100);
    block(steel,-435,6.2,z,35,.45,104);
    for(let j=-40;j<=40;j+=20){block(blue,-451.05,2.2,z+j,.12,4.4,15);block(white,-451.2,4.7,z+j,.15,.3,16);}
    for(let j=-40;j<=40;j+=20)block(white,-465,.046,z+j,19,.025,.15);
  }
  board('PIT LANE · 60',-475,1000,0,7,4);
  for(const x of [-481,-469]){pole(steel,x,2,1000,.16,4,.16);solid(x,1000,.16,.16);}block(steel,-475,4.7,1000,12,.15,.15);
  board('AUTODROMO RIVIERA',-435,820,Math.PI/2,23,7);
  for(const z of [807,833]){pole(steel,-435,3.8,z,.2,7.6,.2);solid(-435,z,.2,.2);}block(steel,-435,7.7,820,.2,.2,26);
  // Stepped grandstand on the infield side of the main straight.
  for(let row=0;row<7;row++){
    const x=-558-row*2.6,h=1+row*.8;block(concrete,x,h/2,810,2.7,h,150);
    for(let z=740;z<880;z+=3)block(row%2?blue:red,x,h+.3,z,1,.55,1.8);
  }
  solid(-566,810,24,150);block(steel,-566,9,810,31,.45,157);
  for(const x of [-580,-551])for(const z of [738,782,838,882])pole(steel,x,4.5,z,.25,9,.25);
  // Start gantry, timing tower, grid slots and painted chequered line.
  const start=at(circuit,circuit.startLine);
  for(const x of [-532,-508]){pole(steel,x,4.5,start.z,.4,9,.4);solid(x,start.z,.4,.4);}
  block(steel,-520,8.6,start.z,25,.45,.45);board('AUTODROMO RIVIERA',-520,start.z,0,22,7.6);
  for(let x=-527;x<-513;x++)for(let z=0;z<2;z++)block((x+z)%2?white:steel,x+.5,.06,start.z+z,1,.025,1);
  for(let i=0;i<12;i++){const x=i%2?-523.5:-516.5,z=922+Math.floor(i/2)*12+(i%2)*5;block(white,x,.06,z,2.7,.025,.15);for(const side of [-1,1])block(white,x+side*1.35,.06,z+1,.12,.025,2);}
  block(steel,-443,7,1015,17,14,16);solid(-443,1015,17,16);block(blue,-443,13,1015,19,3,18);board('RIVIERA / TIMING',-443,1024,0,17,13);
  for(const distance of [150,100,50]){board(String(distance),-537,580+distance,0,2.6,1.8);pole(steel,-537,.7,580+distance,.12,1.4,.12);}
  board('AUTODROMO →',-834,70,0,12,3);
  board('← A1 / PORTO',-386,730,Math.PI,11,3);
  for(const [x,z] of [[-834,70],[-386,730]])for(const dx of [-5,5])pole(steel,x+dx,1.3,z,.14,2.6,.14);
  for(const [material,b] of batches){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.setIndex(b.indices);g.computeVertexNormals();const m=new T.Mesh(g,material);m.name=material===asphalt?'Circuit pavement':'Circuit markings';m.receiveShadow=true;scene.add(m);}
}
