(() => {
  const cards = [...document.querySelectorAll('.learn-card')];
  const search = document.querySelector('#learning-search');
  const category = document.querySelector('#learning-category');
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
      card.hidden = !!((category.value && card.dataset.category !== category.value) || !card.textContent.toLocaleLowerCase().includes(query));
      if (!card.hidden) count++;
    });
    status.textContent = `显示 ${count} / ${cards.length} 项学习资源`;
    empty.hidden = count !== 0;
  }
  search.addEventListener('input', filter);
  category.addEventListener('change', filter);
  document.querySelector('#learning-reset').addEventListener('click', () => {
    search.value = ''; category.value = ''; filter(); search.focus();
  });
  function openLinkedGuide() {
    const id = location.hash.slice(1);
    const card = cards.find(c => c.id === id);
    if (card) {
      search.value = ''; category.value = ''; filter();
      card.querySelector('details').open = true;
      card.scrollIntoView({block:'start'});
    }
  }
  document.querySelector('.library-controls').hidden = false;
  window.addEventListener('hashchange', openLinkedGuide);
  openLinkedGuide();
})();

