import {createHash, createPublicKey, randomBytes, randomUUID, verify} from 'node:crypto';
import {existsSync, mkdirSync, openSync, closeSync, chmodSync, lstatSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

const issuer = 'https://auth.openai.com';
const resource = 'https://api.openai.com/v1';
const permission = 'chatgpt.tokens.use.direct';
const scopes = 'openid profile email offline_access resource.invoke ' + permission;
const random = () => randomBytes(32).toString('base64url');
const fail = (message, status = 400) => Object.assign(new Error(message), {status});
const usable = account => Boolean(account?.session?.access && account.session.scopes.includes(permission) && account.session.scopes.includes('resource.invoke'));
const active = state => state.accounts.find(account => account.client === state.active);
const empty = () => ({host:'',mode:'api-key',active:'',accounts:[]});

function defaultPath() {
  const base = process.platform === 'win32' ? process.env.LOCALAPPDATA || homedir() : process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'glhf-story-atelier', 'chatgpt.sqlite');
}

async function identity(idToken, client, nonce, request) {
  try {
    if (typeof idToken !== 'string' || idToken.length > 65536) throw Error();
    const parts = idToken.split('.');
    if (parts.length !== 3) throw Error();
    const [head, body, signature] = parts;
    const header = JSON.parse(Buffer.from(head,'base64url'));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit) throw Error();
    const response = await request(issuer + '/.well-known/jwks.json');
    if (!response.ok) throw Error();
    const {keys} = await response.json();
    const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig') && (!key.alg || key.alg === header.alg));
    if (!jwk || !verify('RSA-SHA256', Buffer.from(head + '.' + body), createPublicKey({key:jwk,format:'jwk'}), Buffer.from(signature,'base64url'))) throw Error();
    const claims = JSON.parse(Buffer.from(body,'base64url'));
    const now = Date.now() / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== issuer || !audiences.includes(client) || ((audiences.length > 1 || claims.azp) && claims.azp !== client) ||
        !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf !== undefined && !(claims.nbf <= now)) ||
        !nonce || claims.nonce !== nonce || typeof claims.sub !== 'string' || !claims.sub) throw Error();
    return {subject:claims.sub,email:typeof claims.email === 'string' ? claims.email : ''};
  } catch { throw fail('无法验证 OpenAI 返回的登录身份，请重新连接。',401); }
}

function session(tokens, previous) {
  if (typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || String(tokens.token_type).toLowerCase() !== 'bearer') throw fail('OpenAI 返回的套餐授权不完整，请重新连接。',502);
  return {access:tokens.access_token, refresh:tokens.refresh_token || previous?.refresh || '', id:tokens.id_token || previous?.id || '',
    expires:Date.now() + tokens.expires_in * 1000, scopes:typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/) : previous?.scopes || []};
}

