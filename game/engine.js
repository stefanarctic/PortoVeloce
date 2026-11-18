const firingOrder = [1, 12, 4, 9, 2, 11, 6, 7, 3, 10, 5, 8];
// Close tunings give each exhaust runner a distinct colour within one engine note.
const kickPitchHz = [99, 104, 97, 108, 101, 94, 103, 96, 106, 98, 102, 95];

function makeKick(pitch) {
  const wave = new Float32Array(Math.ceil(sampleRate * .036) + 2);
  let phase = 0;
  for (let i = 0; i < wave.length - 2; i++) {
    const seconds = i / sampleRate;
    const bend = Math.exp(-seconds / .0016);
    phase += 2 * Math.PI * pitch * (1 + 4 * bend) / sampleRate;
    const tail = Math.min(1, (.036 - seconds) / .004);
    wave[i] = Math.exp(-seconds / .006) * tail *
      (Math.sin(phase) + .18 * bend * Math.sin(3 * phase));
  }
  return {wave, position: wave.length, rate: 1, level: 0};
}

class Exhaust extends AudioWorkletProcessor{
  constructor(){super();this.target={rpm:900,load:0,slip:0,speed:0,cut:false,volume:.65};this.port.onmessage=e=>Object.assign(this.target,e.data);
    this.rpm=900;this.load=0;this.phase=0;this.seed=1234567;this.bank=[0,0];this.old=[0,0];this.low=0;this.flutter=0;this.slow=0;this.gain=0;this.overrun=0;this.limitPhase=0;this.bang=0;this.lastCut=false;
    this.pipes=Array.from({length:4},(_,i)=>({y:0,z:0,a:2*Math.exp(-Math.PI*[42,80,132,210][i]/sampleRate)*Math.cos(2*Math.PI*[95,235,520,1090][i]/sampleRate),b:-Math.exp(-2*Math.PI*[42,80,132,210][i]/sampleRate)}));
    this.delay=new Float32Array(Math.max(2,Math.round(sampleRate*.0048)));this.di=0;
    this.kicks=kickPitchHz.map(makeKick);
    this.lastSlot=-1;
    this.shiftGain=1;
  }
  process(_,outputs){const channels=outputs[0];if(!channels.length)return true;
    const t=this.target, dt=1/sampleRate;if(t.cut&&!this.lastCut&&this.load>.35)this.bang=.52;this.lastCut=t.cut;
    for(let i=0;i<channels[0].length;i++){
      this.rpm+=(t.rpm-this.rpm)*Math.min(1,dt*48);this.load+=(t.load-this.load)*dt*25;
      this.shiftGain+=((t.shiftGain??(t.cut?.21:1))-this.shiftGain)*(1-Math.exp(-dt*35));
      this.seed=(Math.imul(this.seed,1664525)+1013904223)|0;const noise=this.seed/2147483648;this.slow+=.035*(noise-this.slow);
      this.phase+=this.rpm*.1*dt*(1+this.slow*.006);if(this.phase>=12)this.phase-=12;
      const slot=Math.floor(this.phase), frac=this.phase-slot;
      this.limitPhase=(this.limitPhase+dt*19)%1;
      const limit=this.rpm>8500&&this.limitPhase>.57?.18:1;
      if (slot !== this.lastSlot) {
        const kick = this.kicks[firingOrder[slot] - 1];
        kick.position = 0;
        kick.rate = 1 + this.rpm / 2400 + .24 * this.load;
        kick.level = (.3 + .7 * this.load) * this.shiftGain * limit;
        this.lastSlot = slot;
      }
      this.bank[0] = this.bank[1] = 0;
      for (let cylinder = 0; cylinder < this.kicks.length; cylinder++) {
        const kick = this.kicks[cylinder];
        const index = Math.floor(kick.position);
        if (index >= kick.wave.length - 1) continue;
        const sample = kick.wave[index] + (kick.position - index) *
          (kick.wave[index + 1] - kick.wave[index]);
        this.bank[cylinder < 6 ? 0 : 1] += sample * kick.level;
        kick.position += kick.rate;
      }
      if(this.load-t.load>.18&&this.rpm>3400&&frac<.012&&noise>.76)this.overrun=.18;
      this.overrun*=1-120*dt;
      const exhaust=(this.bank[0]+this.bank[1])*.57;
      const delayed=this.delay[this.di];this.delay[this.di]=exhaust+.14*delayed;this.di=(this.di+1)%this.delay.length;
      const raw=exhaust+.28*delayed;this.low+=.024*(raw-this.low);const hp=raw-this.low;
      let resonance=0;for(let j=0;j<4;j++){const p=this.pipes[j],val=hp+p.a*p.y+p.b*p.z;p.z=p.y;p.y=val;resonance+=val*[.0008,.0014,.0025,.0028][j];}
      const wind=this.slow*Math.min(.13,t.speed*.0016), tire=t.slip*(Math.sin(this.phase*8.38)*.045+this.slow*.28);
      const mechanical=Math.sin(this.phase*Math.PI/3)*.026+Math.sin(this.phase*Math.PI)*.038;
      this.bang*=.9991;this.gain+=(t.volume-this.gain)*dt*12;
      const common=(hp*1.05+resonance+mechanical*(.5+this.load)+wind+tire+(this.bang*.18+this.overrun)*noise)*this.gain*(.72+.65*this.rpm/8500);
      channels[0][i]=Math.tanh(common+.045*(this.bank[0]-this.bank[1])*this.gain);
      if(channels[1])channels[1][i]=Math.tanh(common+.045*(this.bank[1]-this.bank[0])*this.gain);
    }return true;}
}
registerProcessor('v12-exhaust',Exhaust);
