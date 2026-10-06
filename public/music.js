(() => {
  const config=window.siteContent?.music;
  const tracks=config?.tracks?.filter(t=>t.published!==false&&t.src);
  if(!config?.enabled||!tracks?.length)return;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const root=document.createElement('section');root.className='music-player';root.setAttribute('aria-label','网站音乐播放器');
  root.innerHTML=`<audio preload="none"></audio><div class="music-panel" id="music-panel" hidden><div class="music-heading"><span>创作时的声音</span><span>${tracks.length} 首</span></div><ol class="music-list">${tracks.map((t,i)=>`<li><button type="button" data-track="${i}"><span class="music-number">${String(i+1).padStart(2,'0')}</span><span><strong>${esc(t.title)}</strong><small>${esc(t.artist||'背景音乐')}</small></span><span class="music-current" aria-hidden="true">♪</span></button></li>`).join('')}</ol><div class="music-seek"><span class="music-time">0:00</span><input type="range" min="0" max="100" value="0" step="0.1" aria-label="播放进度" disabled><span class="music-duration">--:--</span></div><div class="music-options"><label>音量 <input class="music-volume" type="range" min="0" max="1" value="0.45" step="0.05" aria-label="音量"></label><button type="button" class="music-loop" aria-pressed="false">列表循环</button></div><p class="music-status" role="status">点击播放，让音乐陪你逛一会儿。</p></div><div class="music-bar"><span class="music-disc" aria-hidden="true">♫</span><button type="button" class="music-expand" aria-expanded="false" aria-controls="music-panel"><strong class="music-title"></strong><small>背景音乐 · 展开曲目</small></button><button type="button" class="music-prev music-icon" aria-label="上一首">‹</button><button type="button" class="music-play music-icon" aria-label="播放音乐">▶</button><button type="button" class="music-next music-icon" aria-label="下一首">›</button></div>`;
  document.body.append(root);document.body.classList.add('has-music');
  const $=s=>root.querySelector(s),audio=$('audio'),play=$('.music-play'),panel=$('.music-panel'),expand=$('.music-expand'),seek=$('.music-seek input'),volume=$('.music-volume'),status=$('.music-status');
  let index=0,single=false,loaded=false,request=0;
  const time=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'--:--';
  try{const saved=localStorage.getItem('xue-music-volume');if(saved!==null&&Number.isFinite(Number(saved)))volume.value=String(Math.max(0,Math.min(1,Number(saved))));}catch{}
  audio.volume=Number(volume.value);
  function display(){const t=tracks[index];$('.music-title').textContent=t.title;root.querySelectorAll('[data-track]').forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current')});seek.value=0;seek.disabled=true;$('.music-time').textContent='0:00';$('.music-duration').textContent='--:--';}
  function playing(){const active=!audio.paused&&!audio.ended;play.textContent=active?'Ⅱ':'▶';play.setAttribute('aria-label',active?'暂停音乐':'播放音乐');root.classList.toggle('is-playing',active);}
  async function start(){const token=++request;try{if(!loaded){audio.src=tracks[index].src;loaded=true;}status.textContent='正在加载音乐…';await audio.play();if(token===request)status.textContent='正在播放 · '+tracks[index].title;}catch(e){if(token!==request)return;status.textContent=e.name==='NotAllowedError'?'请点击播放按钮开始播放。':'这首音乐暂时无法播放，请重试或切换曲目。';setExpanded(true);playing();}}
  function choose(i,autoplay){++request;audio.pause();index=(i+tracks.length)%tracks.length;loaded=false;audio.removeAttribute('src');audio.load();display();status.textContent='已选择 · '+tracks[index].title;if(autoplay)start();}
  function setExpanded(open){panel.hidden=!open;expand.setAttribute('aria-expanded',String(open));expand.querySelector('small').textContent=open?'背景音乐 · 收起曲目':'背景音乐 · 展开曲目';}
  play.addEventListener('click',()=>{if(audio.paused)start();else{++request;audio.pause();status.textContent='音乐已暂停';}});
  expand.addEventListener('click',()=>setExpanded(panel.hidden));
  $('.music-prev').addEventListener('click',()=>choose(index-1,!audio.paused));$('.music-next').addEventListener('click',()=>choose(index+1,!audio.paused));
  root.querySelectorAll('[data-track]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.track),true)));
  $('.music-prev').disabled=$('.music-next').disabled=tracks.length<2;
  volume.addEventListener('input',()=>{audio.volume=Number(volume.value);try{localStorage.setItem('xue-music-volume',volume.value)}catch{}});
  $('.music-loop').addEventListener('click',e=>{single=!single;e.currentTarget.textContent=single?'单曲循环':'列表循环';e.currentTarget.setAttribute('aria-pressed',String(single));});
  seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number(seek.value)/100*audio.duration;});
  for(const event of ['play','pause','ended'])audio.addEventListener(event,playing);
  audio.addEventListener('loadedmetadata',()=>{seek.disabled=!Number.isFinite(audio.duration)||audio.duration<=0;$('.music-duration').textContent=time(audio.duration);});
  audio.addEventListener('timeupdate',()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)seek.value=String(audio.currentTime/audio.duration*100);$('.music-time').textContent=time(audio.currentTime);});
  audio.addEventListener('ended',()=>{if(single){audio.currentTime=0;start()}else choose(index+1,true);});
  audio.addEventListener('error',()=>{if(!loaded)return;status.textContent='音频无法读取，请切换曲目，或联系作者更新音频。';setExpanded(true);playing();});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){setExpanded(false);expand.focus();}});
  display();
})();
