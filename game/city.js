import * as T from 'three';
import {buildHighway} from './highway.js';
import {locate} from './highway-layout.js';
export const roadsX=[-540,-450,-360,-270,-180,-90,0],roadsZ=[-360,-270,-180,-90,0,90,180,270,360];
export function offRoad(x,z){
  if(x>=-553 && x<=26 && Math.abs(z)<=378){
    if(roadsX.some(v=>Math.abs(x-v)<=8.3)||roadsZ.some(v=>Math.abs(z-v)<=8.3))return false;
  }
  return !locate(x,z)?.paved;
}
export const route=[[4,-81],[-4,-176],[-85,-185],[-176,-176],[-176,-85],[-176,4],[-85,4],[-5,4],[4,-45]];
let seed=71292;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'));const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=8;return tx;}
const mat=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
export function createCity(scene,renderer){
 seed=71292;const solids=[],batches=new Map(),cube=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(.5,.5,1,12),ball=new T.IcosahedronGeometry(.5,1);
 const tmp=new T.Object3D(),col=new T.Color();
 function place(geo,m,x,y,z,w,h,d,rx=0,ry=0,rz=0,color=0xffffff){
   let by=batches.get(geo);if(!by)batches.set(geo,by=new Map());let bucket=by.get(m);if(!bucket)by.set(m,bucket=[]);
   tmp.position.set(x,y,z);tmp.rotation.set(rx,ry,rz);tmp.scale.set(w,h,d);tmp.updateMatrix();bucket.push([tmp.matrix.clone(),color]);}
 const block=(...args)=>place(cube,...args),pole=(...args)=>place(cylinder,...args);
 function solid(x,z,width,depth,yaw=0){
   const w=width/2,d=depth/2,cs=Math.cos(yaw),sn=Math.sin(yaw);
   solids.push({x,z,w,d,cs,sn,bx:Math.abs(cs)*w+Math.abs(sn)*d,bz:Math.abs(sn)*w+Math.abs(cs)*d});
 }
 const stone=mat(0xc3b7a4),trim=mat(0xe1d6c1),roof=mat(0x80766c),iron=mat(0x39454a,.48,.47),white=mat(0xd9d7c7),yellow=mat(0xc6a76a),wood=mat(0x977960),grass=mat(0x869062),bark=mat(0x685b46),leaf=mat(0xffffff),red=mat(0x9c4b36),blue=mat(0x425d68),dark=mat(0x394748),sail=mat(0xf4e8c7),warm=new T.MeshStandardMaterial({color:0xffe4b8,emissive:0xffb56a,emissiveIntensity:.6});
 const loader=new T.TextureLoader();let a=loader.load('assets/street.jpg'),n=loader.load('assets/street-n.jpg');
 for(const t of [a,n]){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(115,150);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}a.colorSpace=T.SRGBColorSpace;
 const pavement=new T.MeshStandardMaterial({map:a,color:0x979696,normalMap:n,normalScale:new T.Vector2(.42,.42),roughness:.92});
 const tiled=(name,repeatX,repeatY)=>{let t=loader.load('assets/'+name+'.jpg');t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeatX,repeatY);t.anisotropy=8;return t;};
 const sidewalk=mat(0xb8ad99);sidewalk.map=tiled('pavers',12,12);
 const promenade=mat(0xb8ad99);promenade.map=tiled('pavers',4,150);
 const asphalt=new T.Mesh(new T.PlaneGeometry(590,792),pavement);asphalt.rotation.x=-Math.PI/2;asphalt.position.set(-264,-.012,0);asphalt.receiveShadow=true;scene.add(asphalt);
 const facades=[['building_liver',1.5,1],['building_oldfirm',3,2],['building_dock_apartments',2,1],['building_front2',2,4],['building_office7',1.25,1],['building_lh1',2,2],['apartments5',1.5,1.5]].map(([id,x,y],i)=>new T.MeshStandardMaterial({map:tiled(id,x,y),roughness:i<5?.85:.52,metalness:i<5?.02:.14}));
 const shops=['restaurant_window','shop_front3','shop_front11','building_front5'].map(n=>new T.MeshStandardMaterial({map:tiled(n,2.6,1),roughness:.67}));
 const treeCard=new T.PlaneGeometry(1,1),treeTexture=loader.load('assets/coastal-tree.png');treeTexture.colorSpace=T.SRGBColorSpace;treeTexture.anisotropy=8;
 const canopy=new T.MeshBasicMaterial({map:treeTexture,side:T.DoubleSide,alphaTest:.42,color:0xe2dfc5});
 grass.map=tiled('park-grass',15,15);
 function pine(x,z,size=1){const h=8.4*size,turn=rand()*Math.PI;for(let f=0;f<3;f++)place(treeCard,canopy,x,h*.43,z,h,h,1,0,turn+f*Math.PI/3,0);solid(x,z,.54,.54);}
 const frond=new T.BufferGeometry();{let verts=[],colors=[];const point=u=>[0,.94*Math.sin(Math.PI*u)-1.04*u,3.25*u], add=(a,b,c,tone)=>{verts.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(tone,tone,tone);};
 for(let j=0;j<33;j++){let u=j/33,v=(j+1)/33,A=point(u),B=point(v),width=.032*(1-u)+.005;add([-width,A[1],A[2]],[width,A[1],A[2]],B,.79);
 for(let side of [-1,1]){let len=(.24+.53*Math.sin(Math.PI*u))*(1-u*.5),bend=(.15+u*.35)*len;
 const start=[0,A[1],A[2]],base=[0,B[1],B[2]],mid=[side*len*.58,A[1]-.05,A[2]+len*.27],tip=[side*len,A[1]-bend-.09,A[2]+len*.52];let shade=.55+rand()*.45;add(start,mid,base,shade);add(mid,tip,base,shade*.9);}}
 frond.setAttribute('position',new T.Float32BufferAttribute(verts,3));frond.setAttribute('color',new T.Float32BufferAttribute(colors,3));frond.computeVertexNormals();}
 const palmMat=mat(0xffffff);palmMat.side=T.DoubleSide;palmMat.vertexColors=true;
 function palm(x,z,k=1){pole(bark,x,3.6*k,z,.34*k,7.2*k,.34*k,0,0,.025);for(let i=1;i<22;i++)pole(bark,x-.005*i,i*.32*k,z,(.36-i*.003)*k,.045*k,(.36-i*.003)*k);
 for(let i=0;i<24;i++)place(frond,palmMat,x-.08,7.1*k,z,k,k,k,(i%3-1)*.44+rand()*.15,i*2.4,0,[0x516939,0x829456,0x5b7137][i%3]);solid(x,z,.4,.4);}
 function lamp(x,z,angle=0){pole(iron,x,3.35,z,.16,6.7,.16);let dx=Math.cos(angle),dz=Math.sin(angle);block(iron,x+dx*.65,6.66,z+dz*.65,1.45,.09,.10,0,-angle);block(warm,x+dx*1.25,6.62,z+dz*1.25,.74,.13,.37,0,-angle);solid(x,z,.22,.22);}
 const signNames=['CAFFÈ LIDO','ALBERGO  MARE','PORTO  MERCATO','BAR   CENTRALE','STUDIO  FORMA','PANIFICIO','CASA  LUCIA','OSTERIA  19','GRAND HOTEL','FARMACIA'];
 const signs=signNames.map((s,i)=>new T.MeshStandardMaterial({map:texture(512,80,g=>{g.fillStyle=['#404c45','#9d5b43','#e3d6b9','#435564'][i%4];g.fillRect(0,0,512,80);g.fillStyle=i%4===2?'#4e514b':'#eee4cb';g.font='bold 37px Georgia';g.textAlign='center';g.fillText(s,256,53);}),roughness:.8}));
 function building(x,z,w,d,h,style,roadSide){
    block(facades[style],x,h/2+.14,z,w,h,d);solid(x,z,w,d);
    block(trim,x,.33,z,w+.32,.42,d+.32);block(trim,x,h+.12,z,w+.56,.36,d+.56);
    block(roof,x,h+.38,z,w-.55,.3,d-.55);
    if(style<5){block(shops[style%4],x,1.65,z,w+.07,3.05,d+.07);block(trim,x,3.6,z,w+.35,.22,d+.35);
      if(roadSide!==0){const sx=x+roadSide*(w/2+.14),sw=Math.min(10,d*.6);
       block(signs[Math.floor(rand()*signs.length)],sx,3.13,z,.12,.72,sw);
       block([red,grass,blue][Math.floor(rand()*3)],sx+roadSide*.83,2.72,z,1.75,.13,sw,0,0,-roadSide*.13);
       for(let floor=1;floor<Math.round(h/3.4)-1;floor+=2){
         const by=3.3+floor*3.0;
         block(trim,sx+roadSide*.5,by,z,.95,.18,d*.47);
         block(iron,sx+roadSide*.98,by+.70,z,.06,.1,d*.47);
         for(let k=-2;k<=2;k++)block(iron,sx+roadSide*.98,by+.36,z+k*d*.11,.055,.72,.055);}
      }
    }else{for(let yy=4;yy<h;yy+=3.9)block(iron,x,yy,z,w+.12,.16,d+.12);}
    if(rand()>.32){block(roof,x+w*.2,h+1.05,z,d*.13,1.4,2.4);block(trim,x-w*.17,h+.68,z+2,2.5,.55,1.6);}
 }
 for(let i=0;i<roadsX.length-1;i++)for(let j=0;j<roadsZ.length-1;j++){
   const cx=roadsX[i]+45,cz=roadsZ[j]+45;
   block(sidewalk,cx,.075,cz,72,.15,72);
   if((i===5&&j===4)||(i===3&&j===2)||(i===1&&j===6)){block(grass,cx,.17,cz,61,.12,61);
      for(let t=0;t<15;t++)pine(cx+(rand()-.5)*55,cz+(rand()-.5)*55,.85+rand()*.55);
      block(trim,cx,.24,cz,7,.12,68);pole(stone,cx,1.7,cz,4,3.2,4);pole(trim,cx,3.62,cz,7,.55,7);continue;}
   for(let sx of [-1,1])for(let sz of [-1,1]){
     const w=25+rand()*6,d=25+rand()*6, h=(i<2?21:11)+rand()*(i<3?31:13);
     building(cx+sx*(32-w/2),cz+sz*(32-d/2),w,d,h,i<2?5+Math.floor(rand()*2):Math.floor(rand()*5),sx);
   }
   if((i+j)%2===0)pine(cx+34,cz,.9);
 }
 // Longitudinal markings stop before intersections; zebra crossings span the carriageway.
 for(const x of roadsX)for(let j=0;j<roadsZ.length-1;j++){
  const mid=roadsZ[j]+45;
  for(let zz=-30;zz<=30;zz+=12){block(white,x,.014,mid+zz,.125,.022,4);}
  for(let side of [-1,1])block(white,x+side*7.37,.014,mid,.1,.022,67);
  if(x===0||x===-180){for(let k=-6;k<=6;k+=1.45)block(white,x+k,.018,mid-33,.65,.022,2.35);}
  if(x===0){lamp(10.4,mid+14,Math.PI);palm(15.5,mid-15);palm(15.5,mid+23);}
  else if((j%2)===0)lamp(x+9.5,mid,Math.PI);
 }
 for(const z of roadsZ)for(let i=0;i<roadsX.length-1;i++){const mid=roadsX[i]+45;for(let xx=-30;xx<=30;xx+=12)block(white,mid+xx,.014,z,4,.022,.125);
   for(let side of [-1,1])block(white,mid,.014,z+side*7.4,67,.022,.1);}
 block(promenade,18,.09,0,19,.18,757);block(trim,27,.68,0,.6,1.16,758);solid(27,0,.66,760);
 for(let j=-3;j<4;j++){pine(22,j*90+49,.78);pine(21,j*90+70,.67);}for(let z=-360;z<=360;z+=18){pole(iron,26.4,.9,z,.18,1.6,.18);block(iron,26.4,1.58,z+9,.08,.07,18);if(z%36===0){block(wood,20,.63,z,1.05,.14,2.9);block(iron,20,.3,z,.65,.54,2.3);}}
 // Raised outer seawalls form a visible boundary around the drivable district.
 for(const sign of [-1,1]){
   for(const [left,right] of [[-553,-9.6],[9.6,27]]){const x=(left+right)/2;block(stone,x,.9,sign*378,right-left,1.8,.85);solid(x,sign*378,right-left,.85);}
   const end=sign*(378+9.6)/2;block(stone,-553,.9,end,1,1.8,378-9.6);solid(-553,end,1,378-9.6);
 }
 const waterGeo=new T.PlaneGeometry(1500,4800,110,190);waterGeo.rotateX(-Math.PI/2);const water=new T.Mesh(waterGeo,new T.MeshPhysicalMaterial({color:0x397378,metalness:.38,roughness:.25,clearcoat:.75,clearcoatRoughness:.23}));
 water.position.set(775,-1.1,0);scene.add(water);
 // A marina with finger piers, hulls, rigging and a striped harbor light.
 const hullGeo=new T.SphereGeometry(.5,14,6), tri=new T.BufferGeometry();tri.setAttribute('position',new T.Float32BufferAttribute([0,0,0,0,8,0,0,.3,3.35],3));tri.computeVertexNormals();sail.side=T.DoubleSide;
 for(let j=-3;j<=3;j++){let z=j*91+22;block(wood,52,-.18,z,52,.45,2.5);
   for(let k=0;k<3;k++){let x=37+k*14;pole(wood,x,-.29,z, .35,1.8,.35);
     for(let side of [-1,1]){let bz=z+side*(4+rand());place(hullGeo,white,x,-.36,bz,3.2,1.45,9.2);block(wood,x,.10,bz,2.15,.3,5.7);block(trim,x,.55,bz,1.6,.8,2.7);pole(iron,x,4.8,bz,.09,9.4,.09);if((j+k)%2===0)place(tri,sail,x,.55,bz,.9,.92,.99,0,.12*k);}}
 }
 pole(stone,58,1.0,-303,14,4,14);for(let k=0;k<6;k++)pole(k%2?red:trim,58,4.4+2.4*k,-303,4.6-k*.32,2.45,4.6-k*.32);pole(warm,58,18.6,-303,2.9,2,2.9);pole(iron,58,19.85,-303,4.2,.45,4.2);
 buildHighway(scene,{block,pole,solid,place,paintTexture:texture});
 for(const [geo,by] of batches)for(const [m,items] of by){let inst=new T.InstancedMesh(geo,m,items.length);items.forEach(([mx,c],i)=>{inst.setMatrixAt(i,mx);if(c!==0xffffff)inst.setColorAt(i,col.setHex(c));});
   inst.castShadow=true;inst.receiveShadow=true;inst.computeBoundingSphere();scene.add(inst);}
 const grid=new Map();
 for(const box of solids){for(let x=Math.floor((box.x-box.bx)/32);x<=Math.floor((box.x+box.bx)/32);x++)for(let z=Math.floor((box.z-box.bz)/32);z<=Math.floor((box.z+box.bz)/32);z++){let key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(box);}}
 return {solids,water,nearby(x,z){let result=new Set();for(let i=Math.floor((x-3)/32);i<=Math.floor((x+3)/32);i++)for(let j=Math.floor((z-3)/32);j<=Math.floor((z+3)/32);j++)for(const b of grid.get(i+','+j)||[])result.add(b);return result;},
 update(time){const v=waterGeo.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i),z=v.getZ(i);v.setY(i,.085*Math.sin(x*.21+z*.065+time*1.23)+.065*Math.sin(z*.21-time*.86));}v.needsUpdate=true;waterGeo.computeVertexNormals();}};
}
