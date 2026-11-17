const WRITING_DIRECTIONS = ['顺势推进', '用对话推进', '加入转折'];
const WRITING_ACTIONS = new Set(['spark-story','continue-story','generate-writing','accept-writing','detect-writer','cancel-writing','discard-writing']);
const writingJobs = new WeakMap();
const writingErrors = new WeakMap();
let writerModels = [], writerBridge = false, writerModelMessage = '';

function writingBase(project, chapter) {
  return writingStamp(JSON.stringify([chapter.text, project.idea, chapter.outline]));
}

function writingContextStamp(input) {
  const settings = {...input};
  for (const key of ['manuscript','direction','title']) delete settings[key];
  return writingStamp(JSON.stringify(settings));
}

function matchesWritingSource(project, chapter, draft) {
  if (draft.base !== writingBase(project, chapter)) return false;
  if (!draft.contextStamp) return true;
  return draft.contextStamp === writingContextStamp(writingInput(project,chapter,draft.direction));
}

function savedProposal(raw) {
  if (!raw || typeof raw.text !== 'string' || typeof raw.base !== 'string' || !/^\d+\.\d+$/.test(raw.base)) return null;
  return {base:raw.base, ...(typeof raw.contextStamp === 'string' ? {contextStamp:raw.contextStamp.slice(0,40)} : {}), text:raw.text.slice(0, 20000), label:String(raw.label || '候选段落').slice(0,180), direction:String(raw.direction || '').slice(0,24),
    variant:Math.max(0,Math.min(10000,Number(raw.variant) || 0))};
}

function cleanNewProse(text, source) {
  if (typeof text !== 'string') throw Error('本次创作没有返回正文。');
  let result = text.trim();
  const before = source.trim();
  if (before && result.startsWith(before)) result = result.slice(before.length).trimStart();
  if (before.endsWith(result)) throw Error('本次创作只复述了原稿，请换一种写法。');
  const end = before.slice(-8000);
  let size = Math.min(end.length, result.length);
  for (; size >= 5; size--) {
    if (end.endsWith(result.slice(0,size))) {
      result = result.slice(size).trimStart();
      break;
    }
  }
  if (!result || result.length > 20000) throw Error('候选段落为空或过长，请重试。');
  return result;
}

function writerEngine() {
  return state.settings.writerEngine || (writerModels[0] ? 'local:' + writerModels[0] : 'rules');
}

