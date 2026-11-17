import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const files = ['knowledge.js','branches.js','clue-editor.js','reader.js','writing.js','writing-editor.js','app.js'];
const source = files.map(file => readFileSync(new URL('../studio/' + file, import.meta.url),'utf8')).join('\n').replace(/\ninit\(\);\s*$/, '');
const example = JSON.parse(readFileSync(new URL('../examples/story/Clue_Counter.json',import.meta.url),'utf8'));

function workspace(text = '', idea = '') {
  const ctx = vm.createContext({text,idea,CLUE_EXAMPLE:structuredClone(example),crypto:webcrypto,URL,AbortController,console,
    document:{addEventListener(){},querySelector(){return null;}},window:{addEventListener(){},scrollTo(){}},setTimeout(){},clearTimeout(){}});
  const run = code => vm.runInContext(code,ctx);
  run(source);
  run(`state=seed(); render=()=>{}; toast=message=>{globalThis.notice=message;}; save=()=>{}; persistNow=async()=>true;
    const project=emptyProject();const chapter={id:uid(),title:'第一章',text,outline:'',memory:'',choices:[]};
    project.idea=idea;project.chapters=[chapter];state.projects=[project];state.active=project.id;chapterId=chapter.id;`);
  return {ctx,run,json:code=>JSON.parse(run('JSON.stringify('+code+')'))};
}

test("一句创意写成正文，预览及导入往返时仍保留原始创意", async () => {
  const idea = '顾禾收到一张从明天寄来的明信片。';
  const b = workspace('',idea);
  await b.run('generateWriting(project,chapter)');
  assert.equal(b.run('chapter.text'),'');
  const draft = b.json('chapter.writingDraft');
  assert.match(draft.text,/顾禾/); assert.match(draft.text,/明天/); assert.match(draft.text,/明信片/);
  assert.ok(draft.text.length > 70); assert.ok(!draft.text.includes(idea)); assert.equal(draft.label,'离线规则草稿');
  assert.deepEqual(b.json('normalizeProject(project).chapters[0].writingDraft'),draft);
  await b.run('acceptWriting(project,chapter)');
  assert.equal(b.run('chapter.text'),draft.text); assert.equal(b.run('project.idea'),idea);
});

test("两种题材和同题材的两次情节变化会改变正文", async () => {
  const generate = async text => { const b = workspace(text); await b.run('generateWriting(project,chapter)'); return b.run('chapter.writingDraft.text'); };
  const signal = await generate('纪遥把接收器贴上舱壁。耳机里传来的，是自己三分钟前还没说出口的呼号。');
  const bread = await generate('小满把昨天卖掉的面包捡起来。它每天黎明都会回到烤炉。');
  assert.match(signal,/纪遥/);assert.match(signal,/呼号/);assert.doesNotMatch(signal,/面包|炉门/);
  assert.match(bread,/小满/);assert.match(bread,/黎明/);assert.match(bread,/零钱/);assert.doesNotMatch(bread,/呼号|话筒/);
  const future = await generate('顾禾收到一张明信片。邮戳上的日期是明天。');
  const moved = await generate('顾禾收到一张明信片。收件人早已搬走。');
  assert.match(future,/戳记盒/);assert.match(moved,/旧门牌/);assert.doesNotMatch(moved,/戳记盒/);
});

test("人称、问句和陌生物件可以来自手稿，换走向保留原文", async () => {
  const b = workspace(' 我把一把生锈的铜钥匙放在井沿。井底的孩子问：“你也把名字丢了吗？”\n');
  await b.run('generateWriting(project,chapter)');
  const first = b.run('chapter.writingDraft.text');
  assert.match(first,/我/);assert.match(first,/名字/);assert.match(first,/钥匙/);
  b.run("state.settings.writerDirection='用对话推进'");
  await b.run('generateWriting(project,chapter)');
  assert.notEqual(b.run('chapter.writingDraft.text'),first);assert.equal(b.run('chapter.text'),b.ctx.text);
  assert.equal(b.run('chapter.writingDraft.direction'),'用对话推进');
});

