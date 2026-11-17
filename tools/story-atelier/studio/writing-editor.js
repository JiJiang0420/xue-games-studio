const WRITING_DIRECTIONS = ['顺势推进', '用对话推进', '加入转折'];
const WRITING_ACTIONS = new Set(['spark-story','continue-story','generate-writing','accept-writing','detect-writer','cancel-writing','discard-writing']);
const writingJobs = new WeakMap();
const writingErrors = new WeakMap();
let writerModels = [], writerBridge = false, writerModelMessage = '';
let preferOpenAI = false, sawOpenAIConfig = false, openAIProbe = null;

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
  if (state.settings.writerEngine) return state.settings.writerEngine;
  if (preferOpenAI && apiReady) return 'service';
  return writerModels[0] ? 'local:' + writerModels[0] : 'rules';
}

function writerEngineOptions() {
  const selected = writerEngine();
  const choices = writerModels.map(model => ['local:' + model, '本机模型 · ' + model]);
  choices.push(['rules','离线规则草稿']);
  if (apiReady || selected === 'service') choices.push(['service', 'OpenAI · ' + (state.settings.model || 'gpt-5.4-mini')]);
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
  return '离线规则按原文中的人物、物件和场景组句。' + (writerBridge ? writerModelMessage : '使用 OpenAI 或 Ollama 时请打开本机启动器。');
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
    return {text:out.text,label:'OpenAI · ' + (out.model || state.settings.model)};
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

function applyOpenAIConfiguration(config) {
  apiReady = config?.configured === true;
  preferOpenAI = apiReady && config.preferredWriter === 'service';
  sawOpenAIConfig = true;
  refreshWriterControls();
  refreshOpenAITest();
}

async function readOpenAIConfiguration() {
  if (location.protocol === 'file:') { applyOpenAIConfiguration(null); return; }
  try {
    const response = await fetch('/api/agent',{cache:'no-store',signal:AbortSignal.timeout(6000)});
    applyOpenAIConfiguration(response.ok ? await response.json() : null);
  } catch { applyOpenAIConfiguration(null); }
}

function openAIConnectionLabel() {
  if (apiReady) return '已读取密钥';
  return sawOpenAIConfig ? '未读取到密钥' : '尚未检查';
}

function openAITestBox() {
  const test = openAIProbe;
  const label = test?.running ? '正在请求 OpenAI…' : '用示例实测 OpenAI';
  const billingLink = test?.code === 'credit_balance_exhausted' ? '<a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer">打开 OpenAI 账单页</a>' : '';
  const result = test?.error ? `<p class="notice" role="alert">${esc(test.error)} ${billingLink}</p>` :
    test?.text ? `<p class="tiny muted">已收到 ${esc(test.model)} 的续写</p><p class="content-note">${esc(test.text)}</p>` : '';
  return `<div id="openai-test" class="mt"><div class="actions">${button(label,'test-openai','soft',test?.running ? 'disabled' : '')}
    ${button('重读配置','check-api','ghost')}</div><p class="tiny muted mt">实测会发送一段内置明信片故事，使用一次所选模型。</p>
    <div aria-live="polite">${result}</div></div>`;
}

function refreshOpenAITest() {
  if (view !== 'settings') return;
  const box = $('#openai-test'), indicator = $('#connection-state');
  if (box) box.outerHTML = openAITestBox();
  if (indicator) indicator.textContent = openAIConnectionLabel();
}

async function testOpenAI() {
  if (openAIProbe?.running) return;
  const model = state.settings.model || 'gpt-5.4-mini';
  const test = {model,running:true,text:'',error:''};
  openAIProbe = test;
  refreshOpenAITest();
  try {
    await readOpenAIConfiguration();
    if (!apiReady) throw Error(location.protocol === 'file:' ? '请从本机启动器打开工作台，再试写 OpenAI。' : '启动器尚未读取到 OPENAI_API_KEY。请检查本地配置后重新启动。');
    const original = '顾禾把明信片翻过来。邮戳是明天的日期，收件栏里却是她刚刚想好的新名字。';
    const output = await api('chapter',{
      context:{mode:'续写正文',title:'明日来信',pov:'原稿人称',idea:'',type:'线性小说'},
      chapter:{title:'第一章',existing:original,segmentTarget:200,isFinal:false,direction:'顺势推进',memory:''}
    },model);
    test.text = cleanNewProse(output.text, original);
    test.model = output.model || model;
  } catch (err) { test.error = err.message || '本次实测未收到模型正文。'; test.code = err.code; }
  finally { test.running = false; refreshOpenAITest(); }
}
