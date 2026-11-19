const range=(key,label,value,min,max,step,unit='',hint='')=>({key,label,value,min,max,step,unit,hint,type:'range'});
const toggle=(key,label,value,hint='')=>({key,label,value,hint,type:'checkbox'});
const select=(key,label,value,options,hint='')=>({key,label,value,options,hint,type:'select'});
export const settingGroups=[
  {name:'Audio',fields:[
    toggle('muted','Mute all sound',false),range('volume','Master volume',76,0,100,1,'%'),
    range('engineVolume','Engine & exhaust',100,0,100,1,'%'),range('tireVolume','Tire sounds',100,0,100,1,'%'),range('windVolume','Wind & road noise',100,0,100,1,'%')
  ]},
  {name:'Driving',fields:[
    toggle('automatic','Automatic transmission',false,'You can also switch with M while driving.'),
    range('steering','Steering sensitivity',1,.3,1.5,.05,'×','Adjusts keyboard and gamepad steering strength.'),
    range('steerResponse','Steering response',1,.4,2,.1,'×','Higher values turn the wheels more quickly.'),
    range('steerReturn','Steering return speed',1,.4,2,.1,'×','How quickly steering settles back toward center.'),
    range('speedAssist','High-speed steering assist',1,0,1,.05,'','Lower values allow more steering lock at speed.'),
    range('stability','Stability assist',1,0,1,.05,'','Helps control excess yaw. Handbraking overrides it.'),
    range('throttle','Throttle sensitivity',1,.3,1.5,.05,'×'),range('braking','Brake sensitivity',1,.3,1.5,.05,'×')
  ]},
  {name:'Gamepad',fields:[
    toggle('gamepad','Enable gamepad',true),range('deadzone','Steering deadzone',.09,0,.35,.01,'','Ignores small stick movements near the center.'),
    range('steerCurve','Steering curve',1,1,3,.1,'×','Higher values give finer control near the center.'),toggle('invertSteering','Invert gamepad steering',false)
  ]},
  {name:'Camera',fields:[
    select('camera','Driving camera','0',[['0','Chase'],['1','Driver'],['2','Bumper']]),
    range('fov','Field of view offset',0,-15,20,1,'°','Changes the field of view for all driving cameras.'),
    range('cameraDistance','Chase distance',5.8,3.5,10,.1,' m'),range('cameraHeight','Chase height',2,1.2,4,.1,' m'),
    range('cameraResponse','Chase follow speed',1,.4,2,.1,'×'),toggle('speedFov','Widen view at speed',true),toggle('cameraMotion','Camera pitch & speed movement',true)
  ]},
  {name:'Graphics',fields:[
    range('resolution','Render scale',1,.5,1.5,.1,'×','Lower values improve performance. Applies immediately.'),
    select('shadows','Shadows','high',[['off','Off'],['low','Low'],['high','High']]),
    range('brightness','Brightness',1.03,.6,1.6,.01,'×'),range('viewDistance','View distance',1800,800,2600,100,' m')
  ]},
  {name:'Display',fields:[
    select('units','Speed & distance units','metric',[['metric','km/h · km'],['imperial','mph · mi']]),
    range('hudScale','HUD size',1,.8,1.3,.05,'×'),range('mapZoom','Minimap zoom',1,.5,2,.1,'×'),
    toggle('showMap','Show minimap',true),toggle('showLocation','Show location',true),toggle('showTiming','Show lap & sprint timers',true),toggle('showHints','Show keyboard hints',true)
  ]}
];
export const defaults=Object.freeze(Object.fromEntries(settingGroups.flatMap(g=>g.fields.map(f=>[f.key,f.value]))));
export function normalizeSettings(raw={}){
  if(!raw||typeof raw!=='object')raw={};
  const out={};
  for(const f of settingGroups.flatMap(g=>g.fields)){
    const v=raw[f.key];out[f.key]=f.type==='checkbox'?(typeof v==='boolean'?v:f.value):f.type==='select'?(f.options.some(o=>o[0]===v)?v:f.value):typeof v==='number'&&Number.isFinite(v)?Math.max(f.min,Math.min(f.max,v)):f.value;
  }return out;
}
export function loadSettings(get){
  let raw={};try{raw=JSON.parse(get('settings','null'))??{};}catch{}
  if(!raw||typeof raw!=='object')raw={};
  return normalizeSettings({automatic:get('auto','0')==='1',muted:get('mute','0')==='1',...raw});
}
export function gamepadSteer(value,settings){
  const magnitude=Math.min(1,Math.abs(value));if(magnitude<=settings.deadzone)return 0;
  return Math.sign(value)*((magnitude-settings.deadzone)/(1-settings.deadzone))**settings.steerCurve*(settings.invertSteering?-1:1);
}

