import {buildPayload, parseOutput, validateTask} from './openai-agent.mjs';

const messages = {
  subscription_sharing_user_not_eligible:[403,'所选账号或工作区未开放套餐用量。'],
  subscription_sharing_usage_limit_exceeded:[429,'已达到套餐或此应用的用量上限。请到 ChatGPT 的用量设置查看。'],
  subscription_sharing_usage_unavailable:[503,'暂时无法查询套餐用量，请稍后重试。'],
  subscription_sharing_unsupported_capability:[400,'当前套餐模型不支持这项功能。可在设置中选择其他套餐模型。'],
  subscription_sharing_route_not_supported:[403,'此请求未获套餐通道授权。'],
  subscription_sharing_invalid_user:[401,'套餐身份验证未通过，请重新连接。'],
  subscription_sharing_user_unavailable:[503,'OpenAI 暂时无法读取账号信息，请稍后重试。'],
  chatpass_v2_scope_not_authorized:[403,'请重新连接并允许工坊使用套餐。'],
  chatpass_v2_invalid_authorization_context:[403,'OpenAI 未接受此套餐授权，请重新连接。']
};
function planError(detail, upstreamStatus) {
  const code = typeof detail?.code === 'string' && /^[a-z_0-9]{1,100}$/.test(detail.code) ? detail.code : '';
  const known = Object.hasOwn(messages,code) ? messages[code] : null;
  const status = upstreamStatus >= 400 ? upstreamStatus : known?.[0] || 502;
  const fallback = {401:'套餐授权无效，请重新连接。',403:'账号、地区或工作区未获准使用此套餐功能。',429:'套餐请求受限，请查看 ChatGPT 用量。',503:'套餐服务暂时不可用，请稍后重试。'};
  return Response.json({error:known?.[1] || fallback[status] || `OpenAI 套餐请求失败（HTTP ${status}）。`,code,upstreamStatus:status},{status});
}

async function readCompleted(response, task) {
  if (!response.body || !/^text\/event-stream\b/i.test(response.headers.get('Content-Type') || '')) return Response.json({error:'OpenAI 未返回套餐响应流。'},{status:502});
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '', data = [], size = 0;
  const items = [];
  function event() {
    if (!data.length) return;
    const value = data.join('\n'); data = [];
    if (value === '[DONE]') return;
    const e = JSON.parse(value);
    if (e.type === 'error' || e.type === 'response.failed') return planError(e.response?.error || e.error || e);
    if (e.type === 'response.incomplete') return Response.json({error:'套餐模型中途结束，请缩短任务后重试。'},{status:502});
    if (e.type === 'response.output_item.done' && Number.isInteger(e.output_index) && e.output_index >= 0 && e.output_index < 1000 && e.item) items[e.output_index] = e.item;
    if (e.type === 'response.completed' && e.response?.status === 'completed') {
      return parseOutput(task,{...e.response,output:e.response.output?.length ? e.response.output : items.filter(Boolean)});
    }
  }
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 10000000) throw Error('oversize');
      buffer += value;
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0,end).replace(/\r$/,''); buffer = buffer.slice(end+1);
        if (!line) { const result = event(); if (result) return result; }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /,''));
      }
    }
    return Response.json({error:'套餐响应在完成前中断，请重试。'},{status:502});
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function runChatGPTPlan(body, {plan,callOpenAI = fetch,signal}) {
  const invalid = validateTask(body);
  if (invalid) return Response.json({error:invalid},{status:400});
  const auth = await plan.credentials();
  if (body.planAccount && body.planAccount !== auth.client) return Response.json({error:'套餐账号已切换，请刷新工坊后重试。'},{status:409});
  const models = await plan.models(auth);
  const model = body.model || models[0].id;
  if (!models.some(m => m.id === model)) return Response.json({error:'此账号的套餐模型清单已变更，请在设置中重新选择。'},{status:400});
  const {input,max_output_tokens:unusedLimit,...payload} = buildPayload({...body,model});
  payload.stream = true;
  payload.input = [{role:'user',content:input}];
  const timeout = AbortSignal.timeout(150000);
  try {
    const response = await callOpenAI('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
      headers:{Authorization:'Bearer '+auth.access,'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(payload)});
    if (!response.ok) return planError((await response.json().catch(() => ({}))).error,response.status);
    return await readCompleted(response,body.task);
  } catch {
    if (signal?.aborted) return Response.json({error:'本次创作已取消。'},{status:499});
    return Response.json({error:timeout.aborted ? '套餐服务响应超时。' : '无法完成套餐请求，请检查网络后重试。'},{status:timeout.aborted ? 504 : 502});
  }
}
