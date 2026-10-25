import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=new URL('./',import.meta.url);
let html=readFileSync(new URL('index.html',root),'utf8');
html=html.replace('<!--STYLE-->',()=>'<style>'+readFileSync(new URL('style.css',root),'utf8')+'</style>');
html=html.replace('<!--SCRIPT-->',()=>'<script>(()=>{'+readFileSync(new URL('knowledge.js',root),'utf8')+'\n'+readFileSync(new URL('app.js',root),'utf8')+'})();</script>');
mkdirSync(new URL('../public',root),{recursive:true});writeFileSync(new URL('../public/studio.html',root),html);
console.log('Built self-contained studio.html');
