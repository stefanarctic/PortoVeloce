import * as T from 'three';
import {RGBELoader} from './vendor/RGBELoader.js';
import {main as motorway,network,locate,lane,recovery} from './highway-layout.js';
import {Car,clamp} from './physics.js';
import {collide} from './collisions.js';
import {createCity,offRoad,roadsX,roadsZ,route} from './city.js';
import {loadAventador,traffic} from './vehicle.js';
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
 function setMode(m){mode=m;for(let [id,k]of [['free','free'],['highway','highway'],['sprint','sprint']]){$(id).classList.toggle('selected',k===m);$(id).setAttribute('aria-pressed',String(k===m));}
   $('start').firstElementChild.textContent=m==='sprint'?'Start harbor sprint':m==='highway'?'Drive the A1':'Start engine';}
 function placeGate(){gate.visible=mode==='sprint'&&active&&!finished;if(!gate.visible)return;const [x,z]=route[gateIndex],prev=gateIndex?route[gateIndex-1]:[4,82];gate.position.set(x,.02,z);gate.rotation.y=Math.atan2(x-prev[0],z-prev[1]);}
 function begin(){if(mode==='highway'){const p=lane(motorway,235);car.reset(p.x,p.z,p.heading);}else car.reset();ai.reset(car);city.resetProps();gateIndex=0;elapsed=0;finished=false;active=true;cameraReady=false;finishMessage='';keys.clear();$('notice').textContent='';stepTime=0;resume();placeGate();toast(mode==='sprint'?'Harbor sprint · Follow the lime gates':mode==='highway'?'A1 · Tangenziale costiera':car.auto?'Automatic · W to accelerate':'W to accelerate · X to shift up');}
 function resume(){state='drive';keys.clear();acc=0;last=performance.now();show('menu',false);show('pause',false);show('help',false);show('hud',true);show('race',mode==='sprint');transLabel();wakeAudio();}
 function pause(done=false){if(state!=='drive'&&!done)return;state='pause';keys.clear();show('pause',true);show('hud',false);$('pauseTitle').textContent=done?'Sprint complete':'Paused';$('result').textContent=done?finishMessage:'';show('resume',!done);$('again').textContent=mode==='sprint'?'Restart sprint':'Restart drive';audioUpdate();}
 function home(){state='menu';active=false;keys.clear();car.reset();gate.visible=false;show('menu',true);show('pause',false);show('hud',false);show('help',false);audioUpdate();}
 function openHelp(){if(state==='drive')pause();state=active?'helpPause':'helpHome';show('help',true);show('pause',false);}
 function closeHelp(){show('help',false);state=active?'pause':'menu';if(active)show('pause',true);}
 function recover(){if(mode==='sprint'){begin();toast('Sprint restarted');return;}let x=roadsX.reduce((a,b)=>Math.abs(b-car.x)<Math.abs(a-car.x)?b:a),z=clamp(car.z,-349,349);let saved=car.travel;const point=recovery(car.x,car.z);if(point)car.reset(point.x,point.z,point.heading);else car.reset(x+4,z);car.travel=saved;cameraReady=false;toast('Vehicle recovered and repaired');}
 function changeCam(){cam=(cam+1)%3;cameraReady=false;toast(['Chase camera','Driver camera','Bumper camera'][cam]);}
 function shift(n,paddle=0){if(paddle)vehicle.pullPaddle(paddle);if(!car.shift(n))return;if(car.auto&&n>0){car.auto=false;save('auto','0');transLabel();}}
 $('free').onclick=()=>setMode('free');$('highway').onclick=()=>setMode('highway');$('sprint').onclick=()=>setMode('sprint');$('start').onclick=begin;$('resume').onclick=resume;$('again').onclick=begin;$('toMenu').onclick=home;
 $('helpHome').onclick=$('helpPause').onclick=openHelp;$('closeHelp').onclick=closeHelp;$('soundHome').onclick=$('soundPause').onclick=toggleSound;$('gearMode').onclick=toggleTransmission;
 function fullscreen(){if(window.chrome?.webview)window.chrome.webview.postMessage('fullscreen');else if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}
 addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','F11','Tab'].includes(e.code)&&e.code!=='Tab'&&(state==='drive'||e.code==='F11'))e.preventDefault();
   if(e.repeat)return;if(e.code==='F11'){fullscreen();return;}if(e.code==='Escape'){if(state.startsWith('help'))closeHelp();else if(state==='drive')pause();else if(state==='pause'&&!finished)resume();return;}
   if(e.code==='KeyH'){if(state.startsWith('help'))closeHelp();else openHelp();return;}
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
   // Substeps limit travel to less than a thin roadside obstacle at highway speed.
   const bodies=[car,...ai.cars,...city.props];
   const fastest=bodies.reduce((speed,b)=>Math.max(speed,Math.hypot(b.vx,b.vz)+Math.abs(b.yawRate)*b.d),0);
   const substeps=Math.max(2,Math.ceil(fastest*dt/.18)),slice=dt/substeps;
   for(let sub=0;sub<substeps;sub++){
     ai.update(slice,car);city.stepProps(slice);car.step(slice,input,offRoad(car.x,car.z));
     for(let iteration=0;iteration<3;iteration++){
       for(const b of bodies){
         if(b!==car&&!b.crashed)continue;
         for(const obstacle of city.nearby(b.x,b.z))collide(b,obstacle);
       }
       for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
         if(bodies[i]!==car&&!bodies[i].crashed&&!bodies[j].crashed)continue;
         collide(bodies[i],bodies[j]);
       }
     }
   }
   ai.render();city.renderProps();
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
   aim.set(car.x,.78,car.z);
   if(cam===0||back){const d=back?-5.9:5.8+car.speed*.012;goal.set(car.x-Math.sin(headingCam)*d,2.0+Math.min(.55,car.speed*.008),car.z+Math.cos(headingCam)*d);
     // Shorten the boom whenever its segment meets nearby architecture.
     for(let k=1;k<=10;k++){const t=k/10,x=car.x+(goal.x-car.x)*t,z=car.z+(goal.z-car.z)*t;
       if([...city.nearby(x,z)].some(b=>Math.abs((x-b.x)*b.cs-(z-b.z)*b.sn)<b.w+.15&&Math.abs((x-b.x)*b.sn+(z-b.z)*b.cs)<b.d+.15)){goal.lerp(aim,1-Math.max(.12,t-.13));break;}}
     aim.addScaledVector(fwd,back?0:2.4);
   }else if(cam===1){goal.set(car.x,.99,car.z).addScaledVector(right,-.34).addScaledVector(fwd,-.10);aim.copy(goal).addScaledVector(fwd,15);aim.y=.96+car.pitch*4;}
   else{goal.set(car.x,.54,car.z).addScaledVector(fwd,2.42);aim.copy(goal).addScaledVector(fwd,15);aim.y=.66;}
   if(!cameraReady||cam!==0||back){camera.position.copy(goal);look.copy(aim);}else{camera.position.lerp(goal,1-Math.exp(-dt*11));look.lerp(aim,1-Math.exp(-dt*16));}
   cameraReady=true;camera.lookAt(look);camera.fov=cam===1?73:cam===2?69:54+Math.min(car.speed*.19,11);camera.updateProjectionMatrix();
 }
 const mc=$('map').getContext('2d');
 const highwayPaths=network.map(road=>{const p=new Path2D();road.points.forEach((pt,i)=>{if(i)p.lineTo(pt.x,pt.z);else p.moveTo(pt.x,pt.z);});return p;});
 function mini(where){const w=320,h=210,scale=where?clamp(.72-car.speed*.006,.29,.72):1.25,cx=w/2,cy=h*.55;mc.fillStyle='#253234';mc.fillRect(0,0,w,h);
   let screen=(x,z)=>[cx+(x-car.x)*scale,cy+(z-car.z)*scale];const sea=screen(27,0)[0];mc.fillStyle='#365a60';mc.fillRect(sea,0,w,h);
   mc.lineCap='butt';mc.strokeStyle='#566368';mc.lineWidth=9;
   function line(a,b){mc.beginPath();mc.moveTo(...screen(...a));mc.lineTo(...screen(...b));mc.stroke();}
   for(let x of roadsX)line([x,-378],[x,378]);for(let z of roadsZ)line([-552,z],[17,z]);
   mc.save();mc.translate(cx-car.x*scale,cy-car.z*scale);mc.scale(scale,scale);mc.lineJoin='round';
   for(let i=0;i<highwayPaths.length;i++){mc.strokeStyle=i===0?'#99ac87':'#81947f';mc.lineWidth=i===0?15:8;mc.stroke(highwayPaths[i]);}
   mc.strokeStyle='#425751';mc.lineWidth=3;mc.stroke(highwayPaths[0]);mc.restore();
   if(mode==='sprint'&&!finished){mc.strokeStyle='#b9ce79';mc.lineWidth=2.3;let prev=gateIndex?route[gateIndex-1]:[4,82];for(let j=gateIndex;j<route.length;j++){line(prev,route[j]);prev=route[j];}
    let [x,z]=screen(...route[gateIndex]);mc.strokeStyle='#edf5bc';mc.lineWidth=3;mc.beginPath();mc.arc(x,z,6,0,7);mc.stroke();}
   mc.save();mc.translate(cx,cy);mc.rotate(car.heading);mc.beginPath();mc.moveTo(0,-10);mc.lineTo(7,8);mc.lineTo(0,5);mc.lineTo(-7,8);mc.closePath();mc.fillStyle='#e5f799';mc.fill();mc.restore();
 }
 function ui(){let km=Math.round(car.speed*3.6);$('speed').textContent=km;$('rpm').textContent=Math.round(car.rpm/10)*10+' RPM';$('gear').textContent=car.gear<0?'R':car.gear===0?'N':car.gear;
   const bar=document.querySelector('.tach i');bar.style.width=(car.rpm/8650*100)+'%';bar.style.background=car.rpm>7900?'#ff8b66':'#d8ec84';
   $('condition').textContent=Math.round(car.integrity*100)+'% CONDITION';$('odometer').textContent=(car.travel/1000).toFixed(2)+' KM';$('compass').textContent=['N','NE','E','SE','S','SW','W','NW'][(Math.round(car.heading/(Math.PI/4))%8+8)%8];
   const where=locate(car.x,car.z);$('districtLabel').textContent=where?'A1  /  PORTO VELOCE':'PORTO VELOCE';
   $('street').textContent=where?(where.road===motorway?'Tangenziale costiera':where.road.id==='Centro'?'Raccordo Ovest':where.road.id==='Entry'?'Ingresso A1':'Uscita Ovest'):car.x>-30?'Lungomare':car.x<-290?'Centro Direzionale':'Città Vecchia';if(mode==='sprint'){$('raceTime').textContent=clockText(elapsed);$('gateText').textContent='Gate '+Math.min(gateIndex+1,route.length)+' / '+route.length;}
   if(performance.now()>noticeUntil)$('notice').textContent='';mini(where);}
 function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
 $('start').disabled=false;setMode('free');soundLabel();transLabel();ai.update(0,car);ai.render();vehicle.update(car,0);
 function frame(now){const dt=Math.min(.10,Math.max(0,(now-last)/1000));last=now;clock+=dt;controls();if(state==='drive'){acc+=dt;while(acc>=1/120&&state==='drive'){step(1/120);acc-=1/120;}stepTime+=dt;vehicle.update(car,dt);}
   else if(state==='menu'||state==='helpHome'){menuTime+=dt;ai.render();vehicle.update(car,0);}
   if(state==='drive'||state==='menu'||state==='helpHome'||frameLast===0){cameraPose(dt);
     sun.target.position.set(car.x,0,car.z);sun.position.set(car.x+74,46,car.z-60);
     if(clock-lastWater>.14){city.update(clock);lastWater=clock;}renderer.render(scene,camera);}
   if(state==='drive'&&clock-lastUi>.065){ui();lastUi=clock;}
   if(clock-volumeTime>.03){audioUpdate();volumeTime=clock;}
   frameLast=now;requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
boot().catch(fail);
