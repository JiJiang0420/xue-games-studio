(() => {
 const d=window.siteContent?.donation;if(!d?.enabled)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const channels=d.channels.filter(c=>c.published&&(c.type==='qr'?c.image:c.url));
 const section=document.createElement('section');section.id='support';section.className='support-section wrap';section.setAttribute('aria-labelledby','support-title');
 section.innerHTML=`<div class="support-symbol" aria-hidden="true">♡</div><div class="support-copy"><p class="eyebrow">KEEP SMALL WORLDS GROWING</p><h2 id="support-title">${esc(d.title)}</h2><p class="support-description">${esc(d.description)}</p><p class="support-footnote">自愿支持 · 金额由你决定</p></div><div class="support-action">${channels.length?'<button class="button primary" id="support-open">支持创作 <span aria-hidden="true">♡</span></button><span>选择你方便的支持方式</span>':'<span class="support-pending">支持通道准备中</span><a href="#journal">先看看开发手记 ↗</a>'}</div>`;
 document.querySelector('.closing').before(section);
 const nav=document.createElement('a');nav.href='#support';nav.textContent='支持创作';document.querySelector('.site-header nav').appendChild(nav);
 if(!channels.length)return;
 const dialog=document.createElement('dialog');dialog.id='support-dialog';dialog.className='support-dialog';dialog.setAttribute('aria-labelledby','support-dialog-title');
 dialog.innerHTML=`<div class="support-dialog-inner"><div class="support-dialog-top"><p class="eyebrow">A LITTLE SUPPORT, A NEW POSSIBILITY</p><button class="support-close" aria-label="关闭支持窗口" autofocus>×</button></div><h2 id="support-dialog-title">谢谢你，支持独立创作。</h2><p class="support-dialog-intro">选择一种支持方式，金额由你决定。</p><div class="support-methods" role="group" aria-label="选择支持方式">${channels.map((c,i)=>`<button data-channel="${i}" aria-pressed="${i===0}">${esc(c.label)}</button>`).join('')}</div><div id="support-payment"></div><p class="support-thanks">${esc(d.thanks)}</p></div>`;
 document.body.appendChild(dialog);const payment=dialog.querySelector('#support-payment');let focusBack=null;
 function choose(i){const c=channels[i];dialog.querySelectorAll('[data-channel]').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));
  const recipient=c.recipient?`<p class="support-recipient">收款方 / ${esc(c.recipient)}</p>`:'';
  payment.innerHTML=c.type==='qr'?`<div class="support-qr-card"><img src="${esc(c.image)}" alt="${esc(c.label)}收款二维码" class="support-qr" width="280" height="280"><p class="support-qr-error" role="status" hidden>二维码暂时无法加载，请尝试其他支持方式。</p></div>${recipient}<p class="support-instructions">用对应的支付应用扫码。手机浏览时，可打开原图保存，再从支付应用的相册识别。支付前请核对收款方。</p><a class="support-original" href="${esc(c.image)}" target="_blank" rel="noopener noreferrer">打开二维码原图 ↗</a>`:`<div class="support-link-card"><span aria-hidden="true">♡</span><h3>${esc(c.label)}</h3>${recipient}<a class="button primary" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">前往赞助页面 ↗</a><p>将在新页面打开，支付前请核对收款方。</p></div>`;
  const img=payment.querySelector('img');if(img)img.addEventListener('error',()=>{img.hidden=true;payment.querySelector('.support-qr-error').hidden=false;});
 }
 choose(0);
 dialog.querySelectorAll('[data-channel]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.channel))));
 section.querySelector('#support-open').addEventListener('click',()=>{focusBack=document.activeElement;dialog.showModal();document.body.classList.add('modal-open');dialog.querySelector('.support-close').focus();});
 dialog.querySelector('.support-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');focusBack?.focus();});
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
})();
