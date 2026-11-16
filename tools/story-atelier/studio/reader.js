function previewFor(project) {
  if (readerSession?.project !== project) {
    const engine = createStoryEngine(project);
    readerSession = { project, engine, run: engine.session() };
  }
  return readerSession;
}

function readerView() {
  const project = readerProject();
  if (!project) return '<div class="empty">请先创建一个剧情集。</div>';
  const { engine, run } = previewFor(project);
  const { step, history } = run;
  const chapter = project.chapters[step.index];
  const routes = engine.options(step);
  const books = [...state.projects, ...state.publications].map(item =>
    `<option value="${esc(item.id)}" ${project.id === item.id ? 'selected' : ''}>${esc(item.title)}${item.snapshot ? ' · 发布版' : ''}</option>`
  ).join('');
  const themes = [['light', '明亮'], ['paper', '纸张'], ['dark', '夜间']];
  const modes = [['novel', '小说阅读'], ['dialogue', '剧本试读']];
  function selectOptions(items, value) {
    return items.map(([key, name]) => `<option value="${key}" ${key === value ? 'selected' : ''}>${name}</option>`).join('');
  }
  const inventory = project.clues?.length
    ? `<div class="reader-clues"><strong>持有线索</strong><span>${esc(step.clues.map(engine.nameOf).join('、') || '无')}</span></div>`
    : '';
  const choices = routes.map((route, index) => {
    const extra = `data-index="${index}"${route.next ? '' : ' disabled'}`;
    const label = route.reason ? `${esc(route.label)} <small>${esc(route.reason)}</small>` : `${esc(route.label || '未命名选项')} →`;
    return button(label, 'reader-choice', 'choice', extra);
  }).join('');
  const ending = project.type === '分支互动剧情' ? '— 这个故事，在此停留 —' : '— 全文完 —';
  const path = [...history, step].map(s => esc(project.chapters[s.index]?.title || '')).join(' → ');
  return `<div class="between heading"><div><h1>阅读模拟器</h1></div>
    <div class="actions">${!project.snapshot ? button('编辑此稿', 'edit-project', '', `data-id="${esc(project.id)}"`) : ''}
    ${button('从头试读', 'restart-reader')}</div></div>
    <div class="reader-toolbar"><select id="reader-project" aria-label="选择剧情集">${books}</select>
      <select id="reader-theme" aria-label="阅读主题">${selectOptions(themes, readerTheme)}</select>
      <select id="reader-mode" aria-label="模拟器模式">${selectOptions(modes, readerMode)}</select>
      ${button('A−', 'font-minus', 'small')}${button('A＋', 'font-plus', 'small')}
      <span class="tiny muted">${readerFont}px · ${chapter ? step.index + 1 : 0} / ${project.chapters.length} 节点</span>
    </div>
    <div class="reader ${readerTheme} ${readerMode}" style="--readsize:${readerFont}px">
      <div class="between tiny muted"><span>${esc(project.title)}</span><span>${esc(project.styles.join(' / '))}</span></div>
      ${chapter ? `<h1>${esc(chapter.title)}</h1><article>${esc(chapter.text || '本章尚无正文。')}</article>
        <div class="subtle-rule"></div>${inventory}
        ${routes.length ? choices : `<p class="reader-end">${ending}</p>`}
        ${routes.length && routes.every(route => !route.next) ? '<p class="notice">当前没有可走的选项。可以返回上一步，或在编辑器检查条件。</p>' : ''}`
    : '<div class="empty">暂无章节。</div>'}
      <div class="between mt">${button('← 返回上一节点', 'reader-back', 'small ghost', history.length ? '' : 'disabled')}
      ${button('重新开始', 'restart-reader', 'small ghost')}</div>
    </div><div class="path"><span>本次阅读路径</span> ${path}</div>`;
}

