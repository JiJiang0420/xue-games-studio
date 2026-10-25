(() => {
  const cards = [...document.querySelectorAll('.learn-card')];
  const search = document.querySelector('#learning-search');
  const category = document.querySelector('#learning-category');
  const typeLinks = [...document.querySelectorAll('[data-resource-type]')];
  const typeNames = {learning:'学习资料',tool:'工具',asset:'素材资源'};
  const requestedType = new URL(location.href).searchParams.get('type');
  let activeType = Object.hasOwn(typeNames, requestedType) ? requestedType : 'learning';
  const status = document.querySelector('#learning-status');
  const empty = document.querySelector('.learning-empty');
  const theme = document.querySelector('#learning-theme');
  const themes = {editorial:'#131715',pixel:'#f5eedc',terminal:'#08151e'};
  function setTheme(value) {
    if (!Object.hasOwn(themes, value)) return;
    document.documentElement.dataset.theme = value;
    theme.value = value;
    document.querySelector('meta[name="theme-color"]').content = themes[value];
  }
  try { setTheme(localStorage.getItem('xue-theme')); } catch {}
  theme.addEventListener('change', () => {
    setTheme(theme.value);
    try { localStorage.setItem('xue-theme', theme.value); } catch {}
  });
  function filter() {
    const query = search.value.trim().toLocaleLowerCase();
    let count = 0;
    cards.forEach(card => {
      card.hidden = !!(card.dataset.type !== activeType || (category.value && card.dataset.category !== category.value) || !card.textContent.toLocaleLowerCase().includes(query));
      if (!card.hidden) count++;
    });
    status.textContent = `${typeNames[activeType]}：显示 ${count} / ${cards.filter(c=>c.dataset.type===activeType).length} 项`;
    empty.hidden = count !== 0;
    typeLinks.forEach(link => {
      if (link.dataset.resourceType === activeType) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    });
  }
  typeLinks.forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    activeType = link.dataset.resourceType; category.value = ''; search.value = '';
    const url = new URL(location.href); url.searchParams.set('type',activeType); url.hash = 'library';
    history.replaceState(null,'',url); filter();
  }));
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  document.querySelector('#learning-reset').addEventListener('click', () => {
    search.value = ''; category.value = ''; filter(); search.focus();
  });
  function openLinkedGuide() {
    const id = location.hash.slice(1);
    const card = cards.find(c => c.id === id);
    if (card) {
      activeType = card.dataset.type;
      search.value = ''; category.value = ''; filter();
      card.querySelector('details').open = true;
      card.scrollIntoView({block:'start'});
    }
  }
  document.querySelector('.library-controls').hidden = false;
  window.addEventListener('hashchange', openLinkedGuide);
  filter();
  openLinkedGuide();
})();