function writerEngineOptions() {
  const selected = writerEngine();
  const choices = writerModels.map(model => ['local:' + model, '本机模型 · ' + model]);
  choices.push(['rules','离线规则草稿']);
  if (apiReady || selected === 'service') choices.push(['service', '项目已配置的 OpenAI 服务']);
  if (!choices.some(([value]) => value === selected)) choices.push([selected, '上次选择的模型（未连接）']);
  return choices.map(([value,label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

function writerControls() {
  return `<div class="writing-controls">
    <label>创作方式<select id="writer-engine">${writerEngineOptions()}</select></label>
    <label>段落走向<select id="writer-direction">${WRITING_DIRECTIONS.map(d => option(d,state.settings.writerDirection || WRITING_DIRECTIONS[0])).join('')}</select></label>
    </div><p id="writer-note" class="tiny muted writing-note">${esc(writerNote())}</p>`;
}

function writerNote() {
  const engine = writerEngine();
  if (engine === 'service') return '本段原稿及绑定设定会发送到项目的 OpenAI 服务。';
  if (engine.startsWith('local:')) return '原稿和设定交给这台电脑上选定的 Ollama 模型。';
  return '离线规则按原文中的人物、物件和场景组句。' + (writerBridge ? writerModelMessage : '使用本机大模型可运行离线包里的 local-writer.mjs。');
}

async function detectWriterModels() {
  if (!['127.0.0.1','localhost'].includes(location.hostname) || !['http:','https:'].includes(location.protocol)) return;
  try {
    const resp = await fetch('/api/atelier/models',{signal:AbortSignal.timeout(5000)});
    if (!resp.ok) return;
    const data = await resp.json();
    if (!Array.isArray(data.models)) return;
    writerBridge = true;
    writerModels = data.models.filter(name => typeof name === 'string');
    writerModelMessage = typeof data.message === 'string' ? data.message : '';
    refreshWriterControls();
  } catch { /* A standalone file or an ordinary static server has no local model service. */ }
}

function refreshWriterControls() {
  const select = $('#writer-engine');
  if (select) select.innerHTML = writerEngineOptions();
  const note = $('#writer-note');
  if (note) note.textContent = writerNote();
  const refresh = $('#writer-detect');
  if (refresh) refresh.hidden = !writerBridge;
}

function storyStartBox() {
  return `<div class="writing-start">
    <h2><label for="writing-seed">从你写的这句开始</label></h2>
    <textarea id="writing-seed" rows="3" maxlength="24000" required placeholder="写一句创意，或贴上你想接着写的原文。"></textarea>
    ${writerControls()}
    <div class="actions">${button('写成开头','spark-story','primary')}${button('接着原文写','continue-story','soft')}${button('试读《失物招领处》','clue-demo','ghost')}</div>
  </div>`;
}

function beginWritingStory(kind) {
  if (activeRun) return toast('请先停止当前的逐章生成任务。');
  const field = $('#writing-seed');
  if (!field) return;
  const source = field.value;
  if (!source.trim()) { field.focus(); return toast('先写下一句创意，或贴上一段原文。'); }
  const project = emptyProject();
  project.title = Array.from(source.trim().split(/[\n。！？；，]/u).find(s => s.trim()) || '新故事').slice(0,18).join('');
  project.idea = kind === 'idea' ? source : '';
  project.chapterCount = 1;
  project.styles = [];
  project.tags = [];
  project.pov = '沿用原稿人称';
  project.tone = '沿用原稿语气';
  const chapter = {id:uid(),title:'第一章',text:kind === 'text' ? source : '',outline:'',memory:'',choices:[]};
  project.chapters = [chapter];
  state.projects.unshift(project);
  state.active = project.id;
  chapterId = chapter.id;
  save();
  go('editor');
  $('#chapter-writing')?.scrollIntoView?.({block:'start'});
  return generateWriting(project, chapter);
}

function writingPanel(project, chapter) {
  const draft = chapter.writingDraft;
  const running = writingJobs.has(chapter);
  const error = writingErrors.get(chapter) || '';
  const stale = draft && !matchesWritingSource(project,chapter,draft);
  const blocked = activeRun || running;
  return `<section id="chapter-writing" class="chapter-writing" aria-label="根据内容创作">
    <div class="between"><h3>${chapter.text.trim() ? '接着正文写' : '从设定写开头'}</h3>
      <button type="button" class="small ghost" id="writer-detect" data-action="detect-writer"${writerBridge ? '' : ' hidden'}>重新检测模型</button></div>
    ${writerControls()}
    <div class="actions">${button(draft ? '换一种写法' : '写下一段','generate-writing',draft ? 'soft' : 'primary',blocked ? 'disabled' : '')}
      ${running ? button('取消本次生成','cancel-writing','ghost') : ''}</div>
    <p class="${error ? 'danger-note' : 'tiny muted'} writing-status" role="status" aria-live="polite">${esc(error || (running ? '正在根据原文创作…' : ''))}</p>
    ${draft ? `<div class="writing-preview"><label for="writing-candidate">候选段落 <span class="tiny muted">${esc(draft.label)}</span></label>
      <textarea id="writing-candidate" rows="6" maxlength="20000"${running ? ' readonly' : ''}>${esc(draft.text)}</textarea>
      <p id="writing-stale" class="danger-note"${stale ? '' : ' hidden'}>原稿或设定已修改。可复制这段文字，或按新内容重新生成。</p>
      <div class="actions">${button('接入正文','accept-writing','primary',stale || blocked || !draft.text.trim() ? 'disabled' : '')}${button('舍弃候选','discard-writing','ghost',blocked ? 'disabled' : '')}</div></div>` : ''}
  </section>`;
}

function repaintWriting(project, chapter) {
  if (view !== 'editor' || current() !== project || chapterId !== chapter.id) return;
  const panel = $('#chapter-writing');
  if (panel) panel.outerHTML = writingPanel(project, chapter);
}

function refreshWritingGuard(project, chapter) {
  const draft = chapter.writingDraft;
  const panel = $('#chapter-writing');
  if (!panel) return;
  const heading = panel.querySelector('h3');
  heading.textContent = chapter.text.trim() ? '接着正文写' : '从设定写开头';
  if (!draft) return;
  const stale = !matchesWritingSource(project,chapter,draft);
  panel.querySelector('#writing-stale').hidden = !stale;
  panel.querySelector('[data-action="accept-writing"]').disabled = stale || activeRun || writingJobs.has(chapter) || !draft.text.trim();
}

async function writeWithEngine(engine, input, previous, variant, signal) {
  if (engine === 'rules') return {text:offlineDraft(input,variant),label:'离线规则草稿'};
  if (engine === 'service') {
    if (!apiReady) throw Error('尚未连上项目的 OpenAI 服务。可切换创作方式，或在设置中检查连接。');
    const {manuscript, ...context} = input;
    const chapter = {title:input.chapter.title, outline:input.chapter.outline, existing:manuscript, memory:input.chapter.memory,
      segmentTarget:350, isFinal:false, direction:input.direction, previousDraft:previous.slice(-1600)};
    const out = await api('chapter',{context:{...context, pathFacts:input.commonPast},chapter},state.settings.model,signal);
    return {text:out.text,label:'OpenAI · ' + state.settings.model};
  }
  const model = engine.slice('local:'.length);
  if (!engine.startsWith('local:') || !writerModels.includes(model)) throw Error('所选模型未连接。请重新检测，或切换到离线规则草稿。');
  const response = await fetch('/api/atelier/draft',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model,input,previous:previous.slice(-1600)}),signal});
  const data = await response.json();
  if (!response.ok || data.error) throw Error(data.error || '本机模型响应失败，请重新检测。');
  return {text:data.text,label:'本机模型 · ' + model};
}

async function generateWriting(project, chapter) {
  if (!chapter || activeRun || writingJobs.has(chapter)) return;
  const job = new AbortController();
  writingJobs.set(chapter,job);
  writingErrors.delete(chapter);
  const old = chapter.writingDraft;
  const base = writingBase(project,chapter);
  const source = chapter.text.trim() ? chapter.text : project.idea;
  const direction = state.settings.writerDirection || WRITING_DIRECTIONS[0];
  repaintWriting(project,chapter);
  try {
    const input = writingInput(project,chapter,direction);
    const contextStamp = writingContextStamp(input);
    const sameSource = old && old.base === base && (!old.contextStamp || old.contextStamp === contextStamp);
    const variant = sameSource && old.direction === direction ? old.variant + 1 : 0;
    if (![input.manuscript,input.idea,input.chapter.outline,input.previousTail,input.world,...input.commonPast.map(c => c.facts)].some(s => s?.trim()) && !input.characters.length && !input.scenes.length) {
      throw Error('写入一句创意、正文或本章目标，就可以开始。');
    }
    const result = await writeWithEngine(writerEngine(),input,sameSource ? old.text : '',variant,job.signal);
    if (writingJobs.get(chapter) !== job || !state.projects.includes(project) || !project.chapters.includes(chapter)) return;
    const text = cleanNewProse(result.text,source);
    if (sameSource && text === old.text) throw Error('这次的写法与已有候选相同。已保留原候选，可换个走向再试。');
    chapter.writingDraft = {base,contextStamp,text,variant,direction,label:result.label};
    project.updated = Date.now();
    await persistNow();
  } catch (err) {
    if (writingJobs.get(chapter) === job) writingErrors.set(chapter,err.message || '本次创作未完成，请重试。');
  } finally {
    if (writingJobs.get(chapter) === job) { writingJobs.delete(chapter); repaintWriting(project,chapter); }
  }
}

async function acceptWriting(project, chapter) {
  const draft = chapter?.writingDraft;
  if (!draft || activeRun || writingJobs.has(chapter)) return;
  if (!matchesWritingSource(project,chapter,draft)) return toast('原稿已修改，或设定已有变化，请按新内容重新生成。');
  const added = draft.text.trim();
  if (!added) return toast('候选段落为空。');
  if (chapter.text.length + added.length + 2 > 300000) return toast('接入后会超过单章导入上限，请另起章节。');
  const gap = !chapter.text.trim() || chapter.text.endsWith('\n\n') ? '' : chapter.text.endsWith('\n') ? '\n' : '\n\n';
  chapter.text += gap + added;
  chapter.generated = null;
  delete chapter.writingDraft;
  project.updated = Date.now();
  writingErrors.delete(chapter);
  render();
  const ok = await persistNow();
  toast(ok ? '已接入正文。' : '已接入当前窗口，浏览器保存失败，请导出备份。');
}

function writingAction(action, project, chapter) {
  switch (action) {
    case 'spark-story': return beginWritingStory('idea');
    case 'continue-story': return beginWritingStory('text');
    case 'generate-writing': return generateWriting(project,chapter);
    case 'accept-writing': return acceptWriting(project,chapter);
    case 'detect-writer': return detectWriterModels().then(() => toast(writerModels.length ? `检测到 ${writerModels.length} 个本机模型。` : writerModelMessage || '请从本机启动器打开工作台。'));
    case 'cancel-writing': {
      writingJobs.get(chapter)?.abort();
      writingJobs.delete(chapter);
      writingErrors.delete(chapter);
      repaintWriting(project,chapter);
      break;
    }
    case 'discard-writing':
      if (!chapter || writingJobs.has(chapter) || activeRun) return;
      delete chapter.writingDraft;
      writingErrors.delete(chapter);
      repaintWriting(project,chapter);
      return persistNow();
  }
}

function writingChange(target) {
  if (target.id === 'writer-engine') {
    state.settings.writerEngine = target.value;
    refreshWriterControls();
    save();
  } else if (target.id === 'writer-direction') {
    state.settings.writerDirection = target.value;
    save();
  }
}

function editWritingCandidate(target) {
  if (target.id !== 'writing-candidate') return;
  const project = current();
  const chapter = project.chapters.find(c => c.id === chapterId);
  if (!chapter?.writingDraft) return;
  chapter.writingDraft.text = target.value;
  project.updated = Date.now();
  refreshWritingGuard(project,chapter);
  save();
}