test("接入保留原稿及分支，候选改字后只追加一次，保留作者事实记录", async () => {
  const b = workspace('  纪遥把终端推回原位。\n');
  b.run("chapter.choices=[{label:'等候',target:'end',condition:{clueId:'ink',has:true}}];chapter.memory='旧摘要';chapter.generated={complete:true};");
  const choices=b.json('chapter.choices');
  await b.run('generateWriting(project,chapter)');
  b.run("chapter.writingDraft.text='我自己修改的下一句。'");
  await b.run('acceptWriting(project,chapter)');await b.run('acceptWriting(project,chapter)');
  assert.equal(b.run('chapter.text'),b.ctx.text+'\n我自己修改的下一句。');
  assert.equal(b.run('chapter.memory'),'旧摘要');assert.equal(b.run('chapter.generated'),null);assert.deepEqual(b.json('chapter.choices'),choices);
  assert.match(b.run('md(project)'),/我自己修改的下一句/);assert.equal(b.run('Boolean(chapter.writingDraft)'),false);
});

test("手稿被编辑后，旧候选保留供复制且不能误接；重写后可接入", async () => {
  const b=workspace('林遥把怀表放到桌上。');
  await b.run('generateWriting(project,chapter)');
  const old=b.run('chapter.writingDraft.text');
  b.run("chapter.text='纪遥打开电台，听到了陌生的呼号。'");
  await b.run('acceptWriting(project,chapter)');
  assert.equal(b.run('chapter.writingDraft.text'),old);assert.equal(b.run('chapter.text'),'纪遥打开电台，听到了陌生的呼号。');
  assert.match(b.run('notice'),/原稿已修改/);
  await b.run('generateWriting(project,chapter)');assert.match(b.run('chapter.writingDraft.text'),/纪遥/);
  await b.run('acceptWriting(project,chapter)');assert.equal(b.run('Boolean(chapter.writingDraft)'),false);
});

test("从未填写大纲的手稿可再续写，第二段不会重放第一段", async () => {
  const b=workspace('纪遥在空间站听见了一次来自电台的呼号。');
  await b.run('generateWriting(project,chapter)');const first=b.run('chapter.writingDraft.text');
  await b.run('acceptWriting(project,chapter)');await b.run('generateWriting(project,chapter)');
  const second=b.run('chapter.writingDraft.text');
  assert.notEqual(first,second);for(const p of first.split('\n\n')) assert.ok(!second.includes(p));
});

test("编辑已有候选、取消未完成请求和迟到的模型响应不会覆盖手稿", async () => {
  const b=workspace('原稿。');
  b.run("let resolveFirst;writeWithEngine=()=>new Promise(r=>{resolveFirst=r});");
  const late=b.run('generateWriting(project,chapter)');
  b.run("writingAction('cancel-writing',project,chapter)");
  b.run("writeWithEngine=async()=>({text:'新的发展。',label:'测试模型'})");
  await b.run('generateWriting(project,chapter)');
  b.run("resolveFirst({text:'迟到的结果。',label:'旧模型'})");await late;
  assert.equal(b.run('chapter.writingDraft.text'),'新的发展。');assert.equal(b.run('chapter.text'),'原稿。');
  b.run("writeWithEngine=async()=>{throw Error('模型未启动')}");
  await b.run('generateWriting(project,chapter)');
  assert.equal(b.run('chapter.writingDraft.text'),'新的发展。');assert.match(b.run('writingErrors.get(chapter)'),/未启动/);
});

