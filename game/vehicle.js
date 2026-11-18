import * as T from 'three';
import {body,drift} from './collisions.js';
import {main as motorway,lane} from './highway-layout.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
export async function loadAventador(scene){
 const {scene:model}=await new GLTFLoader().loadAsync('assets/aventador.glb');
 const root=new T.Group(),suspension=new T.Group(),body=new T.Group();scene.add(root);root.add(suspension);suspension.add(body);body.add(model);
 const rotors=[],hubs=[],brakes=new Set();let angle=0;
 const oldShadow=model.getObjectByName('Obj_Shadow_Plane');if(oldShadow)oldShadow.removeFromParent();
 model.traverse(o=>{
   if(o.name.includes('Rim_T0B'))o.visible=false;
   if(o.name.includes('WheelHub_F'))hubs.push([o,o.quaternion.clone()]);
   if(o.name.includes('DiscRotor_'))rotors.push([o,o.quaternion.clone(),o.name.endsWith('R')?-1:1]);
   if(!o.isMesh)return;
   o.castShadow=true;o.receiveShadow=true;
   const m=o.material;
   if(m.name==='Mt_Body'||m.name==='Mt_MirrorCover'){
     o.material=new T.MeshPhysicalMaterial({color:0xec5a12,metalness:.56,roughness:.26,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:1.18});}
   if(m.name==='Mt_AlloyWheels'){m.color.setHex(0x66645e);m.metalness=.87;m.roughness=.27;}
   if(m.name==='Mt_BrakeCaliper'){m.color.setHex(0xe4a528);}
   if(m.name==='Mt_WindScreens'){m.color.setHex(0x7f9aa1);m.opacity=.38;m.metalness=.55;m.roughness=.12;m.depthWrite=false;}
   if(m.name==='Mt_AventadorAtlas'&&m.transparent){m.alphaTest=.32;m.transparent=false;}
   if(m.name==='Mt_Reflector_BL')brakes.add(m);
 });
 model.rotation.y=-Math.PI/2;model.updateMatrixWorld(true);
 let box=new T.Box3().setFromObject(model,true),scale=4.78/(box.max.z-box.min.z);model.scale.setScalar(scale);
 model.updateMatrixWorld(true);box.setFromObject(model,true);model.position.set(-(box.max.x+box.min.x)/2,-box.min.y+.025,-(box.min.z+box.max.z)/2);
 const steering=new T.Group();steering.position.set(-.377,.777,-.389);body.add(steering);body.updateMatrixWorld(true);
 const steeringParts=[];model.traverse(o=>{if(/^Obj_(Interior_Steering|Steering)/.test(o.name))steeringParts.push(o);});
 for(const part of steeringParts)steering.attach(part);const steeringAxis=new T.Vector3(0,.25,.97).normalize();
 const displayCanvas=document.createElement('canvas');displayCanvas.width=512;displayCanvas.height=192;
 const dc=displayCanvas.getContext('2d'),displayTex=new T.CanvasTexture(displayCanvas);displayTex.colorSpace=T.SRGBColorSpace;
 const display=new T.Mesh(new T.PlaneGeometry(.304,.113),new T.MeshBasicMaterial({map:displayTex,toneMapped:false}));
 display.position.set(-.379,.813,-.625);display.rotation.x=-.20;body.add(display);let lastDisplay='';
 function dashboard(c){const speed=Math.round(c.speed*3.6),rpm=Math.round(c.rpm/150),label=[speed,rpm,c.gear].join();
   if(label===lastDisplay)return;lastDisplay=label;dc.fillStyle='#101819';dc.fillRect(0,0,512,192);
   dc.fillStyle='#566465';dc.fillRect(26,28,460,12);dc.fillStyle=rpm>52?'#ff7650':'#d4e693';dc.fillRect(26,28,460*Math.min(1,rpm/57),12);
   dc.fillStyle='#edf2e6';dc.font='bold 90px Arial';dc.fillText(speed,28,137);dc.font='22px Arial';dc.fillText('KM/H',32,169);
   dc.textAlign='right';dc.font='bold 83px Arial';dc.fillText(c.gear===0?'N':c.gear<0?'R':c.gear,480,136);dc.font='20px Arial';dc.fillText('GEAR',480,169);dc.textAlign='left';displayTex.needsUpdate=true;
 }
 // Cache transforms in the car frame so denting stays attached to individual body panels.
 root.updateMatrixWorld(true);const panels=[],scratch=new T.Vector3(),previousDamage=[0,0,0,0];
 model.traverse(o=>{if(!o.isMesh)return;let node=o,label='';while(node&&node!==model){label+=' '+node.name;node=node.parent;}
   if(!/Bumper|Fender|Boot_Lid|Obj_Hood|Obj_Gruppe_Main|Obj_Exhaust|Obj_Doors|Tail_Light|HeadLight|Obj_Engine_Cover/i.test(label))return;
   const geo=o.geometry.clone();o.geometry=geo;const pos=geo.attributes.position;
   panels.push({geo,pos,origin:pos.clone(),toCar:o.matrixWorld.clone(),toPanel:o.matrixWorld.clone().invert()});
 });
 function deform(d){if(d.every((n,i)=>n===previousDamage[i]))return;
   for(const {geo,pos,origin,toCar,toPanel} of panels){for(let i=0;i<pos.count;i++){
      scratch.fromBufferAttribute(origin,i).applyMatrix4(toCar);const x=scratch.x,z=scratch.z;
      const front=Math.pow(T.MathUtils.clamp((-z-1)/1.4,0,1),1.45)*d[0],rear=Math.pow(T.MathUtils.clamp((z-1)/1.4,0,1),1.45)*d[1];
      const side=(x<0?d[2]:d[3])*Math.pow(T.MathUtils.clamp((Math.abs(x)-.48)/.55,0,1),2);
      scratch.z+=(front-rear)*.49;scratch.x-=Math.sign(x)*side*.23;
      scratch.y+=(front+rear)*(.13+.065*Math.sin(x*14))+side*.04*Math.cos(z*9);
      scratch.applyMatrix4(toPanel);pos.setXYZ(i,scratch.x,scratch.y,scratch.z);
   }pos.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();}
   d.forEach((n,i)=>previousDamage[i]=n);
 }
 const shadow=document.createElement('canvas');shadow.width=shadow.height=128;const g=shadow.getContext('2d');const grad=g.createRadialGradient(64,64,5,64,64,63);grad.addColorStop(0,'rgba(10,15,15,.78)');grad.addColorStop(.43,'rgba(10,15,15,.63)');grad.addColorStop(1,'rgba(10,15,15,0)');g.fillStyle=grad;g.fillRect(0,0,128,128);
 const blob=new T.Mesh(new T.PlaneGeometry(3.3,6.15),new T.MeshBasicMaterial({map:new T.CanvasTexture(shadow),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));blob.rotation.x=-Math.PI/2;blob.position.y=.027;root.add(blob);
 const axisY=new T.Vector3(0,1,0),axisZ=new T.Vector3(0,0,1),q=new T.Quaternion();
 return {root,update(car,dt){deform(car.damage);dashboard(car);steering.quaternion.setFromAxisAngle(steeringAxis,-car.steer*12);root.position.set(car.x,.015,car.z);root.rotation.y=-car.heading;suspension.rotation.x=car.pitch;suspension.rotation.z=car.roll;
    angle=(angle+car.forward*dt/.355)%(2*Math.PI);
    for(const [wheel,base,side]of rotors)wheel.quaternion.copy(base).multiply(q.setFromAxisAngle(axisZ,angle*side));
    for(const [hub,base]of hubs)hub.quaternion.copy(q.setFromAxisAngle(axisY,-car.steer)).multiply(base);
    for(const m of brakes){m.emissive.setHex(0xff1807);m.emissiveIntensity=car.brake>.1?1.9:.28;}
 }};
}
function loft(sections){
 const pts=[],idx=[];for(const [z,w,b,top,wTop] of sections){pts.push(-w,b,z,w,b,z,wTop,top,z,-wTop,top,z);}
 for(let i=0;i<sections.length-1;i++)for(let j=0;j<4;j++){let a=i*4+j,b=i*4+(j+1)%4,c=b+4,d=a+4;idx.push(a,b,c,a,c,d);}
 const end=(sections.length-1)*4;idx.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts,3));g.setIndex(idx);g.computeVertexNormals();return g;}
