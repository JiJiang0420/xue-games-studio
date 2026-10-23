(()=>{
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function images(game){return [...new Set([game.image,...(game.gallery||[])].filter(Boolean))];}
function markup(game){
 const list=images(game);
 if(!list.length)return '';
 return `<section class="project-gallery" aria-label="${escape(game.title)}概念图片"><div class="gallery-track" tabindex="0" aria-label="左右滑动浏览图片">${list.map((src,i)=>`<figure class="gallery-slide"><img src="${escape(src)}" alt="${escape(game.title)} · ${i===0?'选定封面':'风格探索 '+i}" width="1280" height="720" ${i?'loading="lazy"':''}></figure>`).join('')}</div>${list.length>1?`<div class="gallery-controls"><button type="button" data-gallery-step="-1" aria-label="上一张图片">← 上一张</button><span class="gallery-position" aria-live="polite">1 / ${list.length}</span><button type="button" data-gallery-step="1" aria-label="下一张图片">下一张 →</button></div><div class="gallery-thumbs" aria-label="选择图片">${list.map((src,i)=>`<button type="button" data-gallery-index="${i}" aria-label="查看第 ${i+1} 张${i===0?'（封面）':''}" aria-pressed="${i===0}"><img src="${escape(src)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}</section>`;
}
function bind(dialog,game){
 const gallery=dialog.querySelector('.project-gallery');if(!gallery)return;
 const track=gallery.querySelector('.gallery-track');const count=images(game).length;
 let index=0;const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const set=i=>{index=Math.max(0,Math.min(count-1,i));track.scrollTo({left:index*track.clientWidth,behavior:reduced?'instant':'smooth'});};
 const sync=()=>{index=Math.max(0,Math.min(count-1,Math.round(track.scrollLeft/Math.max(1,track.clientWidth))));const position=gallery.querySelector('.gallery-position');if(position)position.textContent=`${index+1} / ${count}`;gallery.querySelectorAll('[data-gallery-index]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.galleryIndex)===index)));gallery.querySelectorAll('[data-gallery-step]').forEach(b=>b.disabled=Number(b.dataset.galleryStep)<0?index===0:index===count-1);};
 gallery.querySelectorAll('[data-gallery-step]').forEach(b=>b.addEventListener('click',()=>set(index+Number(b.dataset.galleryStep))));
 gallery.querySelectorAll('[data-gallery-index]').forEach(b=>b.addEventListener('click',()=>set(Number(b.dataset.galleryIndex))));
 track.addEventListener('scroll',sync,{passive:true});
 track.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();set(index+(e.key==='ArrowRight'?1:-1));}});
 sync();
}
window.GLHFGallery={markup,bind};
})();
