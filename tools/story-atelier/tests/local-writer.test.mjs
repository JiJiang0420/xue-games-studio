import test from 'node:test';
import {get} from 'node:http';
import assert from 'node:assert/strict';
import {createWriterServer, loadLocalOpenAIKey, startLocalWriter} from '../offline/local-writer.mjs';
import {createChatGPTPlan} from '../offline/chatgpt-plan.mjs';
import {mkdir, mkdtemp, rm, writeFile, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

async function bridge(t, callOllama, options = {}) {
  const server = createWriterServer({callOllama,...options});
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (body,headers = {}) => fetch(url + '/api/atelier/draft',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return {url,post};
}

test('个人启动器固定回环地址，恢复套餐模式，端口冲突不会重置原连接',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'atelier-personal-'));
  const filename=join(directory,'connection.sqlite');
  const saved=createChatGPTPlan({filename});
  await saved.useKey();saved.close();
  const server=await startLocalWriter({personal:true,port:0,planFilename:filename});
  t.after(async()=>{
    await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    await rm(directory,{recursive:true,force:true});
  });
  assert.equal(server.address().address,'127.0.0.1');
  const base='http://127.0.0.1:'+server.address().port;
  const status=await (await fetch(base+'/api/agent')).json();
  assert.equal(status.personalOnly,true);assert.equal(status.keyAvailable,false);
  assert.equal(status.plan.mode,'plan');assert.equal(status.configured,false);
  const other=createChatGPTPlan({filename});
  await other.useKey();
  try {
    await assert.rejects(startLocalWriter({personal:true,port:server.address().port,planFilename:filename}),/已被占用/);
    assert.equal((await other.status()).mode,'api-key');
  } finally { other.close(); }
});

test('无效本机端口不会创建个人授权文件',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'atelier-port-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await assert.rejects(startLocalWriter({personal:true,port:NaN,planFilename:join(directory,'unused.sqlite')}),/端口无效/);
  await assert.rejects(stat(join(directory,'unused.sqlite')),{code:'ENOENT'});
});

test("本机启动器提供完整工作台，只枚举本地模型", async t => {
  const {url}=await bridge(t,async address=>{
    assert.equal(address,'http://127.0.0.1:11434/api/tags');
    return Response.json({models:[{name:'local:test'},{name:'remote:cloud'},{name:'hosted',remote_model:'remote'},{name:'other',remote_host:'https://example.test'}]});
  });
  assert.match(await (await fetch(url)).text(),/writing-seed/);
  assert.deepEqual((await (await fetch(url+'/api/atelier/models')).json()).models,['local:test']);
  assert.equal((await fetch(url+'/any/file')).status,404);
});

test("本机 HTTP 创作请求携带原文、方向和上一稿，返回模型正文", async t => {
  let chat;
  const {post}=await bridge(t,async (url,req)=>{
    if (url.endsWith('/api/tags')) return Response.json({models:[{name:'local:test'}]});
    assert.equal(url,'http://127.0.0.1:11434/api/chat');chat=JSON.parse(req.body);
    return Response.json({message:{role:'assistant',content:'   阿梨收回手。旧布的影子还停在窗台上。  '},done:true});
  });
  const input={manuscript:'阿梨拿起一块没有影子的布。',idea:'',direction:'加入转折'};
  const response=await post({model:'local:test',input,previous:'上一稿。'});
  assert.equal(response.status,200);assert.equal((await response.json()).text,'阿梨收回手。旧布的影子还停在窗台上。');
  assert.equal(chat.stream,false);assert.equal(chat.model,'local:test');assert.equal(chat.messages[0].role,'system');
  assert.match(chat.messages[0].content,/不.*复述/);
  assert.deepEqual(JSON.parse(chat.messages[1].content),{previousDraft:'上一稿。',writing:input});
});

