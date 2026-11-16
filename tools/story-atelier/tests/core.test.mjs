import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../studio/app.js',import.meta.url),'utf8').replace(/\ninit\(\);\s*$/,'');
const studio = ['knowledge.js', 'branches.js', 'clue-editor.js', 'reader.js']
  .map(name => readFileSync(new URL('../studio/' + name, import.meta.url), 'utf8')).join('\n');
const fixture = JSON.parse(readFileSync(new URL('../examples/story/Clue_Counter.json', import.meta.url), 'utf8'));
function boot(){const ctx=vm.createContext({CLUE_EXAMPLE:structuredClone(fixture),crypto:webcrypto,URL,console,document:{addEventListener(){},querySelector(){return null}},window:{addEventListener(){}},setTimeout(){},clearTimeout(){}});vm.runInContext(studio+'\n'+source+'\nstate=seed();render=()=>{};toast=()=>{};save=()=>{};persistNow=async()=>true;',ctx);return{ctx,run:s=>vm.runInContext(s,ctx),get:s=>JSON.parse(vm.runInContext('JSON.stringify('+s+')',ctx))};}
const diamond=`({type:'分支互动剧情',chapters:[{id:'r',title:'开头',text:'起点',memory:'开始',choices:[{label:'左',target:'a'},{label:'右',target:'b'}]},{id:'m',title:'汇合',text:'汇合',choices:[]},{id:'a',title:'左支',text:'失去钥匙',memory:'失去钥匙',choices:[{label:'前进',target:'m'}]},{id:'b',title:'右支',text:'保留钥匙',memory:'保留钥匙',choices:[{label:'前进',target:'m'}]}]})`;
test('内置示例可读、可发布且有两种结局',()=>{const b=boot();assert.deepEqual(b.get('validateGraph(state.projects[0])'),[]);assert.equal(b.run('state.projects[0].chapters.filter(c=>!c.choices.length).length'),2);assert.equal(b.run('state.knowledge.length'),18);});
test('汇合节点只使用共同前驱事实，拓扑顺序不依赖列表排列',()=>{const b=boot();b.run('var p='+diamond);assert.deepEqual(b.get("ancestors(p,'m').map(c=>c.id)"),['r']);assert.deepEqual(b.get('graphOrder(p).map(c=>c.id)'),['r','a','b','m']);assert.deepEqual(b.get("ancestors(p,'a').map(c=>c.id)"),['r']);});
test('分支环阻止自动生成，死路阻止发布',()=>{const b=boot();b.run('var p='+diamond+`;p.chapters.find(c=>c.id==='a').choices=[{label:'回头',target:'a'}]`);assert.throws(()=>b.run('graphOrder(p)'),/循环/);assert.ok(b.get('validateGraph(p)').some(x=>x.includes('无法抵达')));});
test('空章节、失效跳转和不可达节点会被检查',()=>{const b=boot();b.run('var p='+diamond+`;p.chapters[0].choices=[{label:'',target:'missing'}];p.chapters[0].text=''`);const errors=b.get('validateGraph(p)');for(const phrase of ['没有正文','空白选项','失效跳转','无法从开头到达'])assert.ok(errors.some(e=>e.includes(phrase)));assert.ok(b.get('validateGraph({chapters:[]})').length);});
test('只检索明确绑定的资料，并记录片段位置',()=>{const b=boot();b.run("state.knowledge=[{id:'yes',title:'钥匙线索',content:'钥匙代表人物的责任与选择。',category:'方法',source:'来源'},{id:'no',title:'钥匙线索',content:'绝不能发送的未绑定资料',category:'方法'}]");assert.deepEqual(b.get("retrieve({knowledge:['yes']},'钥匙线索').map(x=>x.id)"),['yes']);assert.deepEqual(b.get("retrieve({knowledge:[]},'钥匙线索')"),[]);});
test('HTML 导出转义脚本结束符及标题，不产生额外 script',()=>{const b=boot();b.run(`var p=emptyProject();p.title='<img src=x onerror=alert(1)>';p.chapters=[{id:'x',title:'标题',text:'</script><script>alert(1)</script>',choices:[]}]`);const html=b.run('readerHTML(p)');assert.equal((html.match(/<script>/g)||[]).length,1);assert.equal((html.match(/<\/script>/g)||[]).length,1);assert.ok(html.includes('&lt;img'));assert.ok(html.includes('\\u003c/script>'));new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);});
test('联网引用拒绝危险 URL 并转义标题',()=>{const b=boot();assert.equal(b.run("safeURL('javascript:alert(1)')"),false);const html=b.run(`citedText('事实 [ref] 后文',[{url:'https://example.com',title:'<img onerror=x>',start:3,end:8},{url:'javascript:alert(1)',title:'恶意',start:0,end:0}])`);assert.ok(html.includes('href="https://example.com"'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('<img'));});
test('备份合并不覆盖原稿并重映射角色绑定',()=>{const b=boot();b.run('var old=clone(state);mergeBackup(old)');assert.equal(b.run('state.projects.length'),2);assert.equal(b.run("state.projects[1].title"),'雨停之前');assert.notEqual(b.run('state.projects[0].id'),b.run('state.projects[1].id'));assert.notEqual(b.run('state.projects[0].characters[0]'),b.run('state.projects[1].characters[0]'));assert.ok(b.run('state.characters.some(c=>c.id===state.projects[0].characters[0])'));});
test('损坏发布快照会在导入前校验，避免半导入',()=>{const b=boot();assert.throws(()=>b.run('mergeBackup({projects:[state.projects[0]],publications:[{chapters:null}]})'));assert.equal(b.run('state.projects.length'),1);});
test('连续性上下文只发送绑定人物场景和共同前驱',()=>{const b=boot();b.run('var p={...emptyProject(),...'+diamond+`,characters:['char-lin'],scenes:[],knowledge:[]}`);const c=b.get("contextFor(p,p.chapters.find(c=>c.id==='m'))");assert.equal(c.characters.length,1);assert.equal(c.scenes.length,0);assert.deepEqual(c.pathFacts.map(x=>x.title),['开头']);assert.equal(c.previousTail,'');});
test('生成预算暂停并续写，不重复已完成章节',async()=>{const b=boot();b.run("state.projects=[{...emptyProject(),id:'test',target:1200,chapters:[{id:'a',title:'甲',text:'',outline:'目标甲',choices:[]},{id:'b',title:'乙',text:'',outline:'目标乙',choices:[]}]}];state.active='test';state.settings.budget=1;var calls=0;api=async()=>{calls++;return{text:'字'.repeat(600),memory:'事实'}};");await b.run("agent('write')");assert.equal(b.run('calls'),1);assert.equal(b.run('current().chapters[0].text.length'),600);assert.equal(b.run('current().chapters[1].text.length'),0);assert.ok(b.run('current().job.status').includes('请求数上限'));await b.run("agent('write')");assert.equal(b.run('calls'),2);assert.equal(b.run('current().chapters[0].text.length'),600);assert.equal(b.run('current().chapters[1].text.length'),600);});
test('手工正文不会被自动生成覆盖，保存失败立即停下',async()=>{const b=boot();b.run("state.projects=[{...emptyProject(),id:'test',target:1200,chapters:[{id:'a',title:'甲',text:'手写正文',outline:'目标甲',choices:[]},{id:'b',title:'乙',text:'',outline:'目标乙',choices:[]}]}];state.active='test';var calls=0;api=async()=>{calls++;return{text:'自动',memory:'事实'}};persistNow=async()=>false;");await b.run("agent('write')");assert.equal(b.run('calls'),0);assert.equal(b.run('current().chapters[0].text'),'手写正文');assert.ok(b.run('current().job.status').includes('本地保存不可用'));});

  test('同一窗口按路线解锁；交出、回退和重新开始都恢复对应线索', () => {
    const b = boot();
    b.run('const engine = createStoryEngine(CLUE_EXAMPLE); const run = engine.session();');
    assert.equal(b.run('run.choose(1)'), true);
    assert.equal(b.run('engine.options(run.step)[0].reason'), '需要持有「蓝色存根」');
    assert.equal(b.run('run.choose(0)'), false);
    assert.equal(b.run('run.history.length'), 1);
    b.run('run.back();run.choose(0);run.choose(0)');
    assert.deepEqual(b.get('run.step'), { index: 2, clues: ['claim-blue'] });
    b.run('run.choose(0)');
    assert.deepEqual(b.get('run.step'), { index: 3, clues: [] });
    b.run('run.back()');
    assert.deepEqual(b.get('run.step.clues'), ['claim-blue']);
    b.run('run.back()');
    assert.deepEqual(b.get('run.step.clues'), []);
    b.run('run.restart()');
    assert.equal(b.run('run.history.length'), 0);
    assert.equal(b.run('run.step.index'), 0);
  });
  test('初始线索、未持有条件与重复获取在每次阅读独立结算', () => {
    const b = boot();
    b.run(`const p=clone(CLUE_EXAMPLE);p.clues[0].initial=true;
      p.chapters[2].choices[1].condition={clueId:'claim-blue',has:false};
      const engine=createStoryEngine(p), one=engine.session(), two=engine.session();one.choose(0);one.choose(0);`);
    assert.deepEqual(b.get('one.step.clues'), ['claim-blue']);
    assert.equal(b.run('engine.options(one.step)[1].reason'), '需要尚未持有「蓝色存根」');
    b.run('one.choose(0)');
    assert.deepEqual(b.get('two.step'), { index: 0, clues: ['claim-blue'] });
    b.run('one.restart()');
    assert.deepEqual(b.get('one.step.clues'), ['claim-blue']);
  });
  test('发布检查基于可达状态而非只看章节；检查上限不会冒报不可达', () => {
    const b = boot();
    const full = b.get('inspectClueRoutes(CLUE_EXAMPLE)');
    assert.equal(full.states, 7);
    assert.equal(full.endings, 2);
    assert.deepEqual(full.errors, []);
    const partial = b.get('inspectClueRoutes(CLUE_EXAMPLE, 2)');
    assert.equal(partial.complete, false);
    assert.deepEqual(partial.errors, []);
    b.run("const p=clone(CLUE_EXAMPLE);p.chapters[2].choices[1].condition={clueId:'claim-blue',has:true}");
    assert.ok(b.get('validateGraph(p)').some(s => s.includes('隔着一扇窗') && s.includes('没有可用出口') && s.includes('无')));
    b.run('delete p.chapters[1].choices[0].effect');
    assert.ok(b.get('validateGraph(p)').some(s => s.includes('三下跺脚') && s.includes('无法到达')));
  });
  test('循环的某种持有状态无法脱出时，结构上存在结局仍会告知作者', () => {
    const b = boot();
    b.run(`const p={type:'分支互动剧情',clues:[{id:'key',name:'钥匙',initial:false}],chapters:[
      {id:'a',title:'出门',text:'。',choices:[{label:'拿钥匙',target:'b',effect:{clueId:'key',has:true}},{label:'空手',target:'b'}]},
      {id:'b',title:'回廊',text:'。',choices:[{label:'绕一圈',target:'b'},{label:'开门',target:'z',condition:{clueId:'key',has:true}}]},
      {id:'z',title:'出口',text:'。',choices:[]}]}`);
    assert.ok(b.get('validateGraph(p)').some(s => s.includes('回廊') && s.includes('无法抵达任何结局')));
    assert.equal(b.get('inspectClueRoutes(p)').complete, true);
  });
  test('作品和书架备份往返保留规则和初始状态，旧作品仍可顺序翻页', () => {
    const b = boot();
    b.run("const p=clone(CLUE_EXAMPLE);p.clues[0].initial=true;mergeBackup({projects:[p],publications:[clone(p)]})");
    for (const where of ['state.projects[0]', 'state.publications[0]']) {
      assert.equal(b.run(where + '.clues[0].initial'), true);
      assert.deepEqual(b.get(where + '.chapters[2].choices[0].effect'), { clueId: 'claim-blue', has: false });
    }
    b.run("const old=normalizeProject({type:'线性小说',chapters:[{id:'a',text:'甲'},{id:'b',text:'乙'}]});const legacy=createStoryEngine(old).session();");
    assert.equal(b.run('legacy.choose(0)'), true);
    assert.deepEqual(b.get('legacy.step'), { index: 1, clues: [] });
    b.run('const bad=clone(p);bad.chapters[1].choices[0].effect.clueId="不存在"');
    const before = b.run('state.projects.length');
    assert.throws(() => b.run('mergeBackup({ projects:[bad] })'), /线索规则无效/);
    assert.equal(b.run('state.projects.length'), before);
  });
  test('追加章节保留规则与已有跳转，重复章节 ID 在新片段内部重新映射', () => {
    const b = boot();
    b.run(`const p=clone(CLUE_EXAMPLE);
      appendChapterDrafts(p,[{id:'ledger',title:'再查一次',choices:[{label:'内部编号',targetIndex:1,effect:{clueId:'claim-blue',has:true}},{label:'旧窗口',target:'window'}]},
        {id:'new-ledger',title:'附页',choices:[{label:'新片段上一页',target:'ledger',condition:{clueId:'claim-blue',has:true}}]}]);`);
    const [a, c] = b.get('p.chapters.slice(-2)');
    assert.notEqual(a.id, 'ledger');
    assert.equal(a.choices[0].target, c.id);
    assert.equal(a.choices[1].target, 'window');
    assert.equal(c.choices[0].target, a.id);
    assert.equal(a.choices[0].effect.has, true);
    assert.throws(() => b.run("appendChapterDrafts(p,[{id:'broken',choices:[{targetIndex:9}]}])"), /目标序号无效/);
    assert.equal(b.run('p.chapters.length'), 7);
  });
  test('规划现有条件剧情时保留出口；创作提示中区分线索条件与已发生事实', async () => {
    const b = boot();
    b.run(`const p=clone(CLUE_EXAMPLE);p.chapters.forEach(c=>{c.text='';c.memory=''});state.projects=[p];state.active=p.id;
      const original=p.chapters.map(c=>clone(c.choices));
      api=async()=>({synopsis:'新大纲',chapters:p.chapters.map((c,i)=>({title:'场景'+i,outline:'章节目标',choices:[]}))});`);
    await b.run("agent('plan')");
    assert.equal(b.run('p.plan'), '新大纲');
    assert.deepEqual(b.get('p.chapters.map(c=>c.choices)'), b.get('original'));
    const ctx = b.get('contextFor(p,p.chapters[2])');
    assert.equal(ctx.outline[2].choices[0].condition, '需持有「蓝色存根」');
    assert.equal(ctx.outline[2].choices[0].effect, '交出「蓝色存根」');
    assert.equal(ctx.previousTail, '');
    assert.equal(ctx.pathFacts.length, 1);
  });


  test('编辑器用稳定 ID 保存条件，改名同步到显示，清除规则后恢复自由选择', () => {
    const b = boot();
    b.run(`const p=clone(CLUE_EXAMPLE),c=p.chapters[2],summary={textContent:''};
      const select={dataset:{ruleIndex:'0',ruleField:'condition'},value:'0:claim-blue',
        closest:()=>({querySelector:()=>summary})};
      document.querySelectorAll=()=>[select];bindChoiceRules(p,c);select.onchange();`);
    assert.deepEqual(b.get('c.choices[0].condition'), {clueId:'claim-blue',has:false});
    assert.match(b.run('summary.textContent'), /需未持有「蓝色存根」/);
    b.run("p.clues[0].name='<蓝&纸>'");
    assert.ok(b.run("choiceRulesEditor(p,c.choices[0],0).includes('&lt;蓝&amp;纸&gt;')"));
    assert.ok(!b.run("choiceRulesEditor(p,c.choices[0],0).includes('<蓝&纸>')"));
    assert.throws(() => b.run("normalizeClueList([p.clues[0],{...p.clues[0],id:'x'}])"), /线索重复/);
    b.run("select.value='';select.onchange()");
    assert.equal(b.run("'condition' in c.choices[0]"),false);
    assert.equal(b.run("c.choices[0].effect.clueId"),'claim-blue');
  });
  test('独立阅读文件内的按钮能锁定、解锁、回退和重置，无需任何外部服务', () => {
    const b = boot();
    const html = b.run('readerHTML(CLUE_EXAMPLE)');
    function element() {
      return {
        children: [], disabled: false,
        append(child) { this.children.push(child); },
        replaceChildren() { this.children = []; },
        click() { if (!this.disabled) this.onclick?.(); }
      };
    }
    const nodes = new Map();
    const node = id => {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    };
    const doc = { getElementById:node, createElement:element, body:{classList:{toggle(){}}} };
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    vm.runInNewContext(script, {document:doc,window:{scrollTo(){}}});
    const take = index => node('choices').children[index].click();
    take(1);
    assert.equal(node('choices').children[0].disabled,true);
    take(1);
    assert.equal(node('title').textContent,'明早八点');
    node('restart').click();
    take(0);take(0);
    assert.match(node('inventory').textContent,/蓝色存根/);
    take(0);
    assert.equal(node('title').textContent,'三下跺脚');
    assert.match(node('inventory').textContent,/无/);
    node('back').click();
    assert.match(node('inventory').textContent,/蓝色存根/);
    node('restart').click();
    assert.equal(node('back').disabled,true);
  });

