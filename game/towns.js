import * as T from 'three';
import {towns} from './region-layout.js';

// Reuse the city's instanced materials and collision builder for the whole region.
export function buildTowns(scene,api){
  const {block,pole,solid,building,pine,lamp,paintTexture,materials:m}=api;
  const loader=new T.TextureLoader(),surface=loader.load('assets/street.jpg'),normal=loader.load('assets/street-n.jpg');
  surface.colorSpace=T.SRGBColorSpace;
  for(const t of [surface,normal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}
  const roadMaterial=new T.MeshStandardMaterial({map:surface,normalMap:normal,normalScale:new T.Vector2(.25,.25),color:0xa2a3a3,roughness:.93});
  function pave(x,z,w,d,y=.022){
    const geo=new T.PlaneGeometry(w,d);geo.rotateX(-Math.PI/2);
    const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/6,uv.getY(i)*d/6);
    const mesh=new T.Mesh(geo,roadMaterial);mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);
  }
  const signCache=new Map();
  function label(text,x,y,z,w=9,yaw=0,bg='#254c49'){
    const key=text+bg;let material=signCache.get(key);
    if(!material){material=new T.MeshStandardMaterial({map:paintTexture(512,96,g=>{
      g.fillStyle=bg;g.fillRect(0,0,512,96);g.strokeStyle='#d8d9c5';g.lineWidth=5;g.strokeRect(5,5,502,86);
      g.fillStyle=bg==='#eeeadb'?'#254c49':'#fff7df';g.textAlign='center';g.font='bold 38px Arial';g.fillText(text,256,62,480);
    }),roughness:.8});signCache.set(key,material);}
    const face=new T.Mesh(new T.PlaneGeometry(w,w*96/512),material);face.position.set(x,y,z);face.rotation.y=yaw;scene.add(face);
  }
  function bench(x,z){block(m.wood,x,.55,z,3,.16,.7);block(m.wood,x,.99,z+.32,3,.65,.12);for(const s of [-1,1])block(m.iron,x+s, .27,z,.1,.55,.55);solid(x,z,3,.8);}
  function bin(x,z){pole(m.iron,x,.55,z,.6,1.1,.6);pole(m.trim,x,1.12,z,.65,.08,.65);}
  function shelter(x,z,name){
    for(const s of [-1,1])pole(m.iron,x+s*2.6,1.35,z,.12,2.7,.12);
    block(m.roof,x,2.8,z,6.4,.18,2.6);block(m.blue,x,1.4,z+.8,5.8,2.5,.1);bench(x,z+.2);
    pole(m.iron,x+4,1.8,z,.1,3.6,.1);label('BUS',x+4,3.1,z+.1,1.3);label(name,x,2.3,z+.88,4.5,Math.PI);
  }
  function parking(x,z,w=60){
    pave(x,z,w,28,.029);
    for(let dx=-w/2+3;dx<w/2;dx+=3){block(m.white,x+dx,.04,z+7,.1,.015,6);block(m.white,x+dx,.04,z-7,.1,.015,6);}
    label('P',x-w/2,2.4,z+12,1.5,0,'#28577d');pole(m.iron,x-w/2,1.1,z+12,.1,2.2,.1);
  }
  function fountain(x,z){pole(m.stone,x,.42,z,13,.65,13);pole(m.blue,x,.78,z,11,.06,11);pole(m.trim,x,1.8,z,2,2.6,2);pole(m.trim,x,3.2,z,5,.4,5);solid(x,z,13,13);}
  function market(x,z){
    block(m.sidewalk,x,.1,z,128,.18,68);fountain(x+16,z);
    for(let i=0;i<5;i++){const px=x-47+i*20,pz=z+20;
      block(i%2?m.grass:m.red,px,2.8,pz,7,.18,4.5);block(m.wood,px,1,pz,6,1.1,2);
      for(const s of [-1,1])pole(m.iron,px+s*3,1.4,pz,.09,2.8,.09);
      for(let j=0;j<4;j++)block(j%2?m.yellow:m.red,px-2+j*1.3,1.65,pz,1,.3,1);solid(px,pz,6,2);
    }
    building(x-35,z-16,32,19,14,2,-1);label('MERCATO COPERTO',x-35,4.2,z-6.3,22);
    for(const px of [-53,-8,53]){pine(x+px,z-24,.8);bench(x+px,z-13);}
    label('PIAZZA DEL SOLE',x+35,2.8,z+32,8);
    for(const side of [-1,1])pole(m.iron,x+35+side*3,1.4,z+32,.1,2.8,.1);
  }
  function civic(x,z){
    building(x,z-7,44,32,16,2,1);label('MUNICIPIO',x,5,z+9.2,17);
    for(let s=-18;s<=18;s+=6)pole(m.trim,x+s,3,z+12,1,6,1);
    block(m.trim,x,6.2,z+12,46,.65,4);block(m.stone,x,.3,z+17,49,.5,9);
    block(m.stone,x+36,13,z-7,12,26,12);solid(x+36,z-7,12,12);block(m.roof,x+36,26.4,z-7,14,.8,14);
    const clock=new T.MeshBasicMaterial({map:paintTexture(128,128,g=>{
      g.fillStyle='#eee2bf';g.fillRect(0,0,128,128);g.strokeStyle='#304646';g.lineWidth=5;g.beginPath();g.arc(64,64,55,0,Math.PI*2);g.stroke();
      for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(64+45*Math.sin(a),64-45*Math.cos(a));g.lineTo(64+51*Math.sin(a),64-51*Math.cos(a));g.stroke();}
      g.beginPath();g.moveTo(64,28);g.lineTo(64,64);g.lineTo(88,78);g.stroke();
    })});
    for(const side of [-1,1]){const face=new T.Mesh(new T.PlaneGeometry(5,5),clock);face.position.set(x+36,21,z-7+side*6.02);face.rotation.y=side<0?Math.PI:0;scene.add(face);}
    bench(x-35,z+20);pine(x-47,z+10);bin(x-32,z+20);
  }
  function station(x,z){
    block(m.sidewalk,x,.08,z-11.5,130,.16,47);
    building(x,z+4,64,20,9,6,1);label('VALDORO CENTRALE',x,5,z+14.2,31);
    block(m.trim,x,1,z-18,120,1,8);
    for(const dz of [-27,-23])block(m.iron,x,.2,z+dz,123,.2,.12);
    for(let dx=-58;dx<60;dx+=2.4)block(m.wood,x+dx,.1,z-25,.25,.16,5);
    for(let dx=-48;dx<=48;dx+=24){pole(m.iron,x+dx,2.7,z-18,.2,3.5,.2);}
    block(m.roof,x,4.6,z-18,116,.2,10);
    // A stationary regional train at the terminus.
    for(const dx of [-37,-12,13]){block(m.white,x+dx,2,z-25,23,3.3,3.3);block(m.blue,x+dx,2.6,z-25,21,1.2,3.35);block(m.red,x+dx,.8,z-25,23,.4,3.4);solid(x+dx,z-25,23,3.4);}
    parking(x,z+29,110);shelter(x+50,z+22,'STAZIONE');
  }
  function depot(x,z){
    block(m.sidewalk,x,.08,z-11.5,130,.16,47);
    block(m.stone,x,5,z-8,104,10,37);solid(x,z-8,104,37);block(m.roof,x,10.2,z-8,108,.4,40);
    for(let dx=-36;dx<=36;dx+=24){block(m.iron,x+dx,2.6,z+10.6,12,5,.18);block(m.yellow,x+dx-7,.9,z+12,.3,1.8,.3);}
    label('VALDORO LOGISTICA',x,7.6,z+10.7,31);parking(x,z+27,104);
    for(let k=0;k<3;k++)block(k%2?m.blue:m.red,x-49+k*15,1.5,z-31,12,3,4);
  }
  function park(x,z){
    block(m.grass,x,.17,z,128,.14,68);block(m.trim,x,.26,z,128,.05,4);block(m.trim,x,.26,z,4,.05,68);
    for(let k=0;k<10;k++){const px=x-54+(k%5)*27,pz=z+(k<5?-22:22);pine(px,pz,.8+(k%3)*.15);}
    for(const dx of [-25,25]){bench(x+dx,z+5);bin(x+dx+3,z+5);}
    block(m.blue,x+38,.3,z+20,19,.08,15);for(const dx of [31,45])pole(m.red,x+dx,1.7,z+20,.14,3,.14);
    block(m.yellow,x+38,3.2,z+20,14,.16,.16);
    for(const dx of [35,41]){for(const side of [-1,1])pole(m.iron,x+dx+side*.45,2,z+20,.03,2.2,.03);block(m.wood,x+dx,.85,z+20,1.2,.1,.45);}
  }
  function fuel(x,z){
    pave(x,z,120,70,.027);
    for(const side of [-1,1])block(m.sidewalk,x+side*62.5,.08,z,5,.16,70);
    parking(x,z,120);building(x-40,z-12,25,20,5,0,1);label('A1 · CAFFÈ',x-40,4,z-1.8,18);
    for(const dx of [0,35]){pole(m.iron,x+dx,2.4,z,.3,4.8,.3);block(m.white,x+dx,1,z,1.5,2,1);solid(x+dx,z,1.5,1);}
    block(m.red,x+18,5,z,61,.45,18);label('VELOCE · SERVIZI',x+18,4.7,z+9.1,30);label('A1 →',x+57,2.4,z+24,7);
  }
  for(const town of towns){
    const {xs,zs}=town;
    // Road surfaces are strips; courtyards and verges have their own ground material.
    block(m.grass,town.x,-.07,town.z,946,.08,586);
    for(let i=0;i<xs.length;i++)pave(xs[i],town.z,i===3?20:16,556);
    for(let j=0;j<zs.length;j++)pave(town.x,zs[j],916,j===3?20:16,.024);
    for(let i=0;i<6;i++)for(let j=0;j<6;j++){
      const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
      const forecourt=(i===5&&j===3)||(town.theme==='modern'&&((i===2&&j===2)||(i>=4&&j<=1)));
      if(!forecourt)block(m.sidewalk,x,.08,z,130,.16,70);
      if(i===2&&j===2){if(town.theme==='historic')market(x,z);else station(x,z);continue;}
      if(i===2&&j===3&&town.theme==='historic'){civic(x,z);continue;}
      if((i===1&&j===1)||(i===3&&j===4)||(i===0&&j===4)){park(x,z);continue;}
      if(i===5&&j===3){fuel(x,z);continue;}
      if(town.theme==='modern'&&i>=4&&j<=1){depot(x,z);continue;}
      const modern=town.theme==='modern',height=modern?22:10;
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const variation=(i*7+j*3+(sx+sz)*2+30)%7,w=modern?39+variation:31+variation*2,d=23+variation;
        const bx=x+sx*(60-w/2),bz=z+sz*(30-d/2),h=height+variation*(modern?4:1.8);
        building(bx,bz,w,d,h,modern?5+(i+j)%2:(i+j+variation)%5,sx);
        if(!modern)block(m.red,bx,h+.6,bz,w+1,.7,d+1);
      }
      block(m.grass,x,.2,z,12,.12,45);pine(x,z,.85);bench(x,z+20);bin(x+3,z+20);
    }
    // Continuous lanes, clear junctions, stop bars and pedestrian crossings.
    for(let i=0;i<xs.length;i++)for(let j=0;j<zs.length-1;j++){
      const x=xs[i],z=zs[j]+45;
      for(let dz=-24;dz<=24;dz+=12)block(m.white,x,.037,z+dz,.14,.015,4);
      for(const s of [-1,1])block(m.white,x+s*(i===3?9:7),.036,z,.12,.015,62);
      lamp(x+12,z,Math.PI);
      if(i===3||i===5)for(let dx=-7;dx<=7;dx+=1.5)block(m.white,x+dx,.04,z-30,.7,.015,2.5);
    }
    for(let j=0;j<zs.length;j++)for(let i=0;i<xs.length-1;i++){
      const x=xs[i]+75,z=zs[j];
      for(let dx=-54;dx<=54;dx+=12)block(m.white,x+dx,.038,z,4,.015,.14);
      for(const s of [-1,1])block(m.white,x,.037,z+s*(j===3?9:7),124,.015,.12);
      block(m.white,x+61,.04,z-4,.4,.015,6);block(m.white,x-61,.04,z+4,.4,.015,6);
      if(j===3){shelter(x+32,z+13,'CENTRO');label('A1 →',x+60,2.4,z+13,4);pole(m.iron,x+60,1.2,z+13,.1,2.4,.1);}
    }
    // The residential fringe closes streets visibly, away from all junctions.
    for(const x of xs)for(const z of [zs[0]-12,zs.at(-1)+12]){
      block(m.trim,x,.65,z,16,1.3,.5);solid(x,z,16,.5);
    }
    for(const z of zs){block(m.trim,xs[0]-12,.65,z,.5,1.3,16);solid(xs[0]-12,z,.5,16);
      if(z!==town.z){block(m.trim,xs.at(-1)+12,.65,z,.5,1.3,16);solid(xs.at(-1)+12,z,.5,16);}}
    label(town.name.toUpperCase(),-2019,3,town.z-16,13,Math.PI/2,'#eeeadb');
    pole(m.iron,-2019,1.3,town.z-21,.12,2.6,.12);pole(m.iron,-2019,1.3,town.z-11,.12,2.6,.12);
  }
}
