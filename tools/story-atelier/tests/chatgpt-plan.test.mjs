import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, rm, stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createChatGPTPlan} from '../offline/chatgpt-plan.mjs';
import {createWriterServer} from '../offline/local-writer.mjs';

const auth = 'https://auth.openai.com';
const api = 'https://api.openai.com/v1';
const grant = 'openid email profile offline_access resource.invoke chatgpt.tokens.use.direct';
const creds = {client:'oaiapp_atelier_fixture', access:'test-access-only', refresh:'test-refresh-only'};
const pair = generateKeyPairSync('rsa',{modulusLength:2048});
const jwk = {...pair.publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const chapter = {task:'chapter',context:{mode:'续写正文'},chapter:{segmentTarget:200,existing:'阿青合上怀表。'}};
const output = value => ({type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]});
const complete = items => ({type:'response.completed',response:{status:'completed',model:'account-model',output:items}});
function stream(events) {
  const bytes = Buffer.from(': init\r\n\r\n'+events.map(e=>'event: '+e.type+'\r\ndata: '+JSON.stringify(e)+'\r\n\r\n').join(''));
  return new Response(new ReadableStream({start(controller){for(let n=0;n<bytes.length;n+=13)controller.enqueue(bytes.subarray(n,n+13));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
function idToken(claims) {
  const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');
  const input = encode({alg:'RS256',kid:jwk.kid})+'.'+encode(claims);
  return input+'.'+sign('RSA-SHA256',Buffer.from(input),pair.privateKey).toString('base64url');
}
async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(),'glhf-plus-test-'));
  const file = join(dir,'credentials.sqlite');
  const sim = {requests:[],refreshes:0,exchanges:0,scope:grant,expires:3600,claims:{},...overrides};
  async function provider(url,init={}) {
    assert.equal(init.redirect,'error');
    if (url === auth+'/.well-known/jwks.json') return Response.json({keys:[jwk]});
    if (url === auth+'/.well-known/openid-configuration') return Response.json({issuer:auth,revocation_endpoint:auth+'/revoke'});
    if (url === auth+'/revoke') {assert.equal(init.body.get('token_type_hint'),'refresh_token');sim.revoked=init.body.get('token');return new Response(null,{status:sim.revokeStatus || 200});}
    if (url === auth+'/api/accounts/oauth/token') {
      const form = init.body; assert.equal(form.get('client_id'),creds.client); assert.equal(form.get('resource'),api);
      if (form.get('grant_type') === 'refresh_token') {
        sim.refreshes++; await new Promise(resolve=>setTimeout(resolve,5));
        assert.equal(form.get('refresh_token'),creds.refresh);
        if (sim.badRefresh) return Response.json({error:sim.badRefresh},{status:400});
        return Response.json({token_type:'Bearer',access_token:creds.access+'-renewed',refresh_token:creds.refresh+'-rotated',expires_in:3600});
      }
      sim.exchanges++; assert.equal(form.get('grant_type'),'authorization_code');
      assert.equal(form.get('redirect_uri'),sim.attempt.get('redirect_uri'));
      assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),sim.attempt.get('code_challenge'));
      let id = idToken({sub:'fixture-owner',iss:auth,aud:creds.client,exp:Math.floor(Date.now()/1000)+600,nonce:sim.attempt.get('nonce'),email:'writer@example.test',...sim.claims});
      if (sim.badSignature) id=id.split('.').slice(0,2).join('.')+'.invalid';
      return Response.json({id_token:id,token_type:'Bearer',access_token:creds.access,refresh_token:creds.refresh,scope:sim.scope,expires_in:sim.expires});
    }
    if (url === api+'/models') return Response.json({models:[{slug:'account-model',display_name:'可用套餐模型',visibility:'list'},{slug:'hidden',visibility:'hidden'}]});
    if (url === api+'/responses') {sim.requests.push({bearer:init.headers.Authorization,body:JSON.parse(init.body)});return sim.reply?.(init) || stream([complete([output({text:'停针向前跳了一格。',memory:'阿青看见停针转动。'})])]);}
    throw new Error('unexpected test endpoint');
  }
  const plan = createChatGPTPlan({filename:file,fetcher:provider});
  if (overrides.personalOnly) await plan.usePlan();
  const server = createWriterServer({plan,callOpenAI:provider,openAIKey:'fixture-project-key',personalOnly:!!overrides.personalOnly});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));plan.close();await rm(dir,{recursive:true,force:true});});
  const get = path => fetch(origin+path,{redirect:'manual'});
  const post = (path,body={},extra={}) => fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body),redirect:'manual'});
  async function start(which='') {
    const res=await post('/api/plan/start'+which); assert.equal(res.status,303);
    const address=new URL(res.headers.get('location')); assert.equal(address.origin,auth); assert.equal(address.pathname,'/api/accounts/authorize');
    sim.attempt=address.searchParams;
    return new URL(sim.attempt.get('redirect_uri')+'?'+new URLSearchParams({state:sim.attempt.get('state'),code:'fixture-code',client_id:creds.client}));
  }
  async function approve() {const cb=await start();const res=await fetch(cb,{redirect:'manual'});assert.equal(res.status,303);return res.headers.get('location');}
  return {sim,plan,provider,file,origin,get,post,start,approve};
}