export function mountSettings(root,settings,{change,close,testSound,fullscreen}){
  root.innerHTML='<div class="settings-card"><header><div><div class="eyebrow">MAKE IT YOUR DRIVE</div><h2 id="settingsTitle">Settings</h2></div><button id="closeSettings">Done · Esc</button></header><nav role="tablist" aria-label="Settings category"></nav><div class="settings-content" role="tabpanel" tabindex="0"></div><footer><span id="settingsStatus" role="status">Changes apply immediately and save automatically.</span><div><button id="resetSection">Reset category</button><button id="resetSettings">Reset all settings</button></div></footer></div>';
  const nav=root.querySelector('nav'),content=root.querySelector('.settings-content'),status=root.querySelector('#settingsStatus');
  let group=0;
  const formatted=f=>f.type==='range'?Number(settings[f.key].toFixed(2))+f.unit:'';
  function commit(){const saved=change();status.textContent=saved?'Saved · Changes applied.':'Applied for this session · Storage unavailable.';}
  function render(){
    [...nav.children].forEach((b,i)=>{b.setAttribute('aria-selected',String(i===group));b.tabIndex=i===group?0:-1;});
    content.replaceChildren();content.scrollTop=0;content.setAttribute('aria-labelledby','settingsTab'+group);
    for(const f of settingGroups[group].fields){
      const row=document.createElement('div');row.className='setting-row';
      const label=document.createElement('label');label.htmlFor='setting-'+f.key;label.textContent=f.label;
      if(f.hint){const hint=document.createElement('small');hint.textContent=f.hint;hint.id='hint-'+f.key;label.append(hint);}
      const control=document.createElement(f.type==='select'?'select':'input');control.id=label.htmlFor;
      if(f.hint)control.setAttribute('aria-describedby','hint-'+f.key);
      if(f.type==='select'){for(const [v,text] of f.options){const option=document.createElement('option');option.value=v;option.textContent=text;control.append(option);}control.value=settings[f.key];}
      else {control.type=f.type;if(f.type==='checkbox')control.checked=settings[f.key];else{control.min=f.min;control.max=f.max;control.step=f.step;control.value=settings[f.key];}}
      const area=document.createElement('div');area.className='setting-control';area.append(control);
      const output=document.createElement('output');output.htmlFor=control.id;output.textContent=formatted(f);if(f.type==='range')area.append(output);
      control.addEventListener('input',()=>{settings[f.key]=f.type==='checkbox'?control.checked:f.type==='range'?Number(control.value):control.value;output.textContent=formatted(f);commit();});
      row.append(label,area);content.append(row);
    }
    if(group===0||settingGroups[group].name==='Graphics'){
      const button=document.createElement('button');button.className='setting-action';button.textContent=group===0?'Test engine sound · 2 seconds':'Toggle fullscreen · F11';button.onclick=group===0?testSound:fullscreen;content.append(button);
    }
  }
  settingGroups.forEach((g,i)=>{const button=document.createElement('button');button.textContent=g.name;button.id='settingsTab'+i;button.setAttribute('role','tab');button.onclick=()=>{group=i;render();};button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();group=e.key==='Home'?0:e.key==='End'?settingGroups.length-1:(i+(e.key==='ArrowRight'?1:-1)+settingGroups.length)%settingGroups.length;render();nav.children[group].focus();};nav.append(button);});
  root.querySelector('#closeSettings').onclick=close;
  root.querySelector('#resetSection').onclick=()=>{for(const f of settingGroups[group].fields)settings[f.key]=f.value;commit();render();};
  root.querySelector('#resetSettings').onclick=()=>{Object.assign(settings,defaults);commit();render();};
  root.onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
    if(e.key==='Tab'){
      const items=[...root.querySelectorAll('button,input,select,[tabindex="0"]')].filter(e=>e.tabIndex>=0),first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  };
  render();return {refresh:render};
}
