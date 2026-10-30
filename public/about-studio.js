(() => {
  const section = document.getElementById('about');
  const settings = window.siteContent?.settings;
  if (!section || !settings || section.dataset.studioEnhanced) return;
  section.dataset.studioEnhanced = 'true';
  const copy = section.querySelector('.about-copy');
  const identity = section.querySelector('.studio-identity');
  if (!copy || !identity) return;
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const visual = element('div', 'studio-visual');
  identity.replaceWith(visual);
  visual.append(identity);
  const aboutTitle = copy.querySelector('#about-title');
  const titleLines = (settings.aboutTitle || '').split('\n');
  if (aboutTitle && titleLines.length > 2) {
    aboutTitle.textContent = titleLines.slice(0, 2).join('\n');
    aboutTitle.after(element('p', 'studio-lead', titleLines.slice(2).join('\n')));
  }
  // Preserve the owner's current copy, allowing its line breaks to reflow on
  // smaller screens instead of enlarging the panel around a small original.
  for (const paragraph of copy.querySelectorAll('p:not(.eyebrow):not(.studio-lead)')) {
    paragraph.style.whiteSpace = 'normal';
  }
  const creator = element('figure', 'creator-illustration');
  const scene = element('button', 'creator-scene');
  scene.type = 'button';
  scene.setAttribute('aria-label', '查看 XPG 星光手柄彩蛋');
  scene.setAttribute('aria-pressed', 'false');
  scene.setAttribute('aria-describedby', 'creator-interaction-help');
  // The existing character pixels stay untouched. SVG masks separate the
  // raised pose and pointer; a complete portal can unfold independently.
  const themes = ['pixel', 'editorial', 'terminal'];
  const geometry = {
    pixel: {
      body: '0,0 540,0 540,303 589,303 608,345 620,366 632,371 630,395 630,900 0,900',
      pointer: '565,233 581,224 702,284 705,299 671,313 699,355 671,373 644,335 625,358 614,363',
    },
    editorial: {
      body: '0,0 530,0 530,315 581,315 593,357 606,376 627,389 624,411 624,900 0,900',
      pointer: '557,249 572,239 684,302 686,320 654,331 682,374 647,389 627,352 606,371 590,373',
    },
    terminal: {
      body: '0,0 530,0 530,299 590,299 607,338 622,368 644,387 640,414 640,900 0,900',
      pointer: '568,218 581,209 703,279 705,295 671,309 697,356 666,374 643,333 620,354 605,356',
    },
  };
  const makeArt = (state, size) => {
    const layer = element('span', 'creator-layer creator-' + state);
    layer.setAttribute('aria-hidden', 'true');
    for (const theme of themes) {
      const image = element('img', 'creator-art');
      image.dataset.creatorTheme = theme;
      image.src = `assets/xpg/${state === 'portal' ? 'layers' : 'cutout'}/${theme}-${state}.png`;
      image.alt = '';
      [image.width, image.height] = size;
      image.decoding = 'async';
      image.draggable = false;
      layer.append(image);
    }
    return layer;
  };
  const idle = makeArt('idle', [1320, 900]);
  idle.append(element('span', 'creator-heart-light'));
  scene.append(idle);
  for (const state of ['character', 'pointer']) {
    const layer = element('span', 'creator-layer creator-' + state);
    layer.setAttribute('aria-hidden', 'true');
    for (const theme of themes) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'creator-art');
      svg.dataset.creatorTheme = theme;
      svg.setAttribute('viewBox', '0 0 1320 900');
      svg.setAttribute('focusable', 'false');
      const id = `xpg-${theme}-${state}`;
      const shape = geometry[theme];
      // All polygon points and asset paths are fixed local design data.
      svg.innerHTML = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1320" height="900"><rect width="1320" height="900" fill="black"/><polygon points="${state === 'character' ? shape.body : shape.pointer}" fill="white"/>${state === 'character' ? `<polygon points="${shape.pointer}" fill="black"/>` : ''}</mask></defs><image href="assets/xpg/cutout/${theme}-magic.png" width="1320" height="900" mask="url(#${id})"/>`;
      layer.append(svg);
    }
    scene.append(layer);
  }
  const portal = element('span', 'creator-layer creator-portal');
  portal.setAttribute('aria-hidden', 'true');
  const portalPosition = element('span', 'creator-portal-position');
  const portalReveal = element('span', 'creator-portal-reveal');
  const portalArt = makeArt('portal', [768, 768]);
  portalArt.className = 'creator-portal-art';
  portalReveal.append(portalArt);
  for (let i = 1; i <= 3; i++) portalReveal.append(element('span', `creator-glint creator-glint-${i}`));
  portalPosition.append(portalReveal);
  portal.append(portalPosition);
  scene.append(portal);
  scene.append(element('span', 'creator-discovery-dot creator-discovery-dot-one'), element('span', 'creator-discovery-dot creator-discovery-dot-two'), element('span', 'creator-light-trail'));
  const signatureArt = element('span', 'creator-signature');
  signatureArt.setAttribute('aria-hidden', 'true');
  for (const theme of themes) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'creator-art');
    svg.dataset.creatorTheme = theme;
    svg.setAttribute('viewBox', '0 0 96 65');
    svg.setAttribute('focusable', 'false');
    // Preserve the original handwriting pixels and hide its adjacent caption.
    const id = `xpg-signature-only-${theme}`;
    svg.innerHTML = `<defs><clipPath id="${id}"><polygon points="0,0 96,0 96,37 67,37 67,65 0,65"/></clipPath></defs><image href="assets/xpg/cutout/${theme}-signature.png" width="216" height="65" clip-path="url(#${id})"/></svg>`;
    signatureArt.append(svg);
  }
  const help = element('span', 'sr-only', '鼠标靠近点亮心形，停留片刻展开星空彩蛋，移开恢复日常。触屏轻触切换；键盘按回车或空格切换，按 Escape 关闭。');
  help.id = 'creator-interaction-help';
  const signature = element('figcaption', 'sr-only', 'XPG。珊瑚红的 g 形小精灵，带心形镂空与弯尾。');
  creator.append(scene, signatureArt, help, signature);
  visual.append(creator);
  copy.querySelector('.signature')?.remove();

  const values = copy.querySelector('.studio-values');
  if (values) {
    const beliefs = element('section', 'studio-beliefs');
    beliefs.setAttribute('aria-labelledby', 'studio-values-title');
    const title = element('h3', 'studio-beliefs-title');
    title.id = 'studio-values-title';
    title.append(element('span', '', 'GLHF'), document.createTextNode(' / 我们的信条'));
    const panel = element('div', 'studio-beliefs-panel');
    values.replaceWith(beliefs);
    panel.append(values, element('p', 'studio-motto', 'Good luck, have fun.'));
    beliefs.append(title, panel);
  }

  const card = element('section', 'studio-contact');
  card.setAttribute('aria-labelledby', 'studio-contact-title');
  const header = element('div', 'studio-contact-header');
  const heading = element('div');
  const title = element('h3', '', '聊聊游戏，也聊聊新想法。');
  title.id = 'studio-contact-title';
  heading.append(element('p', 'studio-contact-eyebrow', 'LET’S TALK / 联系我'), title);
  header.append(heading);
  if (/^(https?:|mailto:)/i.test(settings.contactUrl || '')) {
    const label = settings.contactLabel && settings.contactLabel !== '联系我'
      ? settings.contactLabel : /^mailto:/i.test(settings.contactUrl) ? '写邮件' : '联系我';
    const action = element('a', 'studio-contact-action', label);
    action.href = settings.contactUrl;
    if (/^https?:/i.test(settings.contactUrl)) { action.target = '_blank'; action.rel = 'noopener noreferrer'; }
    const arrow = element('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    action.append(arrow);
    header.append(action);
  }
  card.append(header);
  const list = element('dl', 'studio-contact-list');
  const icons = {
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></svg>',
    steam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7h8c3 0 4 3 5 8 .6 4-2 5-4 2l-1-1H8l-1 1c-2 3-4.6 2-4-2C4 10 5 7 8 7Z"/><path d="M8 9v5m-2.5-2.5h5M16 10h.01M18 12h.01"/></svg>',
    other: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2.3-4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8M8 14h5"/></svg>'
  };
  for (const line of (settings.contactDetails || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    const match = line.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
    let label = match ? match[1].trim() : '联系方式';
    const value = match ? match[2].trim() : line;
    const kind = /^(e-?mail|邮箱|电子邮件|邮件)$/i.test(label) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'email'
      : /steam/i.test(label) ? 'steam' : 'other';
    if (kind === 'email') label = 'EMAIL';
    if (kind === 'steam') label = 'STEAM';
    const row = element('div', 'studio-contact-item');
    const icon = element('span', 'studio-contact-icon');
    icon.innerHTML = icons[kind];
    const details = element('div', 'studio-contact-text');
    details.append(element('dt', '', label), element('dd', '', value));
    const button = element('button', 'studio-contact-copy', '复制');
    button.type = 'button';
    button.setAttribute('aria-label', '复制' + label);
    button.addEventListener('click', async () => {
      let copied = false;
      try { await navigator.clipboard.writeText(value); copied = true; }
      catch {
        const field = element('textarea', 'studio-copy-buffer');
        field.value = value;
        field.setAttribute('readonly', '');
        document.body.append(field);
        field.select();
        try { copied = document.execCommand('copy'); } catch {}
        field.remove();
        button.focus({preventScroll: true});
      }
      button.textContent = copied ? '已复制' : '请选中文本';
      const announcement = document.getElementById('announcement');
      if (announcement) announcement.textContent = copied ? label + '已复制' : '请选中联系方式复制。';
      window.setTimeout(() => { button.textContent = '复制'; }, 1800);
    });
    row.append(icon, details, button);
    list.append(row);
  }
  if (list.children.length) card.append(list);
  else card.append(element('p', 'studio-contact-empty', '联系方式待补充'));
  const oldContact = copy.querySelector('.contact-row');
  if (oldContact) oldContact.replaceWith(card); else copy.append(card);
})();
