import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { runOpenAI } from '../../../offline/openai-agent.mjs';

export const dynamic = 'force-dynamic';

const key = () => (env as unknown as Record<string,string>).OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
const authorized = async () => !!(await getChatGPTUser()) || import.meta.env.DEV;
const response = (body: object, status = 200) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});

export async function GET() {
  if (!await authorized()) return response({error:'请登录后使用创作服务。'},401);
  return response({configured:!!key(),provider:'OpenAI',version:'1.3'});
}

export async function POST(request: Request) {
  if (!await authorized()) return response({error:'请登录后使用创作服务。'},401);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return response({error:'不支持跨站生成请求。'},403);
  const apiKey = key();
  if (!apiKey) return response({error:'服务未配置 OpenAI 密钥。'},503);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 500000) return response({error:'创作上下文过大，请缩短资料或减少章节。'},413);
    body = JSON.parse(raw);
  } catch {
    return response({error:'创作请求需要有效的 JSON。'},400);
  }
  if (body?.billing === 'plan') return response({error:'请打开本机启动器使用 ChatGPT 套餐。'},409);
  return runOpenAI(body,{apiKey,signal:request.signal,callOpenAI:fetch});
}