test("未启动模型服务和不可用的模型名称有明确反馈", async t => {
  const {url,post}=await bridge(t,async()=>{throw Error('connection refused');});
  const list=await (await fetch(url+'/api/atelier/models')).json();
  assert.deepEqual(list.models,[]);assert.match(list.message,/未连上/);
  const response=await post({model:'missing',input:{manuscript:'开头',idea:''}});
  assert.equal(response.status,502);assert.match((await response.json()).error,/本机/);
});

test("模型不在已安装清单时不会尝试下载或生成，异常输出也能重试", async t => {
  let calls=0;
  const {post}=await bridge(t,async url=>{if(url.endsWith('/api/tags'))return Response.json({models:[{name:'one'}]});calls++;return Response.json({done:true,done_reason:'length',message:{content:'截断的正文'}});});
  const input={manuscript:'原稿',idea:''};
  assert.equal((await post({model:'missing',input})).status,400);assert.equal(calls,0);
  const incomplete=await post({model:'one',input});assert.equal(incomplete.status,502);assert.match((await incomplete.json()).error,/未完成/);
});

test("本机模型入口拒绝外部来源、无效内容和过大的输入", async t => {
  let calls=0;
  const {url,post}=await bridge(t,async()=>{calls++;return Response.json({});});
  assert.equal((await post({}, {Origin:'https://elsewhere.test'})).status,403);
  const foreignHost=await new Promise((resolve,reject) => {
    get(url+'/api/atelier/models',{headers:{Host:'outside.test'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);
  });
  assert.equal(foreignHost,403);
  assert.equal((await post({}, {'Content-Type':'text/plain'})).status,415);
  assert.equal((await post({model:'x',input:{}})).status,400);
  assert.equal((await post({model:'x',input:{manuscript:'文'.repeat(85000),idea:''}})).status,413);
  assert.equal(calls,0);
});

test("本机工作台用已配置的 OpenAI 续写，服务响应不包含密钥",async t => {
  const secret='fixture-kept-in-launcher';
  const sent=[];
  const {url}=await bridge(t,async()=>{throw Error();},{openAIKey:secret,callOpenAI:async(address,opts)=>{
    assert.equal(address,'https://api.openai.com/v1/responses');
    assert.equal(opts.headers.Authorization,'Bearer '+secret);
    assert.equal(opts.redirect,'error');
    sent.push(JSON.parse(opts.body));
    return Response.json({status:'completed',model:'gpt-5.4-mini-fixture',
      output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({text:'门里递出第二张明信片。',memory:'第二张明信片出现。'})}]}]});
  }});
  const settings=await (await fetch(url+'/api/agent')).json();
  assert.equal(settings.configured,true);assert.equal(settings.preferredWriter,'service');
  assert.equal((await fetch(url+'/.env.local')).status,404);
  const req={task:'chapter',model:'gpt-5.4-mini',context:{mode:'续写正文'},chapter:{existing:'明信片的邮戳来自明天。',segmentTarget:200}};
  const result=await fetch(url+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json',Origin:url},body:JSON.stringify(req)});
  assert.equal(result.status,200);
  const value=await result.json();
  assert.equal(value.text,'门里递出第二张明信片。');assert.equal(value.model,'gpt-5.4-mini-fixture');
  assert.ok(!JSON.stringify([settings,value]).includes(secret));
  assert.equal(sent.length,1);assert.equal(sent[0].store,false);assert.equal(sent[0].text.format.strict,true);
  assert.equal(JSON.parse(sent[0].input).chapter.existing,req.chapter.existing);
});

