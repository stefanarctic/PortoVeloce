// Distances and cross sections are in metres. Positive offsets are to the driver's right.
const curves=[
  [[0,-370],[0,-520],[0,-740],[-90,-920]],
  [[-90,-920],[-255,-1250],[-520,-1460],[-880,-1460]],
  [[-880,-1460],[-1400,-1460],[-1700,-1360],[-1700,-865]],
  [[-1700,-865],[-1700,-280],[-1700,280],[-1700,865]],
  [[-1700,865],[-1700,1240],[-1480,1450],[-1100,1450]],
  [[-1100,1450],[-610,1450],[-320,1490],[-140,1160]],
  [[-140,1160],[0,903],[0,655],[0,370]]
];
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function interpolateArc(control){
  const out=[];
  for(const [a,b,c,d] of control){
    const length=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    const steps=Math.ceil((length(a,b)+length(b,c)+length(c,d))/8);
    for(let i=out.length?1:0;i<=steps;i++){
      const t=i/steps,h=1-t;
      const x=h*h*h*a[0]+3*h*h*t*b[0]+3*h*t*t*c[0]+t*t*t*d[0];
      const z=h*h*h*a[1]+3*h*h*t*b[1]+3*h*t*t*c[1]+t*t*t*d[1];
      const dx=h*h*(b[0]-a[0])+2*h*t*(c[0]-b[0])+t*t*(d[0]-c[0]);
      const dz=h*h*(b[1]-a[1])+2*h*t*(c[1]-b[1])+t*t*(d[1]-c[1]);
      const norm=Math.hypot(dx,dz),prev=out[out.length-1];
      out.push({x,z,tx:dx/norm,tz:dz/norm,s:prev?prev.s+Math.hypot(x-prev.x,z-prev.z):0});
    }
  }
  return out;
}
export function profile(s){
  const t=clamp((Math.min(s,main.length-s)-22)/165,0,1);
  const blend=t*t*(3-2*t);
  return {width:8.05+4.7*blend,median:.12+.92*blend,blend};
}
function road(id,control,halfWidth){const points=interpolateArc(control);return {id,points,halfWidth,length:points[points.length-1].s};}
export const main=road('A1',curves,12.75);
export const link=road('Centro',[[[-548,0],[-780,0],[-1120,0],[-1360,0]]],8);
export const entry=road('Entry',[[[-1358,-4],[-1570,-4],[-1662,-33],[-1682,-125]],[[-1682,-125],[-1691,-166],[-1692,-234],[-1692,-316]]],4.1);
export const exit=road('Exit',[[[-1692,316],[-1692,197],[-1685,130],[-1640,88]],[[-1640,88],[-1586,38],[-1545,4],[-1358,4]]],4.1);
export const townRamps=[
  road('Bellacosta exit',[[[-1708,-850],[-1708,-745],[-1810,-650],[-2030,-650]]],4.1),
  road('Bellacosta entry',[[[-2030,-650],[-1830,-650],[-1708,-595],[-1708,-430]]],4.1),
  road('Valdoro exit',[[[-1708,360],[-1708,545],[-1820,650],[-2030,650]]],4.1),
  road('Valdoro entry',[[[-2030,650],[-1830,650],[-1708,690],[-1708,855]]],4.1)
];
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function westStation(z){return main.points.filter(p=>p.x<-1500).reduce((a,b)=>Math.abs(a.z-z)<Math.abs(b.z-z)?a:b).s;}
function turnaround(id,startZ,endZ,direction,interior){
  const startS=westStation(startZ),endS=westStation(endZ);
  const a=at(main,startS),b=at(main,endS),start=offset(a,direction*8.55),finish=offset(b,-direction*8.55);
  const first=[start.x,start.z],last=[finish.x,finish.z];
  const control=[
    [first,[first[0]+a.tx*direction*110,first[1]+a.tz*direction*110],...interior[0]],
    ...interior.slice(1,-1),
    [...interior.at(-1),[last[0]+b.tx*direction*100,last[1]+b.tz*direction*100],last]
  ];
  const r=road(id,control,4.1);
  Object.assign(r,{startS,endS,direction,oneWay:true});
  // Stay level through the highway merges; the maximum approach grade is 5.3%.
  r.height=s=>7*Math.min(smooth((s-55)/200),smooth((r.length-s-55)/200));
  return r;
}
export const turnarounds=[
  turnaround('North turnaround',-570,-985,-1,[
    [[-1545,-690],[-1545,-850]],
    [[-1545,-850],[-1545,-1020],[-1545,-1150],[-1640,-1150]],
    [[-1640,-1150],[-1685,-1150],[-1750,-1150],[-1800,-1150]],
    [[-1800,-1150],[-1830,-1150],[-1840,-1120],[-1840,-1080]],
    [[-1840,-1080],[-1840,-1000]]
  ]),
  turnaround('South turnaround',985,950,1,[
    [[-1835,1120],[-1835,1210]],
    [[-1835,1210],[-1835,1340],[-1790,1390],[-1690,1390]],
    [[-1690,1390],[-1590,1390],[-1480,1390],[-1410,1390]],
    [[-1410,1390],[-1330,1390],[-1310,1320],[-1340,1250]],
    [[-1340,1250],[-1400,1110]]
  ])
];
export const circuit=road('Autodromo Riviera',[
  [[-520,1000],[-520,860],[-520,720],[-520,580]],
  [[-520,580],[-520,480],[-580,430],[-680,430]],
  [[-680,430],[-820,430],[-970,430],[-1110,430]],
  [[-1110,430],[-1260,430],[-1330,500],[-1330,620]],
  [[-1330,620],[-1330,730],[-1160,710],[-1160,800]],
  [[-1160,800],[-1160,885],[-1270,890],[-1270,970]],
  [[-1270,970],[-1270,1100],[-1220,1180],[-1090,1180]],
  [[-1090,1180],[-970,1180],[-930,1080],[-850,1080]],
  [[-850,1080],[-760,1080],[-770,1180],[-680,1180]],
  [[-680,1180],[-570,1180],[-520,1120],[-520,1000]]
],7.5);
Object.assign(circuit,{kind:'circuit',oneWay:true,surfaceMargin:1.2,startLine:100});
const pitStart=at(circuit,circuit.length-70),pitFinish=at(circuit,400);
export const pitLane=road('Pit lane',[
  [[pitStart.x,pitStart.z],[pitStart.x+pitStart.tx*45,pitStart.z+pitStart.tz*45],[-475,1050],[-475,990]],
  [[-475,990],[-475,880],[-475,760],[-475,650]],
  [[-475,650],[-475,600],[pitFinish.x-pitFinish.tx*50,pitFinish.z-pitFinish.tz*50],[pitFinish.x,pitFinish.z]]
],4.5);
Object.assign(pitLane,{kind:'pit',oneWay:true});
export const circuitAccess=road('Autodromo access',[
  [[-850,0],[-850,100],[-850,220],[-850,300]],
  [[-850,300],[-850,365],[-720,385],[-650,385]],
  [[-650,385],[-490,385],[-370,385],[-370,510]],
  [[-370,510],[-370,620],[-370,720],[-370,770]],
  [[-370,770],[-370,815],[-425,820],[-475,820]]
],7);
circuitAccess.kind='access';
export const circuitBounds={left:-1410,right:-340,top:390,bottom:1250};
export function inCircuit(x,z){return x>circuitBounds.left&&x<circuitBounds.right&&z>circuitBounds.top&&z<circuitBounds.bottom;}
export function paddockPaved(x,z){return x>=-480&&x<=-451&&z>=690&&z<=970;}
export function nearestOnRoad(road,x,z){
  let best=null;
  for(let i=1;i<road.points.length;i++){
    const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+t*dx,pz=a.z+t*dz,distance=Math.hypot(x-px,z-pz);
    if(!best||distance<best.distance)best={road,s:a.s+t*(b.s-a.s),distance,x:px,z:pz};
  }return best;
}
// Lap eligibility must not depend on which overlapping road wins locate().
// The painted runoff and gravel are legal; only the grass beyond them is out.
export function circuitLapSample(x,z,y=0){
  const p=nearestOnRoad(circuit,x,z);
  if(Math.abs(y)>.6)return {station:null,safe:false};
  if(p.distance<=22.08)return {station:p.s,safe:true};
  const paved=paddockPaved(x,z)||[pitLane,circuitAccess].some(r=>nearestOnRoad(r,x,z).distance<=r.halfWidth+.08);
  return {station:null,safe:paved};
}
export function circuitLapState(car){
  const sample=circuitLapSample(car.x,car.z,car.y),sn=Math.sin(car.heading),cs=Math.cos(car.heading);
  // Match the physics wheelbase and check tire contact rather than body overhang.
  for(const side of [-.9,.9])for(const axle of [-1.15,1.55]){
    if(!circuitLapSample(car.x+cs*side+sn*axle,car.z+sn*side-cs*axle,car.y).safe)sample.safe=false;
  }
  return sample;
}
export function circuitRecovery(x,z){
  if(!inCircuit(x,z))return null;
  const p=nearestOnRoad(circuit,x,z),pit=nearestOnRoad(pitLane,x,z),access=nearestOnRoad(circuitAccess,x,z);
  const nearest=[p,pit,access].reduce((a,b)=>a.distance<b.distance?a:b);
  return lane(nearest.road,nearest.s);
}
export const network=[main,link,entry,exit,...townRamps,...turnarounds,circuit,pitLane,circuitAccess];
export function offset(p,side){return {x:p.x-p.tz*side,z:p.z+p.tx*side,y:p.y??0};}
export function at(road,s){
  const pts=road.points;s=clamp(s,0,road.length);
  let lo=0,hi=pts.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].s>s)hi=m;else lo=m;}
  const a=pts[lo],b=pts[hi],t=(s-a.s)/(b.s-a.s);
  const tx=a.tx+(b.tx-a.tx)*t,tz=a.tz+(b.tz-a.tz)*t,n=Math.hypot(tx,tz);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:road.height?.(s)??0,tx:tx/n,tz:tz/n,s};
}
// A coarse grid keeps surface, recovery and minimap lookups local to the driver.
const grid=new Map(),cell=96;
for(const road of network)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i],pad=34;
  const seg={a,b,road};
  for(let x=Math.floor((Math.min(a.x,b.x)-pad)/cell);x<=Math.floor((Math.max(a.x,b.x)+pad)/cell);x++)
    for(let z=Math.floor((Math.min(a.z,b.z)-pad)/cell);z<=Math.floor((Math.max(a.z,b.z)+pad)/cell);z++){
      const key=x+','+z;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);
    }
}
export function locate(x,z,y=0){
  const bucket=grid.get(Math.floor(x/cell)+','+Math.floor(z/cell));if(!bucket)return null;
  let best=null,distance=Infinity;
  for(const {a,b,road} of bucket){
    const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const px=a.x+t*dx,pz=a.z+t*dz,dist=Math.hypot(x-px,z-pz);

    const s=a.s+(b.s-a.s)*t,width=road===main?profile(s).width:road.halfWidth+(road.surfaceMargin??0);
    const elevation=road.height?.(s)??0;
    if(Math.abs(elevation-y)>1.8)continue;
    // At merges a point inside either paved strip must keep its road grip.
    const paved=dist<=width;
    if(best && (best.paved===paved ? dist>=distance : best.paved))continue;
    distance=dist;const n=Math.hypot(dx,dz);
    best={road,s,x:px,z:pz,y:elevation,tx:dx/n,tz:dz/n,lateral:((z-pz)*dx-(x-px)*dz)/n,distance:dist,paved:dist<=width};
  }
  return best&&distance<32?best:null;
}
export function lane(road,s,direction=1,outer=true){
  const p=at(road,s);
  let side=0;if(road===main){const {blend}=profile(s);side=direction*(4+(outer?4.55:-.92)*blend);}
  else if(road===link||road===circuitAccess)side=direction*(road===link?4:3.5);
  const q=offset(p,side);return {...q,heading:Math.atan2(direction*p.tx,-direction*p.tz)};
}
export function recovery(x,z,y=0){
  const p=locate(x,z,y);if(!p)return null;
  const dir=p.road===entry||p.road===exit||p.road.oneWay||townRamps.includes(p.road)?1:(p.lateral>=0?1:-1);
  return lane(p.road,p.s,dir,true);
}
// Keep the same deck through an over/under crossing; never snap between layers.
export function followRoadHeight(b,dt){
  const p=locate(b.x,b.z,b.y??0);
  if(p?.paved&&Math.abs(p.y-(b.y??0))<.6){
    b.y=p.y;b.verticalSpeed=0;
    const grade=((p.road.height?.(p.s+1)??0)-(p.road.height?.(p.s-1)??0))/2;
    b.roadPitch=Math.atan(grade*(p.tx*Math.sin(b.heading??0)-p.tz*Math.cos(b.heading??0)));
  }
  else {b.verticalSpeed=(b.verticalSpeed??0)-9.81*dt;b.y=Math.max(0,(b.y??0)+b.verticalSpeed*dt);if(b.y===0)b.verticalSpeed=0;}
}