test("模型响应期间切换作品，不会改动新作品或把结果移到别的章节", async () => {
  const b=workspace('第一本的手稿。');
  b.run("let finish;writeWithEngine=()=>new Promise(r=>{finish=r});");
  const pending=b.run('generateWriting(project,chapter)');
  b.run("const other=normalizeProject(project);other.id='other';state.projects.push(other);state.active='other';chapter.text='已经手工改过。';finish({text:'来自老稿的候选。',label:'模型'})");
  await pending;
  assert.equal(b.run('Boolean(other.chapters[0].writingDraft)'),false);
  assert.equal(b.run('chapter.text'),'已经手工改过。');
  assert.notEqual(b.run('chapter.writingDraft.base'),b.run('writingBase(project,chapter)'));
});

test("上下文只带绑定的素材与共同来路，使用原稿检索资料", () => {
  const b=workspace();
  b.run(`const p=clone(CLUE_EXAMPLE), c=p.chapters[2];
    p.characters=['c'];p.scenes=['s'];p.knowledge=['k'];
    state.characters=[{id:'c',name:'沈月'},{id:'no',name:'隐藏角色'}];
    state.scenes=[{id:'s',name:'窗口'}];state.knowledge=[{id:'k',title:'铜钉',content:'铜钉排列成一行。',category:'材料'},{id:'no',title:'暗稿',content:'私人资料'}];
    c.text='铜钉落在柜台边。';p.chapters[1].memory='只走侧路才会见到的房间';`);
  const x=b.json("writingInput(p,c,'加入转折')");
  assert.match(x.manuscript,/铜钉/);assert.equal(x.direction,'加入转折');assert.deepEqual(x.characters,[{name:'沈月'}]);
  assert.equal(x.scenes[0].name,'窗口');assert.equal(x.sources[0].title,'铜钉');
  assert.doesNotMatch(JSON.stringify(x),/隐藏角色|只走侧路才会见到的房间|私人资料/);assert.ok(x.exits.some(q=>q.condition));
});

test("循环分支可仅根据当前章续写，未知来路不会混入", () => {
  const b=workspace('当前章的原文。');
  b.run(`project.type='分支互动剧情';project.chapters.push({id:'loop',title:'另一条路',text:'不能假定发生过的事',memory:'别的结局',outline:'',choices:[{label:'回来',target:chapter.id}]});
    chapter.choices=[{label:'去另一章',target:'loop'}];`);
  const input=b.json("writingInput(project,chapter,'顺势推进')");
  assert.equal(input.previousTail,'');assert.deepEqual(input.commonPast,[]);assert.match(input.branchGuidance,/循环/);assert.doesNotMatch(JSON.stringify(input),/不能假定发生过的事/);
});

test("只有原稿、设定或来路时才生成，截取长文保留开头和末尾", async () => {
  const b=workspace();
  await b.run('generateWriting(project,chapter)');assert.equal(b.run('Boolean(chapter.writingDraft)'),false);assert.match(b.run('writingErrors.get(chapter)'),/写入/);
  b.run("chapter.text='开头很重要。'+'中'.repeat(14000)+'最后落在红色台阶上。';");
  const input=b.json("writingInput(project,chapter,'顺势推进')");
  assert.ok(input.manuscript.startsWith('开头很重要'));assert.ok(input.manuscript.endsWith('红色台阶上。'));assert.ok(input.manuscript.length < 8300);
});

test("模型的重复前缀会去掉，纯复述和空输出会报错", () => {
  const b=workspace();
  assert.equal(b.run("cleanNewProse('第一行。\\n\\n旧的最后一句。\\n\\n新的动作。','第一行。\\n\\n旧的最后一句。')"),'新的动作。');
  assert.equal(b.run("cleanNewProse('旧的最后一句。新的动作。','第一行。旧的最后一句。')"),'新的动作。');
  assert.throws(()=>b.run("cleanNewProse('原文。','原文。')"));assert.throws(()=>b.run("cleanNewProse('','开头')"));
});

