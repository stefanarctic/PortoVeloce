import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';
registerHooks({resolve(specifier,context,next){return next(specifier==='three'?new URL('../game/vendor/three.module.min.js',import.meta.url).href:specifier,context);}});
const T=await import('three');
// Exercise actual scene geometry and collisions without requiring a GPU or asset downloads.
T.TextureLoader.prototype.load=function(){return new T.Texture();};
globalThis.document={createElement(){return {getContext(){return new Proxy({},{get:()=>()=>{}});}};}};
const {createCity,offRoad}=await import('../game/city.js');
const {towns,townStreets,townRecovery,townLots}=await import('../game/region-layout.js');
const {townRamps,main,link,entry,exit,turnarounds,network,at,lane,locate,recovery,followRoadHeight}=await import('../game/highway-layout.js');
const {Car}=await import('../game/physics.js');
const {spanFrame}=await import('../game/road-geometry.js');
const {body,collide}=await import('../game/collisions.js');
const {traffic}=await import('../game/vehicle.js');
const scene=new T.Scene(),city=createCity(scene,{capabilities:{getMaxAnisotropy:()=>8}});
let samples=0;
function clear(p,label){
  assert.equal(offRoad(p.x,p.z,p.y??0),false,`${label}: no paved surface at ${p.x},${p.z}`);
  const car=body(p.x,p.z,.99,2.4,1600,p.heading);
  car.y=p.y??0;
  for(const obstacle of city.nearby(p.x,p.z)){
    const x=car.x,z=car.z;collide(car,obstacle);
    assert.ok(Math.hypot(car.x-x,car.z-z)<.001,`${label}: obstacle at ${obstacle.x},${obstacle.z} blocks ${p.x},${p.z}`);
  }samples++;
}
for(const road of townRamps){
  for(let s=0;s<=road.length;s+=2)clear(lane(road,s),road.id);
  for(const s of [0,road.length]){const p=at(road,s);assert.ok(locate(p.x,p.z)?.paved);assert.ok(recovery(p.x,p.z));}
}
for(const road of [link,entry,exit,...turnarounds])for(let s=0;s<=road.length;s+=2){
  for(const d of road===link?[-1,1]:[1])clear(lane(road,s,d),road.id);
}
assert.ok(!network.some(r=>/Due Citta|Uscita Ponte/.test(r.id)),'Removed city-link roads must not remain in the network');
assert.equal(offRoad(-1900,0),true,'Old city bridge must no longer be a drivable road');
assert.equal(offRoad(-2030,0),true,'Old connecting avenue must be removed');
for(const ramp of [townRamps[0],townRamps[2]]){
  const p=at(ramp,0),junction=locate(p.x,p.z);
  // Use the nearby A1 station, not the coincident town-ramp segment.
  const station=main.points.reduce((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)<Math.hypot(b.x-p.x,b.z-p.z)?a:b).s;
  assert.ok(junction?.paved&&turnarounds[0].endS<station,'North turnaround must rejoin before both town exits');
}
// Regression: east/west slopes must pitch along travel, never roll across the road.
for(let yaw=-Math.PI;yaw<=Math.PI;yaw+=.2)for(const rise of [-.7,0,.7]){
  const frame=spanFrame({x:0,y:0,z:0},{x:8*Math.sin(yaw),y:rise,z:8*Math.cos(yaw)});
  const q=new T.Quaternion().setFromEuler(frame.rotation);
  assert.ok(new T.Vector3(0,0,1).applyQuaternion(q).distanceTo(frame.forward)<1e-9);
  assert.ok(Math.abs(new T.Vector3(1,0,0).applyQuaternion(q).y)<1e-9,'Rail must not lean into lane on slope');
}
scene.updateMatrixWorld(true);
const ray=new T.Raycaster();
for(const road of turnarounds){
  const start=lane(main,road.startS,road.direction),finish=lane(main,road.endS,-road.direction);
  const first=lane(road,0),last=lane(road,road.length);
  assert.ok(Math.hypot(first.x-start.x,first.z-start.z)<.001,'Ramp must depart from highway lane');
  assert.ok(Math.hypot(last.x-finish.x,last.z-finish.z)<.001,'Ramp must join opposite lane');
  assert.ok(Math.cos(last.heading-finish.heading)>.999,'Rejoin must follow highway traffic');
  assert.ok(Math.cos(first.heading-last.heading)<-.8,'Ramp must reverse travel direction');
  const b={...first,y:0};
  for(let distance=0;distance<=road.length;distance+=.5){
    const p=lane(road,distance);b.x=p.x;b.z=p.z;b.heading=p.heading;followRoadHeight(b,1/120);
    assert.ok(Math.abs(b.y-p.y)<.04,'Keep the car on its flyover surface');
    if(p.y>2)assert.equal(locate(b.x,b.z,b.y).road.id,road.id,'Never snap to the A1 below');
    assert.ok(Math.abs(recovery(b.x,b.z,b.y).y-b.y)<.04,'Recovery must preserve elevation');
  }
  const deck=scene.getObjectByName('Deck: '+road.id);
  for(let distance=15;distance<road.length-15;distance+=19)for(const side of [-3.5,0,3.5]){
    const p=at(road,distance),x=p.x-p.tz*side,z=p.z+p.tx*side;
    ray.set(new T.Vector3(x,p.y+.6,z),new T.Vector3(0,-1,0));
    const hit=ray.intersectObject(deck)[0];
    assert.ok(hit,'Continuous deck must cover both shoulders');
    assert.ok(hit.point.y<p.y-.035&&hit.point.y>p.y-.14,'Concrete must remain below asphalt, without spikes');
  }
  // Drive the actual vehicle simulation off the A1, over the bridge and back onto the opposite side.
  const car=new Car(),spawn=lane(main,road.startS-road.direction*50,road.direction);car.auto=true;car.reset(spawn.x,spawn.z,spawn.heading);
  const goals=[];for(let s=0;s<road.length;s+=16)goals.push(lane(road,s));goals.push(last,lane(main,road.endS-road.direction*65,-road.direction));
  let target=0;
  for(let i=0;i<120*600&&target<goals.length;i++){
    const p=goals[target],distance=Math.hypot(p.x-car.x,p.z-car.z);
    if(distance<1.5){target++;continue;}
    const error=Math.atan2(Math.sin(Math.atan2(p.x-car.x,-(p.z-car.z))-car.heading),Math.cos(Math.atan2(p.x-car.x,-(p.z-car.z))-car.heading));
    const speed=4;
    car.step(1/120,{gas:car.speed<speed?.3:0,brake:car.speed>speed+.3?.4:0,turn:Math.max(-1,Math.min(1,error*2)),clutch:false,handbrake:false},offRoad(car.x,car.z,car.y));
    for(const obstacle of city.nearby(car.x,car.z)){
      const x=car.x,z=car.z;collide(car,obstacle);
      assert.ok(Math.hypot(car.x-x,car.z-z)<.001,road.id+': route blocked at '+x.toFixed(1)+','+z.toFixed(1));
    }
    assert.equal(offRoad(car.x,car.z,car.y),false,road.id+': left pavement at '+car.x.toFixed(1)+','+car.z.toFixed(1));
  }
  assert.equal(target,goals.length,road.id+': must complete U-turn');
  assert.equal(car.integrity,1,'Turnaround must not damage car');
}
const upper=Object.assign(body(-1700,-1150,1,2.4,1600),{y:7}),lower=body(-1700,-1150,1,2.4,1600);
collide(upper,lower);assert.equal(upper.x,-1700);assert.equal(upper.z,-1150);assert.equal(lower.x,-1700);
for(const road of townStreets){
  const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz),tx=dx/length,tz=dz/length;
  for(let s=0;s<=length;s+=4)for(const direction of [-1,1])clear({x:road.a[0]+tx*s-tz*4*direction,z:road.a[1]+tz*s+tx*4*direction,heading:Math.atan2(direction*tx,-direction*tz)},road.town.name+' '+road.name);
}
// Existing mainline lanes must remain clear alongside the new junctions.
for(let s=0;s<main.length;s+=4){const p=at(main,s);if(p.x<-1200)for(const d of [-1,1])clear(lane(main,s,d),'A1');}
for(const t of towns){
  clear({x:t.x+4,z:t.z+65,heading:0},t.name+' spawn');
  for(const [x,z] of [[t.x+30,t.z+40],[t.xs[0]-50,t.z]])clear(townRecovery(x,z),t.name+' recovery');
}
for(const lot of townLots)assert.equal(offRoad(lot.x,lot.z),false,'Parking forecourt must have road grip');
assert.equal(offRoad(-2855,-650-135),true,'Courtyard must not be classified as a road');
const ai=traffic(scene);ai.reset({x:4,z:82,vx:0,vz:0});
for(const c of ai.cars.filter(c=>c.x<-1900&&!c.parked))clear({x:c.x,z:c.z,heading:c.heading},'Town traffic');
for(const child of scene.children){if(child.geometry){for(const v of child.geometry.attributes.position.array)assert.ok(Number.isFinite(v),'Non-finite scene vertex');}}
console.log(`Region checks passed: ${samples} drivable positions, ${townStreets.length} streets, ${townRamps.length} ramps, ${city.solids.length} colliders.`);