export function createChatGPTPlan({filename = defaultPath(), fetcher = fetch} = {}) {
  let database, pending, queue = Promise.resolve(), catalog;
  function open(create) {
    if (database) return database;
    if (filename !== ':memory:') {
      if (!create && !existsSync(filename)) return null;
      mkdirSync(dirname(filename),{recursive:true,mode:0o700});
      if (!lstatSync(dirname(filename)).isDirectory() || (existsSync(filename) && !lstatSync(filename).isFile())) throw fail('套餐配置文件路径无效。',503);
      const fd = openSync(filename,'a',0o600); closeSync(fd);
      if (!lstatSync(filename).isFile()) throw fail('套餐配置文件路径无效。',503);
      chmodSync(filename,0o600);
    }
    database = new DatabaseSync(filename);
    database.exec('CREATE TABLE IF NOT EXISTS connection (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)');
    return database;
  }
  function read(db) {
    const row = db?.prepare('SELECT data FROM connection WHERE id=1').get();
    return row ? JSON.parse(row.data) : empty();
  }
  function transaction(fn) {
    // The SQLite transaction also serializes rotating refresh tokens across launchers.
    const run = queue.then(async () => {
      const db = open(true);
      try { db.exec('BEGIN IMMEDIATE'); } catch { throw fail('另一个工坊窗口正在更新套餐连接，请稍后重试。',409); }
      try {
        const state = read(db);
        const result = await fn(state);
        db.prepare('INSERT OR REPLACE INTO connection(id,data) VALUES(1,?)').run(JSON.stringify(state));
        db.exec('COMMIT'); return result;
      } catch (err) { db.exec('ROLLBACK'); throw err; }
    });
    queue = run.catch(() => {});
    return run;
  }
  async function request(url, init = {}) {
    try { return await fetcher(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)}); }
    catch { throw fail('无法连接 OpenAI 套餐服务，请检查网络后重试。',502); }
  }
  async function token(parameters) {
    const response = await request(issuer + '/api/accounts/oauth/token',{method:'POST',body:new URLSearchParams({...parameters,resource})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = typeof result.error === 'string' ? result.error : result.error?.code;
      throw Object.assign(fail('OpenAI 未能完成本次套餐授权。请重新连接或稍后再试。',response.status),{oauthCode:code});
    }
    return result;
  }
  async function status() {
    await queue;
    const state = read(open(false));
    const account = active(state);
    return {mode:state.mode, connected:usable(account), current:state.active,
      accounts:state.accounts.map(a => ({id:a.client,label:a.email || '已保存的 ChatGPT 账号'})),
      label:account?.email || '', signedIn:Boolean(account?.session)};
  }
  async function begin(callback, selection, returnOrigin = new URL(callback).origin) {
    return transaction(state => {
      const account = selection === 'new' ? undefined : state.accounts.find(a => a.client === (selection || state.active));
      if (selection && selection !== 'new' && !account) throw fail('所选账号已变更，请刷新。');
      state.host ||= 'urn:uuid:' + randomUUID();
      const client = account?.client || 'dynamic_agent_client';
      const attempt = {state:random(),nonce:random(),verifier:random(),callback,returnOrigin,client:account?.client,subject:account?.subject,expires:Date.now()+600000};
      const url = new URL('/api/accounts/authorize',issuer);
      url.search = new URLSearchParams({client_id:client,ext_agent_host_id:state.host,response_type:'code',redirect_uri:callback,
        resource,scope:scopes,state:attempt.state,nonce:attempt.nonce,code_challenge_method:'S256',
        code_challenge:createHash('sha256').update(attempt.verifier).digest('base64url')});
      if (!account) url.searchParams.set('agent_name_hint','GLHF Story Atelier');
      if (account?.session?.id) url.searchParams.set('id_token_hint',account.session.id);
      if (account?.email) url.searchParams.set('login_hint',account.email);
      if (account?.session && !usable(account)) url.searchParams.set('prompt','consent');
      pending = attempt; state.attempt = attempt.state;
      state.mode = 'plan'; // An explicit connection attempt must never fall back to an API key.
      return url.href;
    });
  }
  async function finish(url) {
    const attempt = pending;
    if (!attempt || attempt.expires < Date.now() || url.origin + url.pathname !== attempt.callback || url.searchParams.get('state') !== attempt.state) throw fail('登录请求已过期或不匹配，请从工坊重新连接。');
    pending = undefined;
    const resultPage = outcome => attempt.returnOrigin + '/#chatgpt-plan=' + outcome;
    if (url.searchParams.has('error')) return resultPage('cancelled');
    const code = url.searchParams.get('code');
    const client = url.searchParams.get('client_id') || attempt.client;
    if (!code || !client || !/^[\w.-]{1,220}$/.test(client) || client === 'dynamic_agent_client' || (attempt.client && client !== attempt.client)) throw fail('OpenAI 回调的客户端信息无效。');
    return transaction(async state => {
      if (state.attempt !== attempt.state) throw fail('本次登录已被新的套餐设置取代，请重新连接。',409);
      delete state.attempt;
      const result = await token({grant_type:'authorization_code',client_id:client,code,code_verifier:attempt.verifier,redirect_uri:attempt.callback});
      const claims = await identity(result.id_token,client,attempt.nonce,request);
      const existing = state.accounts.find(a => a.client === client);
      if ((attempt.subject && attempt.subject !== claims.subject) || (existing && existing.subject !== claims.subject)) throw fail('登录身份与保存的账号不一致。',401);
      const account = existing || {client};
      Object.assign(account,claims,{session:session(result)});
      if (!existing) state.accounts.push(account);
      state.active = client; state.mode = 'plan'; catalog = undefined;
      if (!usable(account)) return resultPage('permission');
      const first = !account.welcomed; account.welcomed = true;
      return resultPage(first ? 'welcome' : 'connected');
    });
  }
  async function credentials() {
    await queue;
    const state = read(open(false));
    const current = active(state);
    if (state.mode !== 'plan' || !usable(current)) throw fail('请在设置中连接 ChatGPT 并允许使用套餐。',401);
    if (current.session.expires > Date.now()+45000) return {client:current.client,access:current.session.access};
    const next = await transaction(async state => {
      const a = active(state);
      if (state.mode !== 'plan' || !usable(a) || a.client !== current.client) return null;
      if (a.session.expires <= Date.now()+45000) {
        if (!a.session.refresh) { delete a.session; return null; }
        try { a.session = session(await token({grant_type:'refresh_token',client_id:a.client,refresh_token:a.session.refresh}),a.session); }
        catch (err) {
          if (!['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused'].includes(err.oauthCode)) throw err;
          delete a.session; return null;
        }
      }
      return usable(a) ? {client:a.client,access:a.session.access} : null;
    });
    if (!next) throw fail('套餐授权需要更新，请在设置中重新连接。',401);
    return next;
  }
  async function models(auth) {
    if (catalog?.client === auth.client && catalog.until > Date.now()) return catalog.list;
    const result = await request(resource + '/models',{headers:{Authorization:'Bearer ' + auth.access}});
    if (!result.ok) throw fail(`无法读取此账号的套餐模型（HTTP ${result.status}）。请检查套餐授权。`,result.status);
    const body = await result.json().catch(() => ({}));
    const list = (Array.isArray(body.models) ? body.models : []).filter(m => m?.visibility === 'list' && typeof m.slug === 'string' && /^[\w.:-]{1,90}$/.test(m.slug))
      .map(m => ({id:m.slug,name:typeof m.display_name === 'string' ? m.display_name : m.slug}));
    if (!list.length) throw fail('此 ChatGPT 账号没有返回可用的套餐模型。',403);
    catalog = {client:auth.client,until:Date.now()+300000,list}; return list;
  }
  async function disconnect() {
    pending = undefined;
    return transaction(async state => {
      const a = active(state);
      let revoked = true;
      if (a?.session?.refresh) {
        try {
          const meta = await (await request(issuer + '/.well-known/openid-configuration')).json();
          const dest = new URL(meta.revocation_endpoint);
          if (meta.issuer !== issuer || dest.origin !== issuer) throw Error();
          const response = await request(dest.href,{method:'POST',body:new URLSearchParams({token:a.session.refresh,token_type_hint:'refresh_token',client_id:a.client})});
          revoked = response.ok;
        } catch { revoked = false; }
      }
      if (a) delete a.session;
      delete state.attempt;
      state.mode = 'plan'; catalog = undefined;
      return revoked;
    });
  }
  async function useKey() { pending = undefined; return transaction(state => { delete state.attempt; state.mode = 'api-key'; }); }
  async function usePlan() { pending = undefined; return transaction(state => { delete state.attempt; state.mode = 'plan'; }); }
  return {status,begin,finish,credentials,models,disconnect,useKey,usePlan,close(){database?.close();}};
}
