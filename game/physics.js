import {collide} from './collisions.js';
import {followRoadHeight} from './highway-layout.js';
export const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
export const ratios=[0,3.909,2.438,1.81,1.458,1.185,.967,.844];
const finalDrive=3.43, radius=.355, mass=1690, torqueCurve=[[800,236],[2000,380],[3500,535],[5500,690],[7000,650],[8250,596],[8600,440]];
function torque(rpm){
  for(let i=1;i<torqueCurve.length;i++){
    const [r,t]=torqueCurve[i],[prev,v]=torqueCurve[i-1];
    if(rpm<=r)return v+(t-v)*clamp((rpm-prev)/(r-prev),0,1);
  }
  return 410;
}
export class Car {
  constructor(){this.mass=mass;this.w=.98;this.d=2.34;this.inertia=2650;this.auto=false;this.reset();}
  reset(x=4,z=82,heading=0,y=0){
    Object.assign(this,{x,z,heading,vx:0,vz:0,yawRate:0,steer:0,rpm:900,gear:1,cut:0,blip:0,integrity:1,damage:[0,0,0,0],throttle:0,brake:0,speed:0,forward:0,travel:0,slip:0,ax:0,ay:0,roll:0,pitch:0,impact:0,shiftCount:0,blocked:false});
    this.y=y;this.roadPitch=0;this.verticalSpeed=0;this.crashed=false;this.shiftDuration=0;this.shiftStartRpm=900;this.engagement=1;
  }
  shift(next){
    if(!Number.isInteger(next)||next===this.gear||next < -1||next>7)return false;
    if(this.cut>0 && next>0 && this.gear>0)return false;
    if(next>0 && Math.max(this.forward,0)*ratios[next]*finalDrive*60/(2*Math.PI*radius)>8650)return false;
    const downshift=next>0&&next<this.gear;
    this.shiftDuration=next>0&&this.gear>0?(downshift?.38:.32):.125;
    this.shiftStartRpm=this.rpm;
    this.blip=downshift?this.shiftDuration:0;
    this.gear=next;this.cut=this.shiftDuration;this.shiftCount++;return true;
  }
  step(dt,input,offroad=false){
    const sin=Math.sin(this.heading),cos=Math.cos(this.heading);
    const u=this.vx*sin-this.vz*cos, v=this.vx*cos+this.vz*sin, absU=Math.abs(u);
    const lastU=this.forward;
    this.forward=u;
    this.throttle+=(input.gas-this.throttle)*(1-Math.exp(-dt*10));
    this.brake+=(input.brake-this.brake)*(1-Math.exp(-dt*20));
    this.cut=Math.max(0,this.cut-dt);this.blip=Math.max(0,this.blip-dt);this.impact=Math.max(0,this.impact-2*dt);
    const ratio=this.gear<0?-2.93:ratios[this.gear];
    // While rolling against the selected gear, the slipping clutch transmits opposing torque.
    const drivenSpeed=Math.max(0,u*Math.sign(ratio));
    const wheelRpm=drivenSpeed*Math.abs(ratio)*finalDrive*60/(2*Math.PI*radius);
    const uncoupled=!ratio||input.clutch||this.cut>0;
    const target=uncoupled?900+this.throttle*7710:Math.max(900+this.throttle*1750,wheelRpm);
    if(this.cut>0&&ratio&&!input.clutch){
      // Brief actuator delay, then an eased rev match through the open clutch.
      const progress=clamp((this.shiftDuration-this.cut-.055)/(this.shiftDuration-.055),0,1);
      const blend=progress*progress*(3-2*progress);
      const matchedRpm=Math.max(900+this.throttle*1750,wheelRpm);
      this.rpm=this.shiftStartRpm+(matchedRpm-this.shiftStartRpm)*blend;
    }else{
      this.rpm+=clamp(target-this.rpm,-dt*13500,dt*(uncoupled?6400:17000));
    }
    this.engagement+=(Number(!uncoupled)-this.engagement)*(1-Math.exp(-dt*25));
    this.rpm=clamp(this.rpm,850,8650);
    if(this.auto&&!input.clutch&&this.gear>0&&this.cut===0){
      if(wheelRpm>(this.throttle>.55?8150:4700)&&this.gear<7)this.shift(this.gear+1);
      else if(wheelRpm<2600&&this.gear>1)this.shift(this.gear-1);
    }
    const coupled=!uncoupled&&this.cut===0;
    let drive=coupled&&wheelRpm<8520?this.throttle*torque(this.rpm)*ratio*finalDrive*.91/radius*(.6+.4*this.integrity)*this.engagement:0;
    const drag=.5*1.225*.68*u*absU;
    // Resolve brake and rolling forces against current motion, including the near-stop case.
    const rolling=mass*9.81*(offroad?.035:.014), engineBrake=coupled?Math.min(1400,Math.abs(ratio)*this.rpm*.043)*(1-this.throttle):0;
    const resistance=rolling+this.brake*mass*11.7+engineBrake+(input.handbrake?mass*2.7:0);
    let fx=drive-drag-clamp(u*mass/dt+drive-drag,-resistance,resistance);
    const grip=offroad?.74:1.22;
    const a=1.55,b=1.15,wheelbase=a+b;
    const frontLoad=mass*9.81*b/wheelbase,rearLoad=mass*9.81*a/wheelbase;
    // Keep full steering lock for tight city turns. Scale keyboard and stick lock to tire capacity at speed.
    const lateralLimit=9.81*grip;
    const steerLimit=Math.min(.55,Math.atan(wheelbase*lateralLimit/Math.max(1,u*u))+.045);
    const requestedSteer=input.turn*steerLimit;
    const response=Math.abs(requestedSteer)<Math.abs(this.steer)?10:6.8;
    this.steer+=(requestedSteer-this.steer)*(1-Math.exp(-dt*response));
    const sign=u<0?-1:1;
    const fSlip=Math.atan2(v+a*this.yawRate,Math.max(2,absU))-this.steer*sign;
    const rSlip=Math.atan2(v-b*this.yawRate,Math.max(2,absU));
    const fMax=frontLoad*grip,rMax=rearLoad*grip*(input.handbrake?.42:1.10);
    const fyFront=-fMax*Math.tanh(8.4*fSlip),fyRear=-rMax*Math.tanh(10.5*rSlip);
    const side=fyFront+fyRear;
    const avail=Math.sqrt(Math.max(.13,1-Math.pow(clamp(Math.abs(side)/(fMax+rMax),0,1),2)));
    fx=clamp(fx,-mass*11.7*grip*avail,mass*10.1*grip*avail);
    const dynamic=clamp((absU-1)/5,0,1);
    const yawTorque=a*fyFront-b*fyRear;
    this.yawRate+=dynamic*yawTorque/2650*dt;
    const lowSpeedYaw=u*Math.tan(this.steer)/wheelbase;
    this.yawRate+=(lowSpeedYaw-this.yawRate)*(1-dynamic)*(1-Math.exp(-dt*13));
    // An electronic stability assist damps excess yaw after the tires saturate or the driver unwinds the wheel.
    if(!input.handbrake&&this.impact<.1){
      const maxYaw=lateralLimit/Math.max(absU,3);
      const reference=clamp(u*Math.tan(this.steer)/(wheelbase+.0035*u*u),-maxYaw,maxYaw);
      const allowed=clamp(this.yawRate,Math.min(0,reference)-.025,Math.max(0,reference)+.025);
      this.yawRate+=(allowed-this.yawRate)*dynamic*(1-Math.exp(-dt*4.8));
    }
    this.heading+=this.yawRate*dt;
    this.vx+=(fx*sin+side*cos)/mass*dt;this.vz+=(-fx*cos+side*sin)/mass*dt;
    if(absU<.3&&Math.abs(v)<.3&&Math.abs(drive)<resistance){this.vx=this.vz=this.yawRate=0;}
    this.x+=this.vx*dt;this.z+=this.vz*dt;this.speed=Math.hypot(this.vx,this.vz);this.travel+=this.speed*dt;
    followRoadHeight(this,dt);
    this.ax=clamp((u-lastU)/dt,-14,14);this.ay=side/mass;
    this.pitch+=(this.ax*.003-this.pitch)*(1-Math.exp(-dt*6));
    this.roll+=(this.ay*.004-this.roll)*(1-Math.exp(-dt*7));
    this.slip=clamp((Math.max(Math.abs(fSlip),Math.abs(rSlip))-.075)*3.3,0,1)*clamp(absU/7,0,1);
  }
  collide(box){return collide(this,box);}
}