test('Personal mode requires plan consent, blocks API billing, and resumes saved authorization',async t=>{
  const f=await fixture(t,{personalOnly:true});
  const initial=await (await f.get('/api/agent')).json();
  assert.equal(initial.personalOnly,true);assert.equal(initial.plan.mode,'plan');
  assert.equal(initial.configured,false);assert.equal(initial.keyAvailable,false);
  assert.equal((await f.post('/api/plan/use-key')).status,403);
  assert.equal((await f.post('/api/agent',chapter)).status,401);
  assert.equal(f.sim.requests.length,0);
  await f.approve();
  assert.equal((await f.post('/api/agent',{...chapter,billing:'api-key'})).status,409);
  assert.equal((await f.post('/api/agent',{...chapter,billing:'plan'})).status,200);
  assert.equal(f.sim.requests[0].bearer,'Bearer '+creds.access);
  // Another ordinary launcher cannot make this personal process charge a key.
  await f.plan.useKey();
  assert.equal((await f.post('/api/agent',chapter)).status,401);
  assert.equal(f.sim.requests.length,1);
  await f.plan.usePlan();
  assert.equal((await f.plan.status()).connected,true);
  assert.equal((await f.post('/api/agent',chapter)).status,200);
  assert.equal((await f.post('/api/plan/disconnect')).status,200);
  assert.equal((await f.post('/api/agent',chapter)).status,401);
  assert.equal(f.sim.requests.length,2);
});