test("本机付费入口会在调用 OpenAI 前检查来源、类型及内容",async t => {
  let calls=0;
  const {url}=await bridge(t,async()=>Response.json({models:[]}),{openAIKey:'fake-local',callOpenAI:async()=>{calls++;return Response.json({});}});
  const api=url+'/api/agent';
  const post=(body,headers={})=>fetch(api,{method:'POST',headers:{'Content-Type':'application/json',...headers},body});
  assert.equal((await post('{}',{Origin:'https://elsewhere.test'})).status,403);
  assert.equal((await post('{}',{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post('broken')).status,400);
  assert.equal((await post(JSON.stringify({task:'chapter',context:{},chapter:{segmentTarget:'200'}}))).status,400);
  assert.equal((await post(JSON.stringify({context:{idea:'字'.repeat(500001)}}))).status,413);
  assert.equal((await fetch(api,{method:'DELETE'})).status,405);
  assert.equal(calls,0);
});

test("未配置本机密钥时保留离线和 Ollama 创作方式",async t => {
  let calls=0;
  const {url}=await bridge(t,async()=>Response.json({models:[{name:'on-device'}]}),{callOpenAI:async()=>{calls++;throw Error();}});
  const config=await (await fetch(url+'/api/agent')).json();
  assert.equal(config.configured,false);assert.equal(config.preferredWriter,'');
  const r=await fetch(url+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,503);assert.equal(calls,0);
  assert.deepEqual((await (await fetch(url+'/api/atelier/models')).json()).models,['on-device']);
});

test("同为 HTTP 429，预付余额耗尽、项目上限和临时限流分别反馈",async t => {
  let code='credit_balance_exhausted';
  const {url}=await bridge(t,async()=>Response.json({models:[]}),{openAIKey:'fixture',callOpenAI:async()=>{
    const type=code==='rate_limit_exceeded'?'rate_limit_error':'insufficient_quota';
    return Response.json({error:{code,type}},{status:429});
  }});
  const request=()=>fetch(url+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({task:'chapter',context:{},chapter:{segmentTarget:200}})});
  const credit=await request(), error=await credit.json();
  assert.equal(credit.status,402);assert.equal(error.code,code);assert.equal(error.upstreamStatus,429);assert.match(error.error,/余额已用尽/);assert.doesNotMatch(error.error,/稍后重试/);
  code='project_spend_limit_exceeded';const limit=await request();assert.equal(limit.status,402);assert.match((await limit.json()).error,/项目已达到支出上限/);
  code='rate_limit_exceeded';assert.equal((await request()).status,429);
});

test("从环境或本工具所在目录读取密钥，下载文件夹不会采用上级其他项目的配置",async t => {
  const root=await mkdtemp(join(tmpdir(),'atelier-config-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'offline');await mkdir(directory);
  const launcher=pathToFileURL(join(directory,'local-writer.mjs')).href;
  await writeFile(join(root,'.env.local'),'OPENAI_API_KEY=from-project\n');
  await writeFile(join(root,'package.json'),JSON.stringify({name:'different-app'}));
  assert.equal(await loadLocalOpenAIKey({},launcher),'');
  await writeFile(join(root,'package.json'),JSON.stringify({name:'glhf-story-atelier'}));
  assert.equal(await loadLocalOpenAIKey({},launcher),'from-project');
  await writeFile(join(directory,'.env.local'),'# local\nOPENAI_API_KEY="from-package"\nUNRELATED=yes\n');
  assert.equal(await loadLocalOpenAIKey({},launcher),'from-package');
  assert.equal(await loadLocalOpenAIKey({OPENAI_API_KEY:'from-process'},launcher),'from-process');
});

test("项目密钥不进入网络错误信息，错误不会被当成模型正文",async t => {
  const secret='launcher-private-example';
  const {url}=await bridge(t,async()=>Response.json({}),{openAIKey:secret,callOpenAI:async()=>{throw Error('fixture error '+secret,{cause:{code:'ENOTFOUND'}});}});
  const r=await fetch(url+'/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({task:'chapter',context:{},chapter:{segmentTarget:200}})});
  assert.equal(r.status,502);const x=await r.json();assert.match(x.error,/ENOTFOUND/);assert.equal(x.text,undefined);assert.ok(!JSON.stringify(x).includes(secret));
});
