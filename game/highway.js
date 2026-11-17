import * as T from 'three';
import {main,link,entry,exit,network,at,offset,profile,locate} from './highway-layout.js';

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
        vertex(batch,q.x,height,q.z,side/6,p.s/6);
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
    block(material,x,y,z,width,height,length+.035,0,yaw);
    if(hit)solid(x,z,width,length+.035,yaw);
  }
  const gap=s=>{const p=at(main,s);return Math.abs(p.x+1700)<1 && Math.abs(p.z)>=105 && Math.abs(p.z)<=326;};
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
        const open=mainline&&side<0&&gap(mid);
        // Where a slip road overlaps the mainline, leave the merge open all the way across its shoulder.
        const merge=(road===entry||road===exit)&&(p.x < -1679 || q.x < -1679);
        if(!open&&!merge)mark(road,s,e,t=>side*(width(t)-.75),.15,y+.025);
        if(!open&&!merge&&dist>6){
          const from=offset(p,side*(width(s)+.30)),to=offset(q,side*(width(e)+.30));
          if((road===entry||road===exit)&&((road===entry?mid:road.length-mid)<125))continue;
          if(road===link&&dist<25)continue;
          span(rail,from,to,.60,.18,.35,true);
          pole(steel,from.x,.34,from.z,.115,.69,.115);
          if(Math.floor(s/8)%3===0)block(side>0?white:amber,from.x,.83,from.z,.15,.13,.13);
        }
      }
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
    for(const side of [-1,1]){
      if(side<0&&gap(s))continue;
      const base=offset(p,side*(w+2.10)),tip=offset(p,side*(w-.40));
      pole(steel,base.x,4.7,base.z,.19,9.4,.19);
      span(steel,base,tip,9.35,.105,.12);
      block(emissive,tip.x,9.27,tip.z,.37,.14,.78,0,Math.atan2(p.tx,p.tz));
    }
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
    pole(steel,post.x,3.9,post.z,.35,7.8,.35);
    span(steel,post,center,7.72,.24,.24);
    const board=new T.Mesh(new T.BoxGeometry(7.7,2.35,.15),[gray,gray,gray,gray,signFace('A1',destination,detail,arrow),gray]);
    board.position.set(center.x,6.45,center.z);board.rotation.y=Math.atan2(-direction*p.tx,-direction*p.tz);
    scene.add(board);
  }
  gantry(main,50,1,'Tangenziale','Costa Nord   /   A1');
  gantry(main,main.length-52,-1,'Tangenziale','Costa Sud   /   A1');
  gantry(main,325,1,'Belvedere','Tangenziale costiera');
  gantry(main,1160,-1,'Porto Nord','Lungomare');
  const west=main.points.find(p=>p.x<-1699.9&&p.z>385);
  gantry(main,west.s,-1,'Centro città','Uscita Ovest   /   100 m',Math.PI/4);
  gantry(link,300,1,'Costa Nord','Ingresso autostrada');
  gantry(main,main.length-460,1,'Porto Sud','Fine autostrada   /   400 m',0);
  function overbridge(s){
    const p=at(main,s),a=offset(p,-24),b=offset(p,24);
    span(concrete,a,b,6.2,10.5,.85);
    for(const side of [-1,1]){
      const foot=offset(p,side*17.4);block(concrete,foot.x,2.9,foot.z,2,5.8,9,0,Math.atan2(p.tx,p.tz));
      const outer=offset(p,side*53);
      span(concrete,side<0?outer:b,side<0?a:outer,5.85,10.4,1.5);
      const q=at(main,s+side*5);span(rail,offset(q,-53),offset(q,53),7.25,.15,.55);
    }
  }
  overbridge(main.length*.31);overbridge(main.length*.7);

  // An inland terrain mesh drops below the roadbed around every carriageway and city block.
  let seed=985023;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const stations=network.flatMap(r=>r.points.filter((_,i)=>i%4===0));
  function height(x,z){
    let dist=Math.hypot(Math.max(-568-x,0,x-25),Math.max(-397-z,0,z-397));
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
    if(q.x>21||(q.x>-567&&q.z>-394&&q.z<394)||locate(q.x,q.z)?.distance<18)continue;
    const treeHeight=5+random()*7,base=height(q.x,q.z);
    for(let f=0;f<2;f++)api.place(card,leaf,q.x,base+treeHeight*.43,q.z,treeHeight,treeHeight,1,0,f*Math.PI/2+s);
  }
}