test('Plus completes PKCE on loopback, lists account models and writes via the subscription',async t=>{
  const f=await fixture(t);assert.equal((await (await f.get('/api/agent')).json()).plan.mode,'api-key');
  assert.match(await f.approve(),/#chatgpt-plan=welcome$/);assert.equal(f.sim.attempt.get('scope'),grant.replace('email profile','profile email'));
  assert.equal(f.sim.attempt.get('client_id'),'dynamic_agent_client');assert.match(f.sim.attempt.get('ext_agent_host_id'),/^urn:uuid:/);
  const config=await (await f.get('/api/agent')).json();assert.equal(config.plan.connected,true);assert.equal(config.plan.mode,'plan');assert.equal(config.plan.label,'writer@example.test');
  assert.doesNotMatch(JSON.stringify(config),/test-access-only|test-refresh-only|id_token|code_verifier/);
  assert.equal((await stat(f.file)).mode & 0o777,0o600);
  assert.deepEqual((await (await f.get('/api/plan/models')).json()).models,[{id:'account-model',name:'可用套餐模型'}]);
  const res=await f.post('/api/agent',{...chapter,billing:'plan',planAccount:creds.client});assert.equal(res.status,200);assert.equal((await res.json()).text,'停针向前跳了一格。');
  const req=f.sim.requests[0];assert.equal(req.bearer,'Bearer '+creds.access);assert.equal(req.body.model,'account-model');assert.equal(req.body.stream,true);assert.equal(req.body.store,false);
  assert.equal(req.body.max_output_tokens,undefined);assert.equal(req.body.input[0].role,'user');assert.match(req.body.input[0].content,/阿青合上怀表/);assert.equal(req.body.text.format.name,'story_chapter');
  const saved=createChatGPTPlan({filename:f.file,fetcher:f.provider});t.after(()=>saved.close());assert.equal((await saved.status()).connected,true);
});

test('Rejects foreign origins, wrong state, replay, client replacement, forged or mismatched identities',async t=>{
  const f=await fixture(t);assert.equal((await f.post('/api/plan/start',{}, {Origin:'https://foreign.test'})).status,403);
  assert.equal((await f.get('/api/plan/start')).status,405);
  const cb=await f.start();const wrong=new URL(cb);wrong.searchParams.set('state','wrong');assert.equal((await fetch(wrong)).status,400);assert.equal(f.sim.exchanges,0);
  assert.equal((await fetch(cb,{redirect:'manual'})).status,303);assert.equal((await fetch(cb)).status,400);
  const again=await f.start();assert.equal(f.sim.attempt.get('client_id'),creds.client);assert.equal(f.sim.attempt.get('agent_name_hint'),null);
  again.searchParams.set('client_id','a-different-client');assert.equal((await fetch(again)).status,400);
  for(const [key,value] of Object.entries({iss:'https://foreign.test',aud:'wrong-client',nonce:'wrong-nonce',exp:1,sub:'wrong-user'})) {
    f.sim.claims={[key]:value};const attempt=await f.start();assert.equal((await fetch(attempt)).status,401);
  }
  f.sim.claims={};f.sim.badSignature=true;assert.equal((await fetch(await f.start())).status,401);
  assert.equal((await f.plan.status()).label,'writer@example.test');
});

test('Denied consent, missing grants, disconnected state and stale account requests never charge the project key',async t=>{
  const f=await fixture(t,{scope:'openid profile email'});const cb=await f.start();cb.searchParams.set('error','access_denied');
  assert.match((await fetch(cb,{redirect:'manual'})).headers.get('location'),/cancelled/);assert.equal(f.sim.exchanges,0);
  assert.equal((await f.post('/api/agent',chapter)).status,401);
  assert.match(await f.approve(),/permission/);assert.equal((await f.plan.status()).signedIn,true);assert.equal((await f.plan.status()).connected,false);
  assert.equal((await f.post('/api/agent',chapter)).status,401);f.sim.scope=grant;await f.approve();
  assert.equal((await f.post('/api/agent',{...chapter,billing:'api-key'})).status,409);assert.equal((await f.post('/api/agent',{...chapter,planAccount:'another'})).status,409);
  assert.equal((await f.post('/api/agent',{...chapter,model:'hidden'})).status,400);
  const old=await f.start();assert.equal((await f.post('/api/plan/disconnect')).status,200);assert.equal(f.sim.revoked,creds.refresh);
  assert.equal((await fetch(old)).status,400);assert.equal((await f.post('/api/agent',chapter)).status,401);assert.equal(f.sim.requests.length,0);
  assert.equal((await f.post('/api/plan/use-key')).status,200);assert.equal((await f.plan.status()).mode,'api-key');assert.equal((await f.post('/api/agent',{...chapter,billing:'plan'})).status,409);
});

test('Refresh is serialized, retains scopes, and replaces rotating credentials',async t=>{
  const f=await fixture(t,{expires:1});await f.approve();const [first,second]=await Promise.all([f.plan.credentials(),f.plan.credentials()]);
  assert.equal(f.sim.refreshes,1);assert.equal(first.access,creds.access+'-renewed');assert.deepEqual(first,second);
  await f.post('/api/plan/disconnect');assert.equal(f.sim.revoked,creds.refresh+'-rotated');
});

test('Terminal refresh clears credentials and preserves the issued registration',async t=>{
  const f=await fixture(t,{expires:1,badRefresh:'invalid_grant'});await f.approve();assert.equal((await f.post('/api/agent',chapter)).status,401);
  const s=await f.plan.status();assert.equal(s.connected,false);assert.equal(s.mode,'plan');assert.equal(s.current,creds.client);assert.equal(f.sim.requests.length,0);
  await f.start();assert.equal(f.sim.attempt.get('client_id'),creds.client);assert.equal(f.sim.attempt.get('id_token_hint'),null);
});

test('Streamed quota and admission errors keep plan billing. Incomplete text never becomes a draft',async t=>{
  const f=await fixture(t);await f.approve();f.sim.reply=()=>stream([{type:'response.output_text.delta',delta:'尚未完成'},{type:'response.failed',response:{error:{code:'subscription_sharing_usage_limit_exceeded'}}}]);
  const quota=await f.post('/api/agent',chapter);assert.equal(quota.status,429);assert.equal((await quota.json()).code,'subscription_sharing_usage_limit_exceeded');
  f.sim.reply=()=>stream([{type:'response.output_text.delta',delta:'尚未完成'}]);assert.equal((await f.post('/api/agent',chapter)).status,502);
  f.sim.reply=()=>Response.json({detail:'admission denied'},{status:403});assert.equal((await f.post('/api/agent',chapter)).status,403);
  assert.ok(f.sim.requests.every(x=>x.bearer==='Bearer '+creds.access));
});

test('Plan, review and research reuse studio formats. Research requires real response citations',async t=>{
  const f=await fixture(t);await f.approve();const text='史料记载。';
  for(const [task,value] of [['plan',{synopsis:'工坊',chapters:[]}],['review',{review:'时间线完整'}]]){
    f.sim.reply=()=>stream([complete([output(value)])]);const res=await f.post('/api/agent',{task,context:{chapterCount:1}});assert.equal(res.status,200);assert.equal(f.sim.requests.at(-1).body.text.format.name,'story_'+task);
  }
  const research={task:'research',context:{query:'城市档案馆保存哪些旧地图？'}};
  const cite={type:'url_citation',url:'https://example.org/maps',title:'目录',start_index:0,end_index:2};
  const part={type:'output_text',text,annotations:[cite]};f.sim.reply=()=>stream([complete([{type:'message',content:[part]}])]);
  const r=await f.post('/api/agent',research);assert.equal(r.status,200);assert.equal((await r.json()).citations[0].url,cite.url);assert.equal(f.sim.requests.at(-1).body.tools[0].type,'web_search');
  part.annotations=[];assert.equal((await f.post('/api/agent',research)).status,502);
});


test('Disconnect cancels an in-flight subscription request',async t=>{
  const f=await fixture(t);
  await f.approve();
  let started;
  const ready=new Promise(resolve=>{started=resolve;});
  f.sim.reply=init=>new Promise((resolve,reject)=>{
    started();
    init.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
  });
  const writing=f.post('/api/agent',chapter);
  await ready;
  assert.equal((await f.post('/api/plan/disconnect')).status,200);
  assert.equal((await writing).status,499);
  assert.equal(f.sim.requests.length,1);
  assert.equal((await f.plan.status()).connected,false);
});
