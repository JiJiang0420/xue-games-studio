import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const origin='https://xue-games-studio.xxhhxpg.chatgpt.site';
const out='dist';
await import('./build-learning.mjs');
const offline=process.argv.includes('--offline');
let data;
if(offline)data=JSON.parse(await fs.readFile('content/site.json','utf8'));
else{
 const response=await fetch(origin+'/content.js',{signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok)throw Error('后台公开内容暂时无法读取：HTTP '+response.status);
 const text=await response.text(),prefix='window.siteContent = ';
 if(!text.startsWith(prefix)||!text.trimEnd().endsWith(';'))throw Error('后台返回了非内容页面，保留已有公开版本');
 data=JSON.parse(text.slice(prefix.length).trim().slice(0,-1));
}
if(!data.settings||!Array.isArray(data.games)||!Array.isArray(data.posts)||!data.music||!data.donation)throw Error('网站内容不完整，停止发布');
// Defense in depth: deploy only public records, even for the offline snapshot.
data.games=data.games.filter(g=>g.published===true);
data.posts=data.posts.filter(p=>p.published===true);
data.music.tracks=data.music.tracks.filter(t=>t.published===true);
data.donation.channels=data.donation.enabled?data.donation.channels.filter(c=>c.published===true):[];
await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const entry of await fs.readdir('public',{withFileTypes:true})){
 if(entry.name.startsWith('admin.')||entry.name==='content.js')continue;
 await fs.cp(path.join('public',entry.name),path.join(out,entry.name),{recursive:true});
}
const media=new Map();
async function localize(value){
 if(!value)return value;
 if(/^\/?assets\/[\w.-]+$/.test(value))return value.replace(/^\//,'');
 if(!/^\/media\/[a-f0-9-]+\.(png|jpg|webp|gif|mp3|wav|ogg|m4a)$/.test(value))return value;
 if(media.has(value))return media.get(value);
 const response=await fetch(origin+value,{signal:AbortSignal.timeout(60000),redirect:'error'});
 if(!response.ok||!(/^(image|audio)\//.test(response.headers.get('content-type')||'')))throw Error('公开媒体无法读取：'+value);
 if(Number(response.headers.get('content-length'))>26*1024*1024)throw Error('媒体超过大小限制');
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>26*1024*1024)throw Error('媒体超过大小限制');
 const relative=value.slice(1);await fs.mkdir(path.dirname(path.join(out,relative)),{recursive:true});await fs.writeFile(path.join(out,relative),bytes);media.set(value,relative);return relative;
}
for(const game of data.games)game.image=await localize(game.image);
for(const track of data.music.tracks)track.src=await localize(track.src);
for(const channel of data.donation.channels)channel.image=await localize(channel.image);
await fs.writeFile(path.join(out,'content.js'),'window.siteAdminUrl = '+JSON.stringify(origin+'/admin')+';\nwindow.siteContent = '+JSON.stringify(data).replace(/</g,'\\u003c')+';\n');
await fs.writeFile(path.join(out,'.nojekyll'),'');
await fs.mkdir(path.join(out,'admin'),{recursive:true});
await fs.writeFile(path.join(out,'admin/index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${origin}/admin"><title>打开管理后台</title><a href="${origin}/admin">打开管理后台</a></html>`);
// Stable signature lets scheduled syncs skip publishing when nothing changed.
const hash=crypto.createHash('sha256');
async function digest(dir){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name);if(entry.isDirectory())await digest(file);else{hash.update(file);hash.update(await fs.readFile(file));}}}
await digest(out);const contentHash=hash.digest('hex');
await fs.writeFile(path.join(out,'build.json'),JSON.stringify({contentHash,updatedAt:new Date().toISOString()})+'\n');
let changed=true;
const live='https://jijiang0420.github.io/xue-games-studio/build.json';
if(process.env.GITHUB_EVENT_NAME==='schedule'){try{const r=await fetch(live,{cache:'no-store',signal:AbortSignal.timeout(10000)});if(r.ok)changed=(await r.json()).contentHash!==contentHash;}catch{}}
if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);
console.log(`Pages ready: ${data.games.length} games, ${data.posts.length} posts, ${data.music.tracks.length} music tracks; ${media.size} uploaded files mirrored; changed=${changed}`);