function previewAction(action, element) {
  const project = readerProject();
  if (!project) return;
  const { run } = previewFor(project);
  if (action === 'reader-choice' && !run.choose(Number(element.dataset.index))) return;
  if (action === 'reader-back') run.back();
  if (action === 'restart-reader') run.restart();
  render();
  window.scrollTo(0, 0);
}

function mountStoryReader(book, engine) {
  const byId = id => document.getElementById(id);
  const run = engine.session();
  function render() {
    const { step, history } = run;
    const chapter = book.chapters[step.index];
    byId('book').textContent = book.title;
    byId('title').textContent = chapter?.title || '暂无章节';
    byId('text').textContent = chapter?.text || '';
    byId('progress').textContent = `节点 ${chapter ? step.index + 1 : 0} / ${book.chapters.length}`;
    const inventory = byId('inventory');
    inventory.hidden = !book.clues.length;
    inventory.textContent = `持有线索　${step.clues.map(engine.nameOf).join('、') || '无'}`;
    const box = byId('choices');
    box.replaceChildren();
    const options = engine.options(step);
    for (const [index, route] of options.entries()) {
      const button = document.createElement('button');
      button.textContent = route.reason ? `${route.label}　${route.reason}` : `${route.label} →`;
      button.disabled = !route.next;
      button.onclick = () => { if (run.choose(index)) refresh(); };
      box.append(button);
    }
    if (!options.length || options.every(route => !route.next)) {
      const message = document.createElement('p');
      message.textContent = options.length ? '当前没有可走的选项，可以返回上一节点。' : '— 全文完 —';
      box.append(message);
    }
    byId('back').disabled = !history.length;
  }
  function refresh() {
    render();
    window.scrollTo(0, 0);
  }
  byId('back').onclick = () => { if (run.back()) refresh(); };
  byId('restart').onclick = () => { run.restart(); refresh(); };
  byId('theme').onclick = () => document.body.classList.toggle('dark');
  render();
}

function readerHTML(project) {
  const data = JSON.stringify({
    title: project.title, type: project.type,
    clues: (project.clues || []).map(({ id, name, initial }) => ({ id, name, initial })),
    chapters: project.chapters.map(({ id, title, text, choices }) => ({ id, title, text, choices }))
  }).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)} · 阅读版</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f0e7;color:#324337;font:17px/2 'Songti SC',SimSun,serif}
main{max-width:720px;margin:25px auto;background:#fffcf2;padding:36px 45px;border:1px solid #ddd9c9}
header,footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font:14px/1.5 sans-serif}
h1{text-align:center;font-size:28px;font-weight:400;margin:40px 0}article{white-space:pre-wrap;overflow-wrap:anywhere}
button{font:14px/1.5 sans-serif;padding:12px 15px;background:transparent;border:1px solid #a2ae98;color:inherit;border-radius:5px;cursor:pointer}
button:disabled{opacity:.64;cursor:default}button:focus-visible{outline:3px solid #9e7937;outline-offset:3px}
#choices button{display:block;width:100%;text-align:left;margin-top:10px}#choices p{text-align:center}
#inventory{font:14px/1.6 sans-serif;border-left:3px solid #7d936e;margin:26px 0 16px;padding:6px 12px;overflow-wrap:anywhere}
footer{margin-top:35px;padding-top:20px;border-top:1px solid #ddd9c9}body.dark{background:#222d29;color:#dce1d6}
body.dark main{background:#28372e;border-color:#53624b}@media(max-width:600px){main{margin:0;padding:24px 20px}}
</style></head><body><main><header><span id="book"></span><button id="theme">切换明暗</button></header>
<h1 id="title"></h1><article id="text"></article><p id="inventory" hidden></p><div id="choices"></div>
<footer><button id="back">返回</button><button id="restart">重新开始</button><small id="progress"></small></footer></main>
<script>const book=${data};(${mountStoryReader.toString()})(book,(${createStoryEngine.toString()})(book));<\/script></body></html>`;
}