export function traffic(scene){
 const paths=[
  [[-4,185],[-4,274],[-184,274],[-184,86],[-4,86]],
  [[-94,184],[-94,274],[-364,274],[-364,-94],[-94,-94]],
  [[4,-94],[4,-274],[-274,-274],[-274,-86],[4,-86]],
  [[-176,86],[-176,-184],[-454,-184],[-454,94],[-176,94]],
  [[-86,86],[-86,-94],[-364,-94],[-364,94],[-86,94]]];
 const cars=Array.from({length:12},(_,i)=>{const p=paths[i%paths.length],seg=i%4,progress=((i*.271)%1)*.65+.1;
    return {p,seg,progress,x:0,z:0,yaw:0,speed:6+i%5,wait:0};});
 const parked=[];for(let j=-3;j<=3;j++){for(let k=0;k<3;k++){const z=j*90+24+k*8.2;parked.push({x:-6.7,z,yaw:Math.PI,parked:true},{x:-180+6.7,z:z-6,yaw:0,parked:true});}parked.push({x:-38,z:j*90+6.8,yaw:Math.PI/2,parked:true});}cars.push(...parked);
 const circuit=motorway.length+740;
 for(let i=0;i<32;i++){const direction=i%2===0?1:-1,outer=i%4<2,targetSpeed=outer?22:29;
   cars.push({motorway:true,direction,outer,progress:(i+.37)*circuit/32,speed:targetSpeed,targetSpeed,x:0,z:0,yaw:0});}
 for(const c of cars){const speed=c.speed;Object.assign(c,body(c.x,c.z,.87,2.05,1450,-c.yaw));c.speed=speed??0;}
 const initial=cars.map(c=>({...c}));
 const highwayCars=cars.filter(c=>c.motorway);
 const meshParts=[],dummy=new T.Object3D(),local=new T.Object3D(),matrix=new T.Matrix4();
 const cube=new T.BoxGeometry(1,1,1), wheel=new T.CylinderGeometry(.315,.315,.19,12);wheel.rotateZ(Math.PI/2);
 const material=(color,metalness=0,roughness=.55)=>new T.MeshStandardMaterial({color,metalness,roughness,side:T.DoubleSide});
 function part(geo,mat,x,y,z,sx=1,sy=1,sz=1,tint=false){const m=new T.InstancedMesh(geo,mat,cars.length);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;scene.add(m);local.position.set(x,y,z);local.scale.set(sx,sy,sz);local.updateMatrix();meshParts.push([m,local.matrix.clone()]);if(tint)cars.forEach((c,i)=>m.setColorAt(i,new T.Color([0x657f87,0x943d30,0xe1d7c1,0x485258,0xa9b5b1,0x384e70][i%6])));}
 part(loft([[-2,.75,.34,.66,.78],[-1.5,.87,.31,.86,.85],[1.46,.87,.32,.88,.85],[2.05,.78,.39,.72,.73]]),material(0xffffff,.45,.3),0,0,0,1,1,1,true);
 part(loft([[-1.05,.78,.82,.84,.75],[-.48,.73,.83,1.39,.63],[.56,.75,.83,1.42,.65],[1.34,.79,.83,.94,.7]]),material(0x39494d,.55,.24),0,0,0);
 part(cube,material(0xffffff,.36),0,1.41,.08,1.26,.07,1.08,true);
 for(let x of [-.82,.82])for(let z of [-1.28,1.26])part(wheel,material(0x25292a),x,.33,z);
 for(let x of [-.59,.59]){part(cube,material(0xf1e6c7),x,.65,-2.01,.31,.12,.05);part(cube,material(0xc44337),x,.67,2.055,.34,.12,.045);}
 function update(dt,player){for(let i=0;i<cars.length;i++){const c=cars[i];
   if(c.crashed){drift(c,dt);c.yaw=-c.heading;continue;}
   const oldX=c.x,oldZ=c.z;
   if(c.motorway){
     const dx=player.x-c.x,dz=player.z-c.z,fx=-Math.sin(c.yaw),fz=-Math.cos(c.yaw);
     const forward=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx);
     const inTown=c.progress>=motorway.length;
     let target=inTown?9:c.targetSpeed;
     if(forward>0&&forward<45&&lateral<2.1)target=Math.min(target,Math.max(0,(forward-6)*.58+player.vx*fx+player.vz*fz));
     // Opposing traffic occupies a separate carriageway. Both same-direction lanes meet on Lungomare.
     const narrows=inTown||c.progress<230||c.progress>motorway.length-230;
     for(const leader of highwayCars){
       if(leader.crashed||leader===c||leader.direction!==c.direction||(!narrows&&leader.outer!==c.outer))continue;
       const gap=((leader.progress-c.progress)*c.direction+circuit)%circuit;
       if(gap<55)target=Math.min(target,Math.max(0,leader.speed+(gap-6-c.speed*.75)*.65));
     }
     c.speed+=T.MathUtils.clamp(target-c.speed,-6*dt,2*dt);
     c.progress=(c.progress+c.direction*c.speed*dt+circuit)%circuit;
     if(c.progress<motorway.length){const p=lane(motorway,c.progress,c.direction,c.outer);c.x=p.x;c.z=p.z;c.yaw=-p.heading;}
     else{c.x=4*c.direction;c.z=370-(c.progress-motorway.length);c.yaw=c.direction===1?0:Math.PI;}
   }else if(!c.parked){let a=c.p[c.seg],b=c.p[(c.seg+1)%c.p.length],len=Math.hypot(a[0]-b[0],a[1]-b[1]);
   const fx=(b[0]-a[0])/len,fz=(b[1]-a[1])/len,dx=player.x-c.x,dz=player.z-c.z;
   const ahead=dx*fx+dz*fz;const mustYield=ahead>0&&ahead<11&&Math.abs(dx*fz-dz*fx)<2.4;
   if(c.wait>0)c.wait=Math.max(0,c.wait-dt);else if(!mustYield)c.progress+=dt*c.speed/len;
   if(c.progress>=1){c.seg=(c.seg+1)%c.p.length;c.progress=0;c.wait=.45;a=b;b=c.p[(c.seg+1)%c.p.length];}
   c.x=T.MathUtils.lerp(a[0],b[0],c.progress);c.z=T.MathUtils.lerp(a[1],b[1],c.progress);c.yaw=Math.atan2(-(b[0]-a[0]),-(b[1]-a[1]));}
   c.heading=-c.yaw;
   if(dt>0){c.vx=(c.x-oldX)/dt;c.vz=(c.z-oldZ)/dt;}
   }
 }
 function render(){for(let i=0;i<cars.length;i++){const c=cars[i];
   c.yaw=-c.heading;
   dummy.scale.set(1-.12*Math.max(c.damage[2],c.damage[3]),1,1-.18*Math.max(c.damage[0],c.damage[1]));
   dummy.position.set(c.x,0,c.z);dummy.rotation.y=c.yaw;dummy.updateMatrix();for(const [m,l]of meshParts)m.setMatrixAt(i,matrix.multiplyMatrices(dummy.matrix,l));}
  for(const [m]of meshParts)m.instanceMatrix.needsUpdate=true;}
 return {cars,update,render,reset(player){
   cars.forEach((c,i)=>Object.assign(c,initial[i],{damage:[0,0,0,0],crashed:false}));
   update(0,player);render();
 }};
}
