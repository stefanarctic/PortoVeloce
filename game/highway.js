import * as T from 'three';
import {main,link,entry,exit,townRamps,turnarounds,network,at,offset,profile,locate} from './highway-layout.js';
import {spanFrame,deckGeometry} from './road-geometry.js';
import {towns,townAt} from './region-layout.js';

export function buildHighway(scene, api){
  const {block,pole,solid,paintTexture}=api;
  const standard=(color,roughness=.84,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
  const concrete=standard(0xb2aca0), rail=standard(0x9da7a5,.44,.51),steel=standard(0x485758,.6,.5);
  const paint=standard(0xe1dfcc), verge=standard(0xbcb395),gray=standard(0x494b47);
  const emissive=new T.MeshStandardMaterial({color:0xfff0c9,emissive:0xdbaa6b,emissiveIntensity:.7});
  const amber=standard(0xe1a452),white=standard(0xf4f0df);
  const loader=new T.TextureLoader();
  function tile(url,color=true){const t=loader.load('assets/'+url);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(color)t.colorSpace=T.SRGBColorSpace;return t;}
  const asphalt=new T.MeshStandardMaterial({map:tile('street.jpg'),color:0xa2a3a3,normalMap:tile('street-n.jpg',false),normalScale:new T.Vector2(.23,.23),roughness:.93});
  const batches=new Map();
  function vertex(batch,x,y,z,u,v){batch.position.push(x,y,z);batch.uv.push(u,v);}
  function strip(road,start,end,left,right,height,material){
    if(end<=start)return;
    let batch=batches.get(material);
    if(!batch)batches.set(material,batch={position:[],uv:[],indices:[]});
    let index=batch.position.length/3;
    function pair(p){
      for(const edge of [left,right]){
        const side=typeof edge==='function'?edge(p.s):edge,q=offset(p,side);
        vertex(batch,q.x,height+p.y,q.z,side/6,p.s/6);
      }
    }
    pair(at(road,start));let i=Math.floor(start/8)*8+8;
    for(;i<end;i+=8){pair(at(road,i));batch.indices.push(index,index+1,index+2,index+1,index+3,index+2);index+=2;}
    pair(at(road,end));batch.indices.push(index,index+1,index+2,index+1,index+3,index+2);
  }
  // In plan view the right vector is (-tz, tx). Upward winding follows right then tangent.
  function ribbon(road,l,r,y,mat){strip(road,0,road.length,l,r,y,mat);}
  function mark(road,s0,s1,center,width,y=.048){
    const side=k=>s=>typeof center==='function'?center(s)+k:center+k;
    strip(road,s0,s1,side(-width/2),side(width/2),y,paint);
  }
  function dash(road,center,start,end,y){
    for(let s=start;s<end;s+=13)mark(road,s,Math.min(s+4.3,end),center,.15,y);
  }
  function span(material,p,q,y,width,height,hit=false){
    const dx=q.x-p.x,dz=q.z-p.z,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    const x=(p.x+q.x)/2,z=(p.z+q.z)/2;
    const py=p.y??0,qy=q.y??0;
    const frame=spanFrame(p,q),r=frame.rotation;
    block(material,x,y+(py+qy)/2,z,width,height,frame.length+.035,r.x,r.y,r.z);
    if(hit)solid(x,z,width,length+.035,yaw,y+Math.min(py,qy)-height/2,y+Math.max(py,qy)+height/2);
  }
  const gap=s=>{const p=at(main,s);return Math.abs(p.x+1700)<1 && (Math.abs(p.z)>=105&&Math.abs(p.z)<=326);};
  const townGap=s=>{const p=at(main,s);return Math.abs(p.x+1700)<1&&((p.z>=-865&&p.z<=-405)||(p.z>=335&&p.z<=865));};
  const turnaroundGap=(s,side)=>turnarounds.some(r=>{
    const departure=(s-r.startS)*r.direction,arrival=(s-r.endS)*-r.direction;
    return (side===r.direction&&departure>-20&&departure<150)||(side===-r.direction&&arrival>-150&&arrival<20);
  });
  for(const road of network){
    const mainline=road===main, y=mainline?.002:road===link?.013:.023;
    const width=s=>mainline?profile(s).width:road.halfWidth;
    ribbon(road,s=>-width(s)-1.35,s=>width(s)+1.35,-.021,verge);
    ribbon(road,s=>-width(s),width,y,asphalt);
    if(mainline){
      for(let sign of [-1,1]){
        mark(road,144,road.length-144,s=>sign*(profile(s).median+.35),.15,.043);
        dash(road,s=>sign*(4.4+1.5*profile(s).blend),193,road.length-193,.044);
      }
    }else if(road===link)dash(road,0,0,road.length,.057);
    for(let side of [-1,1]){
      for(let s=0;s<road.length;s+=8){
        const e=Math.min(road.length,s+8),mid=(s+e)/2,dist=Math.min(mid,road.length-mid);
        const p=at(road,s),q=at(road,e);
        const open=mainline&&((side<0&&gap(mid))||(side>0&&townGap(mid))||turnaroundGap(mid,side));
        // Where a slip road overlaps the mainline, leave the merge open all the way across its shoulder.
        const merge=((road===entry||road===exit)&&(p.x < -1679 || q.x < -1679))||
          (townRamps.includes(road)&&(p.x>-1745||q.x>-1745||p.x<-1985||q.x<-1985))||(road.oneWay&&dist<110);
        if(!open&&!merge)mark(road,s,e,t=>side*(width(t)-.75),.15,y+.025);
        if(!open&&!merge&&dist>6){
          const from=offset(p,side*(width(s)+.30)),to=offset(q,side*(width(e)+.30));
          if((road===entry||road===exit)&&((road===entry?mid:road.length-mid)<125))continue;
          if(townRamps.includes(road)&&dist<130)continue;
          if(road===link&&dist<25)continue;
          span(rail,from,to,.60,.18,.35,true);
          pole(steel,from.x,.34+from.y,from.z,.115,.69,.115);
          if(Math.floor(s/8)%3===0)block(side>0?white:amber,from.x,.83+from.y,from.z,.15,.13,.13);
        }
      }
    }
  }
  for(const road of turnarounds){
    const deck=new T.Mesh(deckGeometry(road,at,offset),concrete);
    deck.name='Deck: '+road.id;deck.userData.turnaroundDeck=true;deck.castShadow=true;deck.receiveShadow=true;scene.add(deck);
    for(let s=90;s<road.length-90;s+=70){
      const p=at(road,s),ground=locate(p.x,p.z,0);
      if(p.y<2||(ground&&ground.road!==road&&ground.distance<24))continue;
      const h=p.y-.88;block(concrete,p.x,h/2,p.z,2.1,h,2.1);solid(p.x,p.z,2.1,2.1,0,0,h);
    }
  }
  // Taper arrows give drivers advance notice that the passing lane ends at the city.
  function arrow(s,direction,side,merge){
    const p=at(main,s),origin=offset(p,side);
    const forward={x:p.tx*direction,z:p.tz*direction};
    const right={x:-forward.z,z:forward.x};
    const point=(u,v)=>({x:origin.x+right.x*u+forward.x*v,z:origin.z+right.z*u+forward.z*v});
    const a=point(0,-3.2),b=point(0,-.6),tip=point(merge?1.15:0,3.2);
    span(paint,a,b,.066,.29,.018);span(paint,b,tip,.066,.29,.018);
    span(paint,point(merge?.12:-.71,1.7),tip,.066,.26,.018);
    span(paint,point(merge?1.56:.71,1.55),tip,.066,.26,.018);
  }
  for(const direction of [-1,1]){
    for(const d of [230,285]){const s=direction===1?main.length-d:d;arrow(s,direction,3.12*direction,true);arrow(s,direction,8.55*direction,false);}
  }
  for(let s=151;s<main.length-151;s+=8){
    const a=at(main,s),b=at(main,Math.min(s+8,main.length-151));
    span(concrete,a,b,.32,1.05,.64,true);
    span(concrete,a,b,.74,.52,.36);
    if(Math.floor(s/8)%3===0)block(amber,a.x,.94,a.z,.12,.08,.18,0,Math.atan2(a.tx,a.tz));
  }
  for(let s=20;s<main.length;s+=80){
    const p=at(main,s),w=profile(s).width;
    if(turnarounds.some(r=>r.points.some(q=>r.height(q.s)>2&&Math.hypot(p.x-q.x,p.z-q.z)<25)))continue;
    for(const side of [-1,1]){
      if((side<0&&gap(s))||(side>0&&townGap(s))||turnaroundGap(s,side))continue;
      const base=offset(p,side*(w+2.10)),tip=offset(p,side*(w-.40));
      pole(steel,base.x,4.7,base.z,.19,9.4,.19);
      span(steel,base,tip,9.35,.105,.12);
      block(emissive,tip.x,9.27,tip.z,.37,.14,.78,0,Math.atan2(p.tx,p.tz));
    }
  }
  for(const road of turnarounds)for(let s=125;s<road.length-100;s+=65){
    const p=at(road,s),base=offset(p,road.halfWidth+.8),tip=offset(p,road.halfWidth-1.4);
    pole(steel,base.x,p.y+3,base.z,.16,6,.16);span(steel,base,tip,5.95,.1,.12);
    block(emissive,tip.x,p.y+5.87,tip.z,.75,.14,.35);
  }
  for(const [material,batch] of batches){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(batch.position,3));g.setAttribute('uv',new T.Float32BufferAttribute(batch.uv,2));
    g.setIndex(batch.indices);g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;scene.add(mesh);
  }

  function signFace(route,destination,detail,arrow){
    return new T.MeshBasicMaterial({map:paintTexture(768,240,ctx=>{
      ctx.fillStyle='#15503e';ctx.fillRect(0,0,768,240);ctx.strokeStyle='#daeee3';ctx.lineWidth=5;ctx.strokeRect(7,7,754,226);
      ctx.fillStyle='#f2f4dc';ctx.fillRect(31,27,94,48);ctx.fillStyle='#18513f';ctx.font='bold 32px Arial';ctx.fillText(route,42,63);
      ctx.fillStyle='#fcf9e9';ctx.font='bold 61px Arial';ctx.fillText(destination,30,148,615);
      ctx.fillStyle='#d3e6da';ctx.font='31px Arial';ctx.fillText(detail,34,200,610);
      ctx.save();ctx.translate(694,117);ctx.rotate(arrow);ctx.strokeStyle='#fbfaed';ctx.lineWidth=14;ctx.lineCap='square';
      ctx.beginPath();ctx.moveTo(0,36);ctx.lineTo(0,-39);ctx.moveTo(-24,-13);ctx.lineTo(0,-39);ctx.lineTo(24,-13);ctx.stroke();ctx.restore();
    })});
  }
  function gantry(road,s,direction,destination,detail,arrow=0){
    const p=at(road,s),width=road===main?profile(s).width:road.halfWidth;
    const center=offset(p,direction*width*.47),post=offset(p,direction*(width+2.7));
    pole(steel,post.x,3.9+p.y,post.z,.35,7.8,.35);
    span(steel,post,center,7.72,.24,.24);
    const board=new T.Mesh(new T.BoxGeometry(7.7,2.35,.15),[gray,gray,gray,gray,signFace('A1',destination,detail,arrow),gray]);
    board.position.set(center.x,6.45+p.y,center.z);board.rotation.y=Math.atan2(-direction*p.tx,-direction*p.tz);
    scene.add(board);
  }
  gantry(main,50,1,'Tangenziale','Costa Nord   /   A1');
  gantry(main,main.length-52,-1,'Tangenziale','Costa Sud   /   A1');
  gantry(main,325,1,'Belvedere','Tangenziale costiera');
  gantry(main,1160,-1,'Porto Nord','Lungomare');
  const west=main.points.find(p=>p.x<-1699.9&&p.z>385);
  gantry(main,west.s,-1,'Porto Veloce','Uscita Ovest / Centro',Math.PI/4);
  gantry(link,520,1,'A1 Nord','Bellacosta / Valdoro: inversione Nord');
  for(const r of turnarounds){
    gantry(main,r.startS-r.direction*140,r.direction,'U-TURN / Inversione','Cambio direzione   /   140 m',Math.PI/4);
    gantry(r,140,1,'Cambio direzione',r.direction<0?'Rientro A1 Sud':'Rientro A1 Nord');
    gantry(r,r.length-90,1,r.direction<0?'A1 Sud':'A1 Nord','Dare precedenza / Merge ahead');
  }
  const speedFace=new T.MeshBasicMaterial({map:paintTexture(128,128,g=>{
    g.fillStyle='#c33c31';g.beginPath();g.arc(64,64,62,0,Math.PI*2);g.fill();
    g.fillStyle='#faf7e9';g.beginPath();g.arc(64,64,49,0,Math.PI*2);g.fill();
    g.fillStyle='#1b2325';g.font='bold 57px Arial';g.textAlign='center';g.fillText('40',64,84);
  }),transparent:true,alphaTest:.4});
  const chevrons=[-1,1].map(direction=>new T.MeshBasicMaterial({map:paintTexture(192,96,g=>{
    g.fillStyle='#ede9d5';g.fillRect(0,0,192,96);g.fillStyle='#253539';g.font='bold 92px Arial';g.textAlign='center';g.fillText(direction<0?'‹‹':'››',96,77);
  })}));
  function roadsideFace(road,s,side,material,w,h){
    const p=at(road,s),base=offset(p,side*(road.halfWidth+1));
    pole(steel,base.x,p.y+1.1,base.z,.1,2.2,.1);
    const board=new T.Mesh(new T.PlaneGeometry(w,h),material);board.position.set(base.x,p.y+2.15,base.z);
    board.rotation.y=Math.atan2(-p.tx,-p.tz);scene.add(board);
  }
  for(const r of turnarounds){
    roadsideFace(r,115,1,speedFace,1.3,1.3);
    for(let s=260;s<r.length-100;s+=35){
      const a=at(r,s-15),b=at(r,s+15),turn=Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz);
      if(Math.abs(turn)>.15)roadsideFace(r,s,-Math.sign(turn),chevrons[turn<0?0:1],1.6,.8);
    }
  }
  gantry(main,main.length-460,1,'Porto Sud','Fine autostrada   /   400 m',0);
  for(const [i,town] of towns.entries()){
    const start=townRamps[i*2].points[0];
    const station=main.points.reduce((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)<Math.hypot(b.x-start.x,b.z-start.z)?a:b);
    gantry(main,station.s-150,1,town.name,'Uscita '+(i+2)+'   /   150 m',Math.PI/4);
    gantry(townRamps[i*2],125,1,town.name,i===0?'Centro storico / Mercato':'Stazione / Zona industriale');
    gantry(townRamps[i*2+1],100,1,'Porto Veloce','A1   /   Costa Sud');
  }
  // An inland terrain mesh drops below the roadbed around every carriageway and city block.
  let seed=985023;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const stations=network.flatMap(r=>r.points.filter((_,i)=>i%4===0));
  function height(x,z){
    let dist=Math.hypot(Math.max(-568-x,0,x-25),Math.max(-397-z,0,z-397));
    for(const t of towns)dist=Math.min(dist,Math.hypot(Math.max(t.xs[0]-30-x,0,x-t.xs.at(-1)-30),Math.max(t.zs[0]-30-z,0,z-t.zs.at(-1)-30)));
    for(const p of stations){const dx=x-p.x;if(Math.abs(dx)>dist)continue;dist=Math.min(dist,Math.hypot(dx,z-p.z));}
    const fade=T.MathUtils.smoothstep(Math.min(dist,Math.max(0,26-x)*1.1),70,300);
    return -.58+fade*(18+12*Math.sin(x*.005+z*.004)+8*Math.cos(z*.009-x*.002)+25*(1+Math.sin(x*.0025+z*.003)));
  }
  const ground=new T.PlaneGeometry(3400,4740,160,222);ground.rotateX(-Math.PI/2);ground.translate(-1673,0,0);
  const pos=ground.attributes.position,uv=ground.attributes.uv;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));uv.setXY(i,x/18,z/18);}
  ground.computeVertexNormals();const terrain=new T.Mesh(ground,new T.MeshStandardMaterial({map:tile('park-grass.jpg'),color:0xbfc29c,roughness:1}));terrain.receiveShadow=true;scene.add(terrain);
  const card=new T.PlaneGeometry(1,1),leaf=new T.MeshBasicMaterial({map:tile('coastal-tree.png'),alphaTest:.48,side:T.DoubleSide,color:0xced0a6});
  for(let i=0;i<920;i++){
    const s=random()*main.length,p=at(main,s),side=random()<.5?-1:1,dist=19+Math.pow(random(),1.5)*198,q=offset(p,dist*side);
    if(q.x>21||(q.x>-567&&q.z>-394&&q.z<394)||townAt(q.x,q.z,45)||stations.some(p=>Math.hypot(p.x-q.x,p.z-q.z)<26))continue;
    const treeHeight=5+random()*7,base=height(q.x,q.z);
    for(let f=0;f<2;f++)api.place(card,leaf,q.x,base+treeHeight*.43,q.z,treeHeight,treeHeight,1,0,f*Math.PI/2+s);
  }
}
