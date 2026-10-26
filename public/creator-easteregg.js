


(()=>{
  const root=document.getElementById('about');
  if(!root)return;
  const scene=root.querySelector('.creator-scene');
  const canvas=root.querySelector('.creator-cosmos');
  if(!scene||!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const started=performance.now();
  let active=false,leaveTimer=0,lastPointer='',raf=0,stopAt=0,inView=true;
  let targetX=0,targetY=0,parallaxX=0,parallaxY=0;
  const holePoints=[[281,794],[305,766],[350,765],[383,728],[409,701],[441,688],[462,695],[482,714],[501,719],[510,743],[525,764],[530,794],[518,826],[517,849],[505,870],[486,888],[471,909],[449,924],[431,939],[411,955],[403,963],[384,944],[360,938],[345,922],[320,916],[304,916],[285,894],[273,881],[269,867],[269,840],[274,814]];
  const hole=new Path2D();holePoints.forEach(([x,y],i)=>i?hole.lineTo(x,y):hole.moveTo(x,y));hole.closePath();
  let seed=1073;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  const stars=Array.from({length:46},(_,i)=>({x:265+random()*268,y:685+random()*283,r:.4+random()*1.15,phase:random()*Math.PI*2,speed:.28+random()*.62,big:i%11===0,color:i%3===0?'198,220,255':i%3===1?'237,203,255':'255,226,174'}));
  function cubic(points,a,b,c,d,n=18){for(let i=1;i<=n;i++){const t=i/n,u=1-t;points.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}}
  function resample(points,count){
    const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
    const total=lengths[lengths.length-1],result=[];let j=1;
    for(let i=0;i<count;i++){const d=i/(count-1)*total;while(j<lengths.length-1&&lengths[j]<d)j++;const f=(d-lengths[j-1])/(lengths[j]-lengths[j-1]||1);result.push([points[j-1][0]+(points[j][0]-points[j-1][0])*f,points[j-1][1]+(points[j][1]-points[j-1][1])*f]);}return result;
  }
  // Match the compact, gently tilted silhouette of the original illustrated controller.
  const raw=[[-70,-47]];
  cubic(raw,[-70,-47],[-53,-51],[-36,-44],[-23,-48]);
  cubic(raw,[-23,-48],[-7,-51],[12,-65],[25,-70]);
  cubic(raw,[25,-70],[38,-76],[55,-73],[66,-62]);
  cubic(raw,[66,-62],[84,-48],[96,-20],[101,-4]);
  cubic(raw,[101,-4],[107,8],[108,16],[104,24]);
  cubic(raw,[104,24],[103,34],[95,42],[84,40]);
  cubic(raw,[84,40],[71,43],[56,31],[46,24]);
  cubic(raw,[46,24],[35,18],[25,12],[16,13]);
  cubic(raw,[16,13],[3,12],[-12,15],[-23,22]);
  cubic(raw,[-23,22],[-35,28],[-38,42],[-48,54]);
  cubic(raw,[-48,54],[-55,66],[-65,74],[-75,69]);
  cubic(raw,[-75,69],[-84,67],[-91,59],[-93,51]);
  cubic(raw,[-93,51],[-98,42],[-101,28],[-99,15]);
  cubic(raw,[-99,15],[-100,4],[-98,-9],[-94,-19]);
  cubic(raw,[-94,-19],[-89,-32],[-82,-43],[-70,-47]);
  const contour=resample(raw,300);
  const plus=[[-6.5,-18.5],[6.5,-18.5],[6.5,-6.5],[18.5,-6.5],[18.5,6.5],[6.5,6.5],[6.5,18.5],[-6.5,18.5],[-6.5,6.5],[-18.5,6.5],[-18.5,-6.5],[-6.5,-6.5],[-6.5,-18.5]].map(([x,y])=>[x*Math.cos(-.23)-y*Math.sin(-.23)-60,x*Math.sin(-.23)+y*Math.cos(-.23)-2]);
  const details=[resample(plus,96)];
  [[38,-43.5],[59.5,-32],[26,-22.5],[47,-11.5]].forEach(([x,y])=>details.push(Array.from({length:40},(_,i)=>[x+7.1*Math.cos(i/39*Math.PI*2),y+7.1*Math.sin(i/39*Math.PI*2)])));
  function inside(points,x,y){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  function glow(x,y,r,rgb,opacity){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba('+rgb+','+opacity+')');g.addColorStop(.45,'rgba('+rgb+','+(opacity*.32)+')');g.addColorStop(1,'rgba('+rgb+',0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function dot(x,y,r,rgb,alpha){ctx.fillStyle='rgba('+rgb+','+alpha+')';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function glint(x,y,r,rgb,alpha){
    glow(x,y,r*3.2,rgb,alpha*.2);ctx.strokeStyle='rgba('+rgb+','+alpha+')';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r*1.35);ctx.lineTo(x,y+r*1.35);ctx.stroke();dot(x,y,.8,'255,250,231',alpha);
  }
  // Use the original illustration as the visual source; this layer adds only light.
  const sourceImage=root.querySelector('.creator-magic img');
  let lightMap=null;
  function prepareLightMap(){
    try{
      const map=document.createElement('canvas');map.width=234;map.height=176;
      const mapCtx=map.getContext('2d',{willReadFrequently:true});
      mapCtx.drawImage(sourceImage,282,740,234,176,0,0,234,176);
      const pixels=mapCtx.getImageData(0,0,234,176),data=pixels.data;
      for(let y=0;y<176;y++)for(let x=0;x<234;x++){
        const i=(y*234+x)*4,r=data[i],g=data[i+1],b=data[i+2],lx=x+282-396,ly=y+740-826;
        if(r<135||g<95||r<b){data[i+3]=0;continue;}
        let distance=1000;
        for(let k=0;k<contour.length;k+=3)distance=Math.min(distance,Math.hypot(contour[k][0]-lx,contour[k][1]-ly));
        const button=details.some(points=>inside(points,lx,ly));
        const edge=button?1:Math.max(0,Math.min(1,(11-distance)/5));
        const brightness=Math.max(0,Math.min(1,(r*.3+g*.59+b*.11-100)/120));
        const warmth=Math.max(0,Math.min(1,(r-b+25)/85));
        data[i+3]=Math.round(225*edge*brightness*warmth);
      }
      mapCtx.putImageData(pixels,0,0);lightMap=map;
      if(active)requestFrame();
    }catch{lightMap=null;}
  }
  function paint(t){
    if(!ctx)return;
    const scale=canvas.width/520;
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.setTransform(scale,0,0,scale,-50*scale,-650*scale);
    ctx.save();ctx.clip(hole);ctx.globalCompositeOperation='screen';
    const breath=.5+.5*Math.sin(t*.72);
    parallaxX+=(targetX-parallaxX)*.045;parallaxY+=(targetY-parallaxY)*.045;
    // Translucent haze blends with the untouched sky instead of covering it.
    glow(367+Math.sin(t*.23)*11+parallaxX,837+Math.cos(t*.3)*10,104,'104,65,189',.065+breath*.055);
    glow(468+Math.cos(t*.21)*10,777+Math.sin(t*.25)*10+parallaxY,82,'56,120,190',.045+breath*.045);
    glow(427+Math.sin(t*.2)*12,917,66,'160,62,145',.055);
    // The bloom uses the exact original bright pixels, preserving the hand-painted silhouette.
    if(lightMap){ctx.save();ctx.globalAlpha=.055+breath*.12;ctx.filter='blur(.7px)';ctx.drawImage(lightMap,282+Math.sin(t*.53)*.18,740+Math.sin(t*.83)*.25);ctx.restore();}
    stars.forEach(s=>{
      const x=s.x+Math.sin(t*.26+s.phase)*3,y=s.y+Math.cos(t*.2+s.phase)*2-t*s.speed%9;
      const pulse=.12+.5*(.5+.5*Math.sin(t*(.7+s.speed)+s.phase));
      if(s.big)glint(x,y,1.8+pulse*1.5,s.color,pulse);else dot(x,y,s.r*.72,s.color,pulse*.7);
    });
    ctx.save();ctx.translate(396,826);
    // Two small travelling glints follow the existing edge; no replacement stroke is drawn.
    for(let k=0;k<2;k++){
      const progress=((t*.055+k*.53)%1)*contour.length;
      for(let j=16;j>=0;j--){const idx=((Math.floor(progress)-j)%contour.length+contour.length)%contour.length,[x,y]=contour[idx],a=1-j/17;dot(x+Math.sin(j*2.3+t)*.7,y+Math.cos(j*2.3+t)*.7,.28+a*.72,k?'230,222,255':'255,238,191',a*.68);}
      const [x,y]=contour[Math.floor(progress)%contour.length];glint(x,y,2.8,k?'233,229,255':'255,245,213',.82);
    }
    // Local star clusters brighten and dissolve at different times.
    for(let i=0;i<7;i++){
      const phase=(t+i*.83)%6.2;if(phase>1.8)continue;
      const strength=Math.sin(phase/1.8*Math.PI),point=contour[(i*43+17)%contour.length];
      glint(point[0],point[1],1.3+strength*1.7,'255,239,201',strength*.72);
      for(let j=0;j<3;j++){const a=i*2.399+j*2.1,spread=1+phase*2.8;dot(point[0]+Math.cos(a)*spread,point[1]+Math.sin(a)*spread,.45,'255,214,161',strength*.45);}
    }
    ctx.restore();
    // One occasional short meteor, kept inside the open heart.
    const phase=(t+2)%9.6;
    if(phase<1.1){const p=phase/1.1,x=437+p*65,y=711+p*39,a=Math.sin(p*Math.PI)*.45,g=ctx.createLinearGradient(x-16,y-10,x,y);g.addColorStop(0,'rgba(198,226,255,0)');g.addColorStop(1,'rgba(231,239,255,'+a+')');ctx.strokeStyle=g;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x-16,y-10);ctx.lineTo(x,y);ctx.stroke();glint(x,y,1.7,'233,240,255',a);}
    ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='rgba(0,0,0,.9)';ctx.lineWidth=10;ctx.filter='blur(3px)';ctx.stroke(hole);ctx.filter='none';ctx.restore();
  }
  function frame(now){
    raf=0;if(!root.isConnected)return;
    paint(motion.matches?2.4:(now-started)/1000+2.4);
    if(!motion.matches&&inView&&!document.hidden&&(active||now<stopAt))raf=requestAnimationFrame(frame);
  }
  function requestFrame(){if(!raf&&ctx)raf=requestAnimationFrame(frame);}
  function resize(){const r=scene.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(320,Math.round(r.width*dpr));canvas.height=Math.round(canvas.width*375/520);paint(motion.matches?2.4:(performance.now()-started)/1000+2.4);}
  function show(value){
    clearTimeout(leaveTimer);active=value;scene.classList.toggle('is-active',active);scene.setAttribute('aria-pressed',String(active));scene.setAttribute('aria-label',active?'关闭星光彩蛋，回到角色插图':'查看星光手柄彩蛋');
    if(!active){targetX=0;targetY=0;stopAt=performance.now()+340;}requestFrame();
  }
  scene.addEventListener('pointerenter',e=>{lastPointer=e.pointerType;if(e.pointerType==='mouse')show(true);});
  scene.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;const r=scene.getBoundingClientRect();targetX=((e.clientX-r.left)/r.width-.5)*4;targetY=((e.clientY-r.top)/r.height-.5)*3;});
  scene.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')leaveTimer=setTimeout(()=>show(false),90);});
  scene.addEventListener('pointerdown',e=>{lastPointer=e.pointerType;});
  scene.addEventListener('pointercancel',()=>show(false));
  scene.addEventListener('click',e=>{if(e.detail===0||lastPointer!=='mouse')show(!active);});
  scene.addEventListener('blur',()=>show(false));
  scene.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();show(false);}});
  motion.addEventListener('change',()=>{targetX=0;targetY=0;resize();requestFrame();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(active)requestFrame();});
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(scene);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView&&active)requestFrame();else if(!inView){cancelAnimationFrame(raf);raf=0;}}).observe(root);
  if(sourceImage.complete&&sourceImage.naturalWidth)prepareLightMap();else sourceImage.addEventListener('load',prepareLightMap,{once:true});
  resize();
})();
