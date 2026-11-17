import test from 'node:test';
import {get} from 'node:http';
import assert from 'node:assert/strict';
import {createWriterServer} from '../offline/local-writer.mjs';

async function bridge(t, callOllama) {
  const server = createWriterServer({callOllama});
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const url = 'http://127.0.0.1:' + server.address().port;
  const post = (body,headers = {}) => fetch(url + '/api/atelier/draft',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return {url,post};
}

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
