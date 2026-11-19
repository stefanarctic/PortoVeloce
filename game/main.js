import * as T from 'three';
import {RGBELoader} from './vendor/RGBELoader.js';
import {main as motorway,turnarounds,network,locate,lane,recovery,circuit,inCircuit,circuitRecovery,circuitLapState} from './highway-layout.js';
import {LapTimer} from './lap-timer.js';
import {Car,clamp} from './physics.js';
import {collide} from './collisions.js';
import {createCity,offRoad,roadsX,roadsZ,route} from './city.js';
import {loadAventador,traffic} from './vehicle.js';
import {towns,townStreets,townAt,nearestStreet,townRecovery} from './region-layout.js';
const $=id=>document.getElementById(id),show=(id,on)=>$(id).hidden=!on;
function fail(e){show('error',true);$('error').textContent='Unable to start the 3D renderer. '+(e.message||e);}
const stored=(key,fallback)=>{try{return localStorage.getItem('pv.'+key)??fallback;}catch{return fallback;}};
const save=(k,v)=>{try{localStorage.setItem('pv.'+k,v);}catch{}};
async function boot(){
 const renderer=new T.WebGLRenderer({canvas:$('view'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(56,1,.075,1800);scene.fog=new T.FogExp2(0xb4bdba,.0018);
 const hemi=new T.HemisphereLight(0xdce4f5,0x8f8276,.85);scene.add(hemi);
 const sun=new T.DirectionalLight(0xffd4a6,2.0);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-58,right:58,top:58,bottom:-58,near:1,far:245});sun.shadow.normalBias=.026;sun.shadow.bias=-.00019;scene.add(sun,sun.target);
 const [env,vehicle]=await Promise.all([new RGBELoader().loadAsync('assets/harbor.hdr'),loadAventador(scene)]);
 env.mapping=T.EquirectangularReflectionMapping;scene.environment=env;scene.environmentIntensity=.72;scene.background=env;scene.backgroundIntensity=.87;scene.backgroundRotation.y=1.7;scene.environmentRotation.y=1.7;
 const lap=new LapTimer(circuit.length,circuit.startLine,Number(stored('rivieraBest','0')));
 const city=createCity(scene,renderer),ai=traffic(scene),car=new Car();car.auto=stored('auto','0')==='1';
 const gate=new T.Group(),gateMat=new T.MeshStandardMaterial({color:0xd8ef79,emissive:0xa0c143,emissiveIntensity:.55,transparent:true,opacity:.82});
 for(const side of [-1,1]){let post=new T.Mesh(new T.CylinderGeometry(.12,.12,3.7,8),gateMat);post.position.set(side*4.5,1.85,0);gate.add(post);}
 const stripe=new T.Mesh(new T.BoxGeometry(9,.025,.38),gateMat);stripe.position.y=.045;gate.add(stripe);scene.add(gate);gate.visible=false;
 let state='menu',mode='free',active=false,cam=0,menuTime=0,cameraReady=false,clock=0,gateIndex=0,elapsed=0,finished=false;
 let last=performance.now(),acc=0,lastWater=-1,lastUi=-1,noticeUntil=0,context=null,engine=null,enginePromise=null,muted=stored('mute','0')==='1';
 let prevCamX=4,prevCamZ=82;let headingCam=0,stepTime=0,volumeTime=0,frameLast=0,finishMessage='';const keys=new Set(),look=new T.Vector3(),goal=new T.Vector3(),fwd=new T.Vector3(),right=new T.Vector3(),aim=new T.Vector3();
 const input={gas:0,brake:0,turn:0,clutch:false,handbrake:false};const clockText=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(2).padStart(5,'0');
 const soundLabel=()=>{for(let id of ['soundPause','soundHome'])$(id).textContent=muted?'Sound off':'Sound on';};
 const transLabel=()=>{$('gearMode').textContent='Transmission · '+(car.auto?'Automatic':'Manual');$('trans').textContent=car.auto?'AUTO':'MANUAL';};
 function toast(s){$('notice').textContent=s;noticeUntil=performance.now()+2300;}
 function toggleTransmission(){car.auto=!car.auto;save('auto',car.auto?'1':'0');transLabel();toast(car.auto?'Automatic gearbox':'Manual paddle shift');}
 function toggleSound(){muted=!muted;save('mute',muted?'1':'0');soundLabel();if(!muted&&state==='drive')wakeAudio();audioUpdate();}
 async function wakeAudio(){try{
   if(!context)context=new AudioContext({latencyHint:'interactive'});
   await context.resume();
   if(!enginePromise)enginePromise=context.audioWorklet.addModule('engine.js').then(()=>{engine=new AudioWorkletNode(context,'v12-exhaust',{numberOfInputs:0,outputChannelCount:[2]});engine.connect(context.destination);});
   await enginePromise;audioUpdate();
 }catch(e){toast('Audio unavailable · '+e.message);}}
 function audioUpdate(){engine?.port.postMessage({rpm:car.rpm,load:Math.max(car.throttle,car.blip>0?.65:0),slip:car.slip,speed:car.speed,cut:car.cut>0,shiftGain:car.cut>0?(car.blip>0?.7:.21):1,volume:state==='drive'&&!muted?.76:0});}
 function setMode(m){mode=m;for(let [id,k]of [['free','free'],['highway','highway'],['sprint','sprint'],['track','track']]){$(id).classList.toggle('selected',k===m);$(id).setAttribute('aria-pressed',String(k===m));}
   $('start').firstElementChild.textContent=m==='track'?'Enter Autodromo Riviera':m==='sprint'?'Start harbor sprint':m==='highway'?'Drive the A1':'Start engine';show('departure',m==='free');}
 function placeGate(){gate.visible=mode==='sprint'&&active&&!finished;if(!gate.visible)return;const [x,z]=route[gateIndex],prev=gateIndex?route[gateIndex-1]:[4,82];gate.position.set(x,.02,z);gate.rotation.y=Math.atan2(x-prev[0],z-prev[1]);}
 function begin(){lap.reset();if(mode==='track'||(mode==='free'&&$('startLocation').value==='track')){const p=lane(circuit,50);car.reset(p.x,p.z,p.heading);}else if(mode==='highway'){const p=lane(motorway,235);car.reset(p.x,p.z,p.heading);}else if(mode==='free'&&$('startLocation').value.startsWith('turnaround')){const r=turnarounds[Number($('startLocation').value.at(-1))],p=lane(r,r.length*.45);car.reset(p.x,p.z,p.heading,p.y);}else {const t=mode==='free'&&towns.find(t=>t.id===$('startLocation').value);if(t)car.reset(t.x+4,t.z+65);else car.reset();}ai.reset(car);city.resetProps();gateIndex=0;elapsed=0;finished=false;active=true;cameraReady=false;finishMessage='';keys.clear();$('notice').textContent='';stepTime=0;resume();placeGate();toast(mode==='track'?'Track day · Cross the chequered line to start timing':mode==='sprint'?'Harbor sprint · Follow the lime gates':mode==='highway'?'A1 · Tangenziale costiera':car.auto?'Automatic · W to accelerate':'W to accelerate · X to shift up');}
 function resume(){state='drive';keys.clear();acc=0;last=performance.now();show('menu',false);show('pause',false);show('help',false);show('hud',true);show('race',mode==='sprint');transLabel();wakeAudio();}
 function pause(done=false){if(state!=='drive'&&!done)return;state='pause';keys.clear();show('pause',true);show('hud',false);$('pauseTitle').textContent=done?'Sprint complete':'Paused';$('result').textContent=done?finishMessage:'';show('resume',!done);$('again').textContent=mode==='sprint'?'Restart sprint':'Restart drive';audioUpdate();}
 function home(){state='menu';active=false;keys.clear();car.reset();gate.visible=false;show('menu',true);show('pause',false);show('hud',false);show('help',false);audioUpdate();}
 function openHelp(){if(state==='drive')pause();state=active?'helpPause':'helpHome';show('help',true);show('pause',false);}
 function closeHelp(){show('help',false);state=active?'pause':'menu';if(active)show('pause',true);}
 function recover(){lap.reset();if(mode==='sprint'){begin();toast('Sprint restarted');return;}let x=roadsX.reduce((a,b)=>Math.abs(b-car.x)<Math.abs(a-car.x)?b:a),z=clamp(car.z,-349,349);let saved=car.travel;const point=circuitRecovery(car.x,car.z)||(townAt(car.x,car.z)?townRecovery(car.x,car.z):recovery(car.x,car.z,car.y))||townRecovery(car.x,car.z);if(point)car.reset(point.x,point.z,point.heading,point.y??0);else car.reset(x+4,z);car.travel=saved;cameraReady=false;toast('Vehicle recovered and repaired');}
 function changeCam(){cam=(cam+1)%3;cameraReady=false;toast(['Chase camera','Driver camera','Bumper camera'][cam]);}
 function shift(n,paddle=0){if(paddle)vehicle.pullPaddle(paddle);if(!car.shift(n))return;if(car.auto&&n>0){car.auto=false;save('auto','0');transLabel();}}
 $('free').onclick=()=>setMode('free');$('highway').onclick=()=>setMode('highway');$('sprint').onclick=()=>setMode('sprint');$('track').onclick=()=>setMode('track');$('start').onclick=begin;$('resume').onclick=resume;$('again').onclick=begin;$('toMenu').onclick=home;
 $('helpHome').onclick=$('helpPause').onclick=openHelp;$('closeHelp').onclick=closeHelp;$('soundHome').onclick=$('soundPause').onclick=toggleSound;$('gearMode').onclick=toggleTransmission;
 let mapReturn='menu';
 function closeMap(){show('regionMap',false);if(mapReturn==='drive')resume();else {state=mapReturn;show('menu',state==='menu');show('pause',state==='pause');}}
 function openMap(){if(state==='map'){closeMap();return;}if(state.startsWith('help'))return;mapReturn=state;if(state==='drive')pause();state='map';keys.clear();show('menu',false);show('pause',false);show('hud',false);show('regionMap',true);drawAtlas();audioUpdate();$('closeMap').focus();}
 $('mapHome').onclick=$('mapPause').onclick=openMap;$('closeMap').onclick=closeMap;
 function fullscreen(){if(window.chrome?.webview)window.chrome.webview.postMessage('fullscreen');else if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}
 addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','F11','Tab'].includes(e.code)&&e.code!=='Tab'&&(state==='drive'||e.code==='F11'))e.preventDefault();
   if(e.repeat)return;if(e.code==='F11'){fullscreen();return;}if(e.code==='Tab'&&state==='drive'){e.preventDefault();openMap();return;}if(e.code==='Escape'){if(state==='map')closeMap();else if(state.startsWith('help'))closeHelp();else if(state==='drive')pause();else if(state==='pause'&&!finished)resume();return;}
   if(e.code==='KeyH'&&state!=='map'){if(state.startsWith('help'))closeHelp();else openHelp();return;}
   if(state!=='drive')return;keys.add(e.code);
   switch(e.code){case 'KeyX':shift(Math.min(7,car.gear+1),1);break;case 'KeyZ':shift(Math.max(-1,car.gear-1),-1);break;case 'KeyB':shift(-1);break;case 'KeyN':shift(0);break;case 'KeyM':toggleTransmission();break;case 'KeyC':changeCam();break;case 'KeyR':recover();break;}
 });addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();if(state==='drive')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='drive')pause();});
 let oldPad=[];function controls(){const p=Array.from(navigator.getGamepads?.()||[]).find(Boolean);const val=i=>p?.buttons[i]?.value||0;
   const btn=p?Array.from(p.buttons,b=>b.pressed):[];const edge=i=>btn[i]&&!oldPad[i];if(state==='drive'){if(edge(5))shift(Math.min(7,car.gear+1),1);if(edge(4))shift(Math.max(-1,car.gear-1),-1);if(edge(3))changeCam();if(edge(9))pause();}else if(state==='pause'&&!finished&&edge(9))resume();oldPad=btn;
   let steer=p?.axes[0]||0;if(Math.abs(steer)<.09)steer=0;
   input.gas=Math.max(val(7),+(keys.has('KeyW')||keys.has('ArrowUp')));input.brake=Math.max(val(6),+(keys.has('KeyS')||keys.has('ArrowDown')));
   input.turn=clamp(steer + +(keys.has('KeyD')||keys.has('ArrowRight')) - +(keys.has('KeyA')||keys.has('ArrowLeft')),-1,1);
   input.clutch=keys.has('ShiftLeft')||keys.has('ShiftRight');input.handbrake=keys.has('Space')||!!btn[0];}
 function step(dt){
   let wallContact=false,grassContact=false;
   // Substeps limit travel to less than a thin roadside obstacle at highway speed.
   const bodies=[car,...ai.cars,...city.props];
   const fastest=bodies.reduce((speed,b)=>Math.max(speed,Math.hypot(b.vx,b.vz)+Math.abs(b.yawRate)*b.d),0);
   const substeps=Math.max(2,Math.ceil(fastest*dt/.18)),slice=dt/substeps;
   for(let sub=0;sub<substeps;sub++){
     ai.update(slice,car);city.stepProps(slice);car.step(slice,input,offRoad(car.x,car.z,car.y));
     if(mode!=='sprint'&&lap.running&&!circuitLapState(car).safe)grassContact=true;
     for(let iteration=0;iteration<3;iteration++){
       for(const b of bodies){
         if(b!==car&&!b.crashed)continue;
         for(const obstacle of city.nearby(b.x,b.z)){
           const x=b.x,z=b.z,impact=collide(b,obstacle);
           if(b===car&&(impact>0||Math.hypot(b.x-x,b.z-z)>1e-7))wallContact=true;
         }
       }
       for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
         if(bodies[i]!==car&&!bodies[i].crashed&&!bodies[j].crashed)continue;
         collide(bodies[i],bodies[j]);
       }
     }
   }
   ai.render();city.renderProps();
   if(mode!=='sprint'){const p=circuitLapState(car),completed=lap.update(dt,p.station,{safe:p.safe&&!grassContact,wall:wallContact});if(completed){save('rivieraBest',String(lap.best));toast('Lap '+lap.count+' · '+clockText(completed));}}
   if(mode==='sprint'&&!finished){elapsed+=dt;let cp=route[gateIndex];
     if(Math.hypot(cp[0]-car.x,cp[1]-car.z)<5.4){if(++gateIndex===route.length){finished=true;gate.visible=false;const best=Number(stored('best','0'));if(best===0||elapsed<best)save('best',String(elapsed));
       finishMessage='Time '+clockText(elapsed)+' · Personal best '+clockText(Math.min(best||elapsed,elapsed));pause(true);}
       else{placeGate();toast('Gate '+gateIndex+' / '+route.length);}}}
 }
 function cameraPose(dt){
   if(state==='menu'||state==='helpHome'){const phase=Math.sin(menuTime*.085);goal.set(car.x+4.7+phase*.7,1.68+phase*.18,car.z-5.0+phase*.45);camera.position.copy(goal);
     fwd.set(car.x,.66,car.z);camera.lookAt(fwd);camera.translateX(-Math.min(1.65,innerWidth/innerHeight*.86));camera.fov=42;camera.updateProjectionMatrix();return;}
   const h=car.heading,back=keys.has('KeyV');fwd.set(Math.sin(h),0,-Math.cos(h));right.set(Math.cos(h),0,Math.sin(h));
   if(cameraReady&&cam===0){camera.position.x+=car.x-prevCamX;camera.position.z+=car.z-prevCamZ;look.x+=car.x-prevCamX;look.z+=car.z-prevCamZ;}prevCamX=car.x;prevCamZ=car.z;if(!cameraReady)headingCam=h;headingCam+=Math.atan2(Math.sin(h-headingCam),Math.cos(h-headingCam))*(1-Math.exp(-dt*7));
   aim.set(car.x,car.y+.78,car.z);
   if(cam===0||back){const d=back?-5.9:5.8+car.speed*.012;goal.set(car.x-Math.sin(headingCam)*d,car.y+2.0+Math.min(.55,car.speed*.008),car.z+Math.cos(headingCam)*d);
     // Shorten the boom whenever its segment meets nearby architecture.
     for(let k=1;k<=10;k++){const t=k/10,x=car.x+(goal.x-car.x)*t,z=car.z+(goal.z-car.z)*t;
       if([...city.nearby(x,z)].some(b=>car.y+.7<(b.maxY??Infinity)&&car.y+2>(b.minY??0)&&Math.abs((x-b.x)*b.cs-(z-b.z)*b.sn)<b.w+.15&&Math.abs((x-b.x)*b.sn+(z-b.z)*b.cs)<b.d+.15)){goal.lerp(aim,1-Math.max(.12,t-.13));break;}}
     aim.addScaledVector(fwd,back?0:2.4);
   }else if(cam===1){goal.set(car.x,car.y+.99,car.z).addScaledVector(right,-.34).addScaledVector(fwd,-.10);aim.copy(goal).addScaledVector(fwd,15);aim.y=car.y+.96+car.pitch*4+Math.tan(car.roadPitch)*15;}
   else{goal.set(car.x,car.y+.54,car.z).addScaledVector(fwd,2.42);aim.copy(goal).addScaledVector(fwd,15);aim.y=car.y+.66+Math.tan(car.roadPitch)*15;}
   if(!cameraReady||cam!==0||back){camera.position.copy(goal);look.copy(aim);}else{camera.position.lerp(goal,1-Math.exp(-dt*11));look.lerp(aim,1-Math.exp(-dt*16));}
   cameraReady=true;camera.lookAt(look);camera.fov=cam===1?73:cam===2?69:54+Math.min(car.speed*.19,11);camera.updateProjectionMatrix();
 }
 const mc=$('map').getContext('2d');
 const highwayPaths=network.map(road=>{const p=new Path2D();road.points.forEach((pt,i)=>{if(i)p.lineTo(pt.x,pt.z);else p.moveTo(pt.x,pt.z);});return p;});
 function drawAtlas(){
   const g=$('atlas').getContext('2d'),w=1000,h=680,scale=.19,ox=660,oz=340;
   const point=(x,z)=>[ox+x*scale,oz+z*scale];g.fillStyle='#182e30';g.fillRect(0,0,w,h);
   g.fillStyle='#24464e';g.fillRect(ox+27*scale,0,w,h);g.fillStyle='#8ba6a7';g.font='14px Segoe UI';g.fillText('MARE LIGURE',810,350);
   g.save();g.translate(ox,oz);g.scale(scale,scale);g.lineJoin='round';g.lineCap='round';
   for(let i=0;i<highwayPaths.length;i++){
     if(turnarounds.includes(network[i])){g.strokeStyle='#182e30';g.lineWidth=36;g.stroke(highwayPaths[i]);}
     g.strokeStyle=network[i]===circuit?'#ec9b85':turnarounds.includes(network[i])?'#f2c485':i===0?'#d5e79b':'#9bad86';g.lineWidth=i===0?22:13;g.stroke(highwayPaths[i]);
   }
   g.strokeStyle='#7c9291';g.lineWidth=10;
   const line=(a,b)=>{g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();};
   for(const x of roadsX)line([x,-360],[x,360]);for(const z of roadsZ)line([-540,z],[0,z]);for(const r of townStreets)line(r.a,r.b);g.restore();
   for(const t of [...towns,{name:'Porto Veloce',x:-270,z:0}]){const [x,y]=point(t.x,t.z-360);g.fillStyle='#f1f0d9';g.font='bold 20px Segoe UI';g.textAlign='center';g.fillText(t.name,x,y);}
   g.textAlign='left';g.fillStyle='#d5e79b';g.font='bold 14px Segoe UI';g.fillText('A1',...point(-1200,-1500));g.fillStyle='#f2c485';g.font='12px Segoe UI';g.fillText('U-TURN',...point(-1520,-1240));g.fillText('U-TURN',...point(-1580,1530));
   g.fillStyle='#ec9b85';g.font='bold 14px Segoe UI';g.fillText('AUTODROMO RIVIERA',...point(-1190,800));
   const [x,y]=point(car.x,car.z);g.fillStyle='#ffb475';g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.fill();g.fillText('YOU',x+11,y+5);
   g.fillStyle='#a5b9b0';g.font='13px Segoe UI';g.fillText('N ↑',30,35);g.fillRect(30,628,95,2);g.fillText('500 m',30,650);
 }
 function mini(where){const w=320,h=210,scale=where?clamp(.72-car.speed*.006,.29,.72):1.25,cx=w/2,cy=h*.55;mc.fillStyle='#253234';mc.fillRect(0,0,w,h);
   let screen=(x,z)=>[cx+(x-car.x)*scale,cy+(z-car.z)*scale];const sea=screen(27,0)[0];mc.fillStyle='#365a60';mc.fillRect(sea,0,w,h);
   mc.lineCap='butt';mc.strokeStyle='#566368';mc.lineWidth=9;
   function line(a,b){mc.beginPath();mc.moveTo(...screen(...a));mc.lineTo(...screen(...b));mc.stroke();}
   for(let x of roadsX)line([x,-378],[x,378]);for(let z of roadsZ)line([-552,z],[17,z]);
   for(const r of townStreets){mc.lineWidth=r.width*scale;line(r.a,r.b);}
   mc.save();mc.translate(cx-car.x*scale,cy-car.z*scale);mc.scale(scale,scale);mc.lineJoin='round';
   for(let i=0;i<highwayPaths.length;i++){
     if(turnarounds.includes(network[i])){mc.strokeStyle='#253234';mc.lineWidth=22;mc.stroke(highwayPaths[i]);}
     mc.strokeStyle=network[i]===circuit?'#ec9b85':turnarounds.includes(network[i])?'#f2c485':i===0?'#99ac87':'#81947f';mc.lineWidth=i===0?15:8;mc.stroke(highwayPaths[i]);
     if(i===0){mc.strokeStyle='#425751';mc.lineWidth=3;mc.stroke(highwayPaths[0]);}
   }
   mc.restore();
   if(mode==='sprint'&&!finished){mc.strokeStyle='#b9ce79';mc.lineWidth=2.3;let prev=gateIndex?route[gateIndex-1]:[4,82];for(let j=gateIndex;j<route.length;j++){line(prev,route[j]);prev=route[j];}
    let [x,z]=screen(...route[gateIndex]);mc.strokeStyle='#edf5bc';mc.lineWidth=3;mc.beginPath();mc.arc(x,z,6,0,7);mc.stroke();}
   mc.save();mc.translate(cx,cy);mc.rotate(car.heading);mc.beginPath();mc.moveTo(0,-10);mc.lineTo(7,8);mc.lineTo(0,5);mc.lineTo(-7,8);mc.closePath();mc.fillStyle='#e5f799';mc.fill();mc.restore();
 }
 function ui(){let km=Math.round(car.speed*3.6);$('speed').textContent=km;$('rpm').textContent=Math.round(car.rpm/10)*10+' RPM';$('gear').textContent=car.gear<0?'R':car.gear===0?'N':car.gear;
   const bar=document.querySelector('.tach i');bar.style.width=(car.rpm/8650*100)+'%';bar.style.background=car.rpm>7900?'#ff8b66':'#d8ec84';
   $('condition').textContent=Math.round(car.integrity*100)+'% CONDITION';$('odometer').textContent=(car.travel/1000).toFixed(2)+' KM';$('compass').textContent=['N','NE','E','SE','S','SW','W','NW'][(Math.round(car.heading/(Math.PI/4))%8+8)%8];
   const where=locate(car.x,car.z,car.y),town=townAt(car.x,car.z);$('districtLabel').textContent=inCircuit(car.x,car.z)?'AUTODROMO / RIVIERA':town?town.name.toUpperCase():where?(turnarounds.includes(where.road)?'A1 / CHANGE DIRECTION':'A1  /  RIVIERA REGION'):'PORTO VELOCE';
   $('street').textContent=town?nearestStreet(car.x,car.z).road.name:where?(where.road===motorway?'Tangenziale costiera':where.road.id==='Centro'?'Raccordo Ovest':where.road.id==='Entry'?'Ingresso A1':where.road.id==='Exit'?'Uscita Ovest':where.road.id):car.x>-30?'Lungomare':car.x<-290?'Centro Direzionale':'Città Vecchia';if(mode==='sprint'){$('raceTime').textContent=clockText(elapsed);$('gateText').textContent='Gate '+Math.min(gateIndex+1,route.length)+' / '+route.length;}
   show('laps',mode!=='sprint'&&(mode==='track'||inCircuit(car.x,car.z)));
   $('lapTime').textContent=clockText(lap.elapsed);$('lapStatus').textContent=lap.invalid?'INVALID · Cross start to retry':lap.running?'Lap '+(lap.count+1)+' · Checkpoints '+lap.sector+'/3':'Cross the start line';
   $('lapLast').textContent=lap.last?clockText(lap.last):'—';$('lapBest').textContent=lap.best?clockText(lap.best):'—';
   if(performance.now()>noticeUntil)$('notice').textContent='';mini(where);}
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
 $('start').disabled=false;setMode('free');soundLabel();transLabel();ai.update(0,car);ai.render();vehicle.update(car,0);
 function frame(now){const dt=Math.min(.10,Math.max(0,(now-last)/1000));last=now;clock+=dt;controls();if(state==='drive'){acc+=dt;while(acc>=1/120&&state==='drive'){step(1/120);acc-=1/120;}stepTime+=dt;vehicle.update(car,dt);}
   else if(state==='menu'||state==='helpHome'){menuTime+=dt;ai.render();vehicle.update(car,0);}
   if(state==='drive'||state==='menu'||state==='helpHome'||frameLast===0){cameraPose(dt);
     sun.target.position.set(car.x,car.y,car.z);sun.position.set(car.x+74,car.y+46,car.z-60);
     if(clock-lastWater>.14){city.update(clock);lastWater=clock;}renderer.render(scene,camera);}
   if(state==='drive'&&clock-lastUi>.065){ui();lastUi=clock;}
   if(clock-volumeTime>.03){audioUpdate();volumeTime=clock;}
   frameLast=now;requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
boot().catch(fail);
