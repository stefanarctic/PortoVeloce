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
export const network=[main,link,entry,exit];
export function offset(p,side){return {x:p.x-p.tz*side,z:p.z+p.tx*side};}
export function at(road,s){
  const pts=road.points;s=clamp(s,0,road.length);
  let lo=0,hi=pts.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].s>s)hi=m;else lo=m;}
  const a=pts[lo],b=pts[hi],t=(s-a.s)/(b.s-a.s);
  const tx=a.tx+(b.tx-a.tx)*t,tz=a.tz+(b.tz-a.tz)*t,n=Math.hypot(tx,tz);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,tx:tx/n,tz:tz/n,s};
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
export function locate(x,z){
  const bucket=grid.get(Math.floor(x/cell)+','+Math.floor(z/cell));if(!bucket)return null;
  let best=null,distance=Infinity;
  for(const {a,b,road} of bucket){
    const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    const px=a.x+t*dx,pz=a.z+t*dz,dist=Math.hypot(x-px,z-pz);

    const s=a.s+(b.s-a.s)*t,width=road===main?profile(s).width:road.halfWidth;
    // At merges a point inside either paved strip must keep its road grip.
    const paved=dist<=width;
    if(best && (best.paved===paved ? dist>=distance : best.paved))continue;
    distance=dist;const n=Math.hypot(dx,dz);
    best={road,s,x:px,z:pz,tx:dx/n,tz:dz/n,lateral:((z-pz)*dx-(x-px)*dz)/n,distance:dist,paved:dist<=width};
  }
  return best&&distance<32?best:null;
}
export function lane(road,s,direction=1,outer=true){
  const p=at(road,s);
  let side=0;if(road===main){const {blend}=profile(s);side=direction*(4+(outer?4.55:-.92)*blend);}
  else if(road===link)side=direction*4;
  const q=offset(p,side);return {...q,heading:Math.atan2(direction*p.tx,-direction*p.tz)};
}
export function recovery(x,z){
  const p=locate(x,z);if(!p)return null;
  const dir=p.road===entry||p.road===exit?1:(p.lateral>=0?1:-1);
  return lane(p.road,p.s,dir,true);
}
