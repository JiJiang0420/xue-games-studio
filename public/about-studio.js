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
  const creator = element('figure', 'creator-illustration');
  const scene = element('button', 'creator-scene');
  scene.type = 'button';
  scene.setAttribute('aria-label', '查看星光手柄彩蛋');
  scene.setAttribute('aria-pressed', 'false');
  scene.setAttribute('aria-describedby', 'creator-interaction-help');
  for (const state of ['idle', 'magic']) {
    const crop = element('span', 'creator-crop creator-' + state);
    crop.setAttribute('aria-hidden', 'true');
    const image = element('img');
    image.src = 'assets/xpg-mascot-atlas.png';
    image.alt = '';
    image.width = 1536;
    image.height = 1024;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    crop.append(image);
    scene.append(crop);
  }
  const sparkles = element('span', 'creator-sparkles');
  sparkles.setAttribute('aria-hidden', 'true');
  scene.append(sparkles);
  const help = element('span', 'sr-only', '鼠标移入显示星光手柄，移开恢复角色插图。触屏轻触切换；键盘按回车或空格切换，按 Escape 关闭。');
  help.id = 'creator-interaction-help';
  const signature = element('figcaption', 'creator-signature');
  signature.append(element('strong', '', 'XPG'), element('span', '', '独立游戏创作者'));
  creator.append(scene, help, signature);
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