test("已配置服务复用现有章节接口，把原稿结尾和创作方向送入同一次请求", async () => {
  const b=workspace('顾禾把信纸压在桌面上，等邮差回来。','一封退信');
  b.run("apiReady=true;state.settings.writerEngine='service';state.settings.writerDirection='加入转折';let sent;api=async(task,data,model)=>{sent={task,data,model};return{text:'邮差回来时，手上多了一封信。'}}");
  await b.run('generateWriting(project,chapter)');
  const sent=b.json('sent');assert.equal(sent.task,'chapter');assert.equal(sent.data.chapter.existing,b.ctx.text);assert.equal(sent.data.chapter.direction,'加入转折');
  assert.equal(sent.data.context.idea,'一封退信');assert.match(b.run('chapter.writingDraft.label'),/OpenAI/);
});

test("选择本机模型会把真实输入提交给本机接口，服务失败不会伪装成模型输出", async () => {
  const b=workspace('林遥翻开旧名册。');
  b.run("writerModels=['story:test'];let sent;fetch=async(url,req)=>{sent={url,body:JSON.parse(req.body)};return {ok:true,json:async()=>({text:'墨水还没有干。'})}}");
  await b.run('generateWriting(project,chapter)');
  assert.equal(b.run('sent.url'),'/api/atelier/draft');assert.equal(b.run('sent.body.input.manuscript'),b.ctx.text);assert.equal(b.run('chapter.writingDraft.label'),'本机模型 · story:test');
  b.run("fetch=async()=>({ok:false,json:async()=>({error:'模型离线'})})");
  await b.run('generateWriting(project,chapter)');assert.equal(b.run('chapter.writingDraft.text'),'墨水还没有干。');assert.equal(b.run('writingErrors.get(chapter)'),'模型离线');
});

test("残缺候选不会破坏旧版项目，发布快照仅包含已接入的正文", async () => {
  const b=workspace('可发布的正文。');
  b.run('chapter.writingDraft={text:42};');
  assert.equal(b.run('Boolean(normalizeProject(project).chapters[0].writingDraft)'),false);
  b.run("delete chapter.writingDraft;closeModal=()=>{};go=()=>{};");
  await b.run('generateWriting(project,chapter)');
  await b.run("dispatch('confirm-publish',{dataset:{}})");
  assert.equal(b.run('state.publications[0].chapters[0].text'),'可发布的正文。');assert.equal(b.run('Boolean(state.publications[0].chapters[0].writingDraft)'),false);
  assert.ok(b.run('Boolean(chapter.writingDraft)'));
});

test('已绑定人物设定变化后，旧候选需按新设定重新生成', async () => {
  const b=workspace('顾禾把明信片交到窗口。');
  b.run("project.characters=['c'];state.characters=[{id:'c',name:'顾禾',desire:'找回信件'}];");
  await b.run('generateWriting(project,chapter)');
  b.run("state.characters[0].desire='离开邮局';");
  await b.run('acceptWriting(project,chapter)');
  assert.equal(b.run('chapter.text'),b.ctx.text);assert.match(b.run('notice'),/设定已有变化/);
  await b.run('generateWriting(project,chapter)');await b.run('acceptWriting(project,chapter)');
  assert.ok(b.run('chapter.text').length>b.ctx.text.length);
});


test('按修改过的原稿重写时清除旧候选上下文，允许重新采纳相同措辞',async () => {
  const b=workspace('顾禾握着信封。');
  b.run("let previousSent=[];writeWithEngine=async(engine,input,previous)=>{previousSent.push(previous);return{text:'门被敲响了。',label:'模型'}}");
  await b.run('generateWriting(project,chapter)');
  b.run("chapter.text+='\u3000';");
  await b.run('generateWriting(project,chapter)');
  assert.deepEqual(b.json('previousSent'),['','']);
  await b.run('acceptWriting(project,chapter)');
  assert.match(b.run('chapter.text'),/门被敲响了。$/);
});
