import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaults,normalizeSettings,loadSettings,gamepadSteer,settingGroups} from '../game/settings.js';
import {Car} from '../game/physics.js';
assert.deepEqual(normalizeSettings(null),defaults);
assert.deepEqual(normalizeSettings({volume:NaN,automatic:'yes',camera:'99',steering:Infinity}),defaults);
assert.equal(normalizeSettings({volume:200}).volume,100);
assert.equal(normalizeSettings({steering:-100}).steering,.3);
assert.equal(loadSettings((key,fallback)=>({auto:'1',mute:'1',settings:'{broken'}[key]??fallback)).automatic,true);
const customized={...defaults,volume:24,automatic:true,steering:.65,deadzone:.2,shadows:'off',units:'imperial'};
assert.deepEqual(loadSettings((key,fallback)=>key==='settings'?JSON.stringify(customized):fallback),customized,'Saved settings survive a reload');
assert.equal(gamepadSteer(.15,customized),0);
assert.equal(gamepadSteer(1,customized),1,'Deadzone must preserve full lock');
assert.equal(gamepadSteer(-1,{...customized,invertSteering:true}),1);
assert.ok(gamepadSteer(.5,{...customized,steerCurve:2})<gamepadSteer(.5,customized));
function simulate(options,input={gas:0,brake:0,turn:.7,clutch:false,handbrake:false},speed=15,frames=30){
  const car=new Car();car.controls=options;car.reset(-520,900);car.vz=-speed;
  for(let i=0;i<frames;i++)car.step(1/120,input,false);
  assert.ok([car.x,car.z,car.steer,car.speed,car.heading].every(Number.isFinite));return car;
}
assert.equal(simulate({}).steer,simulate(defaults).steer,'Defaults preserve existing handling');
assert.ok(simulate({...defaults,steering:.4}).steer<simulate(defaults).steer);
assert.ok(simulate({...defaults,steerResponse:2}).steer>simulate({...defaults,steerResponse:.4}).steer);
assert.ok(simulate({...defaults,speedAssist:0},undefined,40).steer>simulate(defaults,undefined,40).steer);
const pedal={gas:.5,brake:.5,turn:0,clutch:false,handbrake:false};
assert.ok(simulate({...defaults,throttle:.4},pedal).throttle<simulate(defaults,pedal).throttle);
assert.ok(simulate({...defaults,braking:.4},pedal).brake<simulate(defaults,pedal).brake);
const fastReturn=simulate({...defaults,steerReturn:2}),slowReturn=simulate({...defaults,steerReturn:.4});
fastReturn.step(.02,{...pedal,turn:0},false);slowReturn.step(.02,{...pedal,turn:0},false);assert.ok(fastReturn.steer<slowReturn.steer);
for(const strength of [0,1])simulate({...defaults,stability:strength,steering:1.5,speedAssist:0},undefined,40,1200);
// Exercise the actual stereo worklet, including muting individual sound layers.
let AudioProcessor;
vm.runInNewContext(readFileSync(new URL('../game/engine.js',import.meta.url),'utf8'),{sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={};}},registerProcessor:(name,processor)=>AudioProcessor=processor});
function audioEnergy(mix){
  const engine=new AudioProcessor();Object.assign(engine.target,{rpm:5000,load:.7,slip:.6,speed:40,volume:.76,...mix});
  const output=[new Float32Array(128),new Float32Array(128)];
  for(let i=0;i<1000;i++)engine.process([],[output]);
  return output.map(channel=>channel.reduce((sum,v)=>{assert.ok(Number.isFinite(v));return sum+v*v;},0));
}
assert.ok(audioEnergy({}).every(e=>e>0));
assert.ok(audioEnergy({volume:0}).every(e=>e===0),'Master mute silences both channels');
assert.ok(audioEnergy({engineVolume:0,tireVolume:0,windVolume:0}).every(e=>e<1e-12),'All layer sliders silence both channels');
for(const layer of ['engineVolume','tireVolume','windVolume'])assert.ok(audioEnergy({engineVolume:0,tireVolume:0,windVolume:0,[layer]:1}).every(e=>e>1e-8),layer+' independently produces sound');
console.log(`Settings checks passed: ${settingGroups.flatMap(g=>g.fields).length} preferences, persistence, validation, steering/pedals and stereo audio.`);
