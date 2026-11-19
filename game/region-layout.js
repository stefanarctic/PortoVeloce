// Shared town geometry for roads, terrain, navigation, traffic and recovery.
export const towns=[
  {id:'bellacosta',name:'Bellacosta',z:-650,color:0xc8ac82,theme:'historic',subtitle:'Market town · Piazza del Sole'},
  {id:'valdoro',name:'Valdoro',z:650,color:0xaab9ba,theme:'modern',subtitle:'Station district · Viale delle Industrie'}
].map(t=>({...t,x:-2480,xs:[-2930,-2780,-2630,-2480,-2330,-2180,-2030],zs:[-270,-180,-90,0,90,180,270].map(z=>z+t.z)}));
export function townAt(x,z,padding=22){return towns.find(t=>x>=t.xs[0]-padding&&x<=t.xs.at(-1)+padding&&z>=t.zs[0]-padding&&z<=t.zs.at(-1)+padding);}
export const townStreets=towns.flatMap(t=>[
  ...t.xs.map((x,i)=>({town:t,a:[x,t.zs[0]],b:[x,t.zs.at(-1)],width:i===3?20:16,name:['Via degli Ulivi','Via Roma','Via del Mercato','Corso Vittorio','Via dei Giardini','Via della Stazione','Viale A1'][i]})),
  ...t.zs.map((z,i)=>({town:t,a:[t.xs[0],z],b:[t.xs.at(-1),z],width:i===3?20:16,name:i===3?(t.theme==='historic'?'Viale Bellacosta':'Viale delle Industrie'):['Via delle Rose','Via Dante','Via Garibaldi','','Via Verdi','Via Manzoni','Via dei Pini'][i]}))
]);
export function nearestStreet(x,z){
  let best=null;
  for(const r of townStreets){const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=dx*dx+dz*dz;
    const u=Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/length));
    const px=r.a[0]+u*dx,pz=r.a[1]+u*dz,distance=Math.hypot(x-px,z-pz);
    if(!best||distance<best.distance)best={road:r,x:px,z:pz,distance,tx:dx/Math.sqrt(length),tz:dz/Math.sqrt(length)};
  }return best;
}
// Forecourts join the street surface model, so parking does not apply grass drag.
export const townLots=towns.flatMap(t=>[
  {x:-2105,z:t.z+45,w:120,d:70},
  ...(t.theme==='modern'?[
    {x:-2555,z:t.z-16,w:110,d:28},
    ...[4,5].flatMap(i=>[0,1].map(j=>({x:t.xs[i]+75,z:t.zs[j]+72,w:104,d:28})))
  ]:[])
]);
export function townPaved(x,z){
  if(!townAt(x,z,25))return false;
  if(townLots.some(p=>Math.abs(x-p.x)<=p.w/2&&Math.abs(z-p.z)<=p.d/2))return true;
  const p=nearestStreet(x,z);return !!p&&p.distance<=p.road.width/2;
}
export function townRecovery(x,z){
  const p=nearestStreet(x,z);if(!townAt(x,z,120))return null;
  return {x:p.x-p.tz*4,z:p.z+p.tx*4,heading:Math.atan2(p.tx,-p.tz)};
}
