// Ground-plane rigid bodies. Heading uses the same x/z rotation as Car.
export function body(x,z,w,d,mass,heading=0){
  return {x,z,w,d,mass,heading,vx:0,vz:0,yawRate:0,
    inertia:mass*(w*w+d*d)/3,damage:[0,0,0,0],integrity:1,impact:0};
}

function shape(b){
  const c=Math.cos(b.heading??0),s=Math.sin(b.heading??0);
  const axes=b.mass?[[c,s],[-s,c]]:[[b.cs??1,-(b.sn??0)],[b.sn??0,b.cs??1]];
  const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>[
    b.x+x*b.w*axes[0][0]+z*b.d*axes[1][0],
    b.z+x*b.w*axes[0][1]+z*b.d*axes[1][1]]);
  return {axes,points};
}

function damage(b,nx,nz,deltaSpeed){
  if(!b.mass)return;
  b.crashed=true;
  b.speed=Math.hypot(b.vx,b.vz);
  b.forward=b.vx*Math.sin(b.heading)-b.vz*Math.cos(b.heading);
  if(deltaSpeed<1.5)return;
  const s=Math.sin(b.heading),c=Math.cos(b.heading);
  const front=nx*s-nz*c,side=nx*c+nz*s;
  const panel=Math.abs(front)>Math.abs(side)?(front<0?0:1):(side>0?2:3);
  b.damage[panel]=Math.min(1,b.damage[panel]+deltaSpeed*.035);
  b.integrity=Math.max(.12,b.integrity-deltaSpeed*.022);
  b.impact=Math.min(1,deltaSpeed/12);
}

export function collide(a,b){
  if(Math.hypot(a.x-b.x,a.z-b.z)>Math.hypot(a.w,a.d)+Math.hypot(b.w,b.d))return 0;
  const sa=shape(a),sb=shape(b);
  let penetration=Infinity,nx=0,nz=0;
  for(const [x,z] of [...sa.axes,...sb.axes]){
    const ra=a.w*Math.abs(x*sa.axes[0][0]+z*sa.axes[0][1])+a.d*Math.abs(x*sa.axes[1][0]+z*sa.axes[1][1]);
    const rb=b.w*Math.abs(x*sb.axes[0][0]+z*sb.axes[0][1])+b.d*Math.abs(x*sb.axes[1][0]+z*sb.axes[1][1]);
    const distance=(a.x-b.x)*x+(a.z-b.z)*z;
    const overlap=ra+rb-Math.abs(distance);
    if(overlap<=0)return 0;
    if(overlap<penetration){penetration=overlap;const sign=distance>=0?1:-1;nx=x*sign;nz=z*sign;}
  }
  // Clip the intersecting footprint to locate the contact, including corner hits.
  let polygon=sa.points;
  for(let axis=0;axis<2;axis++)for(const sign of [-1,1]){
    const [x,z]=sb.axes[axis],extent=axis===0?b.w:b.d;
    const distance=p=>sign*((p[0]-b.x)*x+(p[1]-b.z)*z)-extent;
    const clipped=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);
      if(dp<=0)clipped.push(p);
      if((dp<=0)!==(dq<=0)){const t=dp/(dp-dq);clipped.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    }
    polygon=clipped;
  }
  if(!polygon.length)return 0;
  const px=polygon.reduce((sum,p)=>sum+p[0],0)/polygon.length;
  const pz=polygon.reduce((sum,p)=>sum+p[1],0)/polygon.length;
  const ax=px-a.x,az=pz-a.z,bx=px-b.x,bz=pz-b.z;
  const ma=1/a.mass,mb=b.mass?1/b.mass:0,ia=1/a.inertia,ib=b.mass?1/b.inertia:0;
  const correction=Math.max(0,penetration-.001)*.85/(ma+mb);
  a.x+=nx*correction*ma;a.z+=nz*correction*ma;
  if(mb){b.x-=nx*correction*mb;b.z-=nz*correction*mb;}
  const relative=()=>[
    a.vx-a.yawRate*az-((b.vx??0)-(b.yawRate??0)*bz),
    a.vz+a.yawRate*ax-((b.vz??0)+(b.yawRate??0)*bx)];
  let [vx,vz]=relative();
  const closing=-(vx*nx+vz*nz);
  if(closing<=0)return 0;
  const effectiveMass=(x,z)=>ma+mb+(ax*z-az*x)**2*ia+(bx*z-bz*x)**2*ib;
  const apply=(x,z,impulse)=>{
    a.vx+=x*impulse*ma;a.vz+=z*impulse*ma;a.yawRate+=(ax*z-az*x)*impulse*ia;
    if(mb){b.vx-=x*impulse*mb;b.vz-=z*impulse*mb;b.yawRate-=(bx*z-bz*x)*impulse*ib;}
  };
  const impulse=closing*(closing>2?1.12:1)/effectiveMass(nx,nz);
  apply(nx,nz,impulse);
  [vx,vz]=relative();
  const friction=Math.max(-impulse*.45,Math.min(impulse*.45,-(-vx*nz+vz*nx)/effectiveMass(-nz,nx)));
  apply(-nz,nx,friction);
  damage(a,nx,nz,impulse*ma);damage(b,-nx,-nz,impulse*mb);
  return closing;
}

export function drift(b,dt,friction=.65){
  const speed=Math.hypot(b.vx,b.vz),scale=Math.max(0,1-friction*9.81*dt/Math.max(speed,.001));
  b.vx*=scale;b.vz*=scale;
  b.yawRate*=Math.exp(-dt*1.4);
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.heading+=b.yawRate*dt;
  b.speed=Math.hypot(b.vx,b.vz);
  b.impact=Math.max(0,b.impact-dt*2);
}
