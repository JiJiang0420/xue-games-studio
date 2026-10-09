(() => {
const $ = s => document.querySelector(s);
const escape = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!window.siteContent){document.querySelector('main').innerHTML='<div class="wrap" style="padding:80px 0"><h1>暂时无法读取网站内容</h1><p>请稍后刷新重试。</p><button class="button primary" onclick="location.reload()">重新加载</button></div>';return;}
const {games, posts, settings}=window.siteContent;
if(settings){
 document.title=settings.name+' · 独立游戏官网';
 document.querySelector('meta[name="description"]').content=settings.intro;
 const brand=document.querySelector('.brand>span:last-child');brand.textContent=settings.name;const small=document.createElement('small');small.textContent=settings.tagline;brand.appendChild(small);
 $('#intro-title').innerHTML=settings.headline.split('\n').map((t,i)=>i?'<span class="accent">'+escape(t)+'</span>':escape(t)).join('<br>');
 $('.intro-note p').textContent=settings.intro;$('.intro-note p').style.whiteSpace='pre-line';
 $('#about-title').textContent=settings.aboutTitle;$('#about-title').style.whiteSpace='pre-line';
 document.querySelectorAll('.about-copy>p:not(.eyebrow)').forEach(p=>p.remove());
 const about=document.createElement('p');about.textContent=settings.about;about.style.whiteSpace='pre-line';$('#about-title').after(about);
 $('.signature').textContent=settings.author;
 $('.closing>span').textContent=settings.closing;
 $('.footer-brand').textContent=settings.name;
 document.querySelector('footer p').textContent='© '+new Date().getFullYear()+' '+settings.name;
 if(settings.contactUrl){const link=document.createElement('a');link.className='text-link';link.textContent=settings.contactLabel||'联系我';link.href=settings.contactUrl;link.target='_blank';link.rel='noopener noreferrer';$('.about-copy').appendChild(link);}
 try{if(!localStorage.getItem('xue-theme'))document.documentElement.dataset.theme=settings.defaultTheme;}catch(e){document.documentElement.dataset.theme=settings.defaultTheme;}
 $('.count').textContent=' / '+String(games.length).padStart(2,'0');
 $('.collection-note').textContent=games.length?'每个世界都有自己的节奏。':'新的作品正在准备中，欢迎再来看看。';
 const featured=games.find(g=>g.id===settings.featuredId)||games[0];
 if(featured){
  $('.feature-kicker').textContent=settings.featureKicker;
  $('#feature-brief').innerHTML=featured.features.slice(0,3).map((f,i)=>`<div><span class="brief-number">0${i+1}</span><span>${escape(f[0])}</span></div>`).join('');
  $('#feature-title').textContent=featured.title;
  $('.feature-description').textContent=featured.description;
  $('.feature-status').textContent=featured.status;
  $('.feature-actions button').dataset.game=featured.id;
  $('.feature-bottom span:first-child').textContent=featured.tags.join(' / ');
  $('.feature-bottom span:last-child').textContent=featured.imageCaption||'';
  if(featured.image){$('.feature-art img').src=featured.image;$('.feature-art img').alt=featured.title;}else $('.feature-art').hidden=true;
 }else {$('.feature').hidden=true;$('#feature-brief').hidden=true;}
 if(!posts.length)$('#journal-list').innerHTML='<p>新的开发手记正在准备中。</p>';
}
const themeNames={editorial:'暗色杂志',pixel:'温暖像素',terminal:'工业科幻'};
function setTheme(theme,announce=false){
 document.documentElement.dataset.theme=theme;
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme)));
 document.querySelector('meta[name="theme-color"]').content={editorial:'#131715',pixel:'#f5eedc',terminal:'#08151e'}[theme];
 try{localStorage.setItem('xue-theme',theme)}catch(e){}
 if(announce)$('#announcement').textContent=`已切换到${themeNames[theme]}主题`;
}
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.themeChoice,true)));
setTheme(document.documentElement.dataset.theme);
function art(game){return game.image?`<img src="${escape(game.image)}" alt="${escape(game.title)}" width="768" height="512" loading="lazy">`:`<div class="type-art" aria-hidden="true"><span>${escape(game.english)}</span><strong>${escape(game.title)}</strong><small>${escape(game.status)}</small></div>`;}
function renderGames(filter='all'){
 const visible=games.filter(g=>filter==='all'||g.category===filter);
 $('#game-grid').innerHTML=visible.length?visible.map((g,i)=>`<article class="game-card"><button class="game-art ${escape(g.artClass)}" data-game="${escape(g.id)}" aria-label="查看${escape(g.title)}详情">${art(g)}<span class="card-status">${escape(g.status)}</span><span class="art-plus" aria-hidden="true">＋</span></button><div class="card-copy"><div class="game-meta">${g.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div><h3><button data-game="${escape(g.id)}">${escape(g.title)}</button></h3><p>${escape(g.description)}</p><button class="card-link" data-game="${escape(g.id)}">查看作品 <span aria-hidden="true">＋</span></button></div></article>`).join(''):'<div class="collection-empty"><span>暂时没有这个分类的作品</span><p>可以切换到“全部作品”，看看其他正在成形的世界。</p></div>';
 return visible.length;
}
renderGames();
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(o=>{o.classList.toggle('active',o===b);o.setAttribute('aria-pressed',String(o===b))});const count=renderGames(b.dataset.filter);$('#announcement').textContent=`显示 ${count} 个作品`;}));
if(posts.length)$('#journal-list').innerHTML=posts.map(p=>`<button class="journal-row" data-post="${escape(p.id)}"><span class="journal-number">${escape(p.number)}</span><span class="journal-body"><span class="journal-category">${escape(p.category)}</span><strong>${escape(p.title)}</strong><span class="journal-summary">${escape(p.summary)}</span><span class="read-time">阅读约 ${escape(p.read)}</span></span><span class="journal-plus" aria-hidden="true">＋</span></button>`).join('');
const dialog=$('#detail-dialog');
let returnFocus=null;
function openDialog(html){returnFocus=document.activeElement;$('#dialog-content').innerHTML=html;dialog.showModal();document.body.classList.add('modal-open');dialog.scrollTop=0;$('.dialog-close').focus({preventScroll:true});}
function closeDialog(){dialog.close();}
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');returnFocus?.focus()});
$('.dialog-close').addEventListener('click',closeDialog);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog()}});
document.addEventListener('click',e=>{
 const gameButton=e.target.closest('[data-game]');
 if(gameButton){const g=games.find(g=>g.id===gameButton.dataset.game);if(!g)return;
 const validDownload=/^https?:\/\//i.test(g.downloadUrl);
 openDialog(`<div class="dialog-art ${escape(g.artClass)}">${art(g)}</div><div class="dialog-copy"><header class="detail-heading"><p class="eyebrow">${escape(g.english)}</p><h2 id="dialog-title">${escape(g.title)}</h2><div class="detail-tags">${g.tags.map(t=>`<span>${escape(t)}</span>`).join('')}</div></header><div class="detail-layout"><div><p class="dialog-lead">${escape(g.intro)}</p>${g.features.length?`<div class="feature-list"><h3 class="detail-section-label">在这个世界里</h3>${g.features.map((f,i)=>`<section><span>${String(i+1).padStart(2,'0')}</span><div><h3>${escape(f[0])}</h3><p>${escape(f[1])}</p></div></section>`).join('')}</div>`:''}</div><aside class="release-box"><span class="release-eyebrow">游戏状态</span><strong class="release-status">${escape(g.status)}</strong>${validDownload?`<a class="button primary" href="${escape(g.downloadUrl)}" target="_blank" rel="noopener noreferrer">获取游戏</a>`:`<span class="release-availability">${g.category==='development'?'试玩尚未开放':'概念展示'}</span>`}<p>${escape(g.note)}</p></aside></div>${g.imageCaption?`<p class="art-disclaimer">${escape(g.imageCaption)}</p>`:''}</div>`);return;}
 const postButton=e.target.closest('[data-post]');
 if(postButton){const p=posts.find(p=>p.id===postButton.dataset.post);if(!p)return;openDialog(`<article class="dialog-copy article-copy"><p class="eyebrow">DEV NOTES / ${escape(p.number)}</p><p class="journal-category">${escape(p.category)} · 阅读约 ${escape(p.read)}</p><h2 id="dialog-title">${escape(p.title)}</h2><p class="article-intro">${escape(p.summary)}</p>${p.paragraphs.map(t=>`<p>${escape(t)}</p>`).join('')}<div class="article-signature">${escape(settings?.author||'XUE')} / 开发手记</div></article>`);}
});
if($('#year'))$('#year').textContent=new Date().getFullYear();
})();
