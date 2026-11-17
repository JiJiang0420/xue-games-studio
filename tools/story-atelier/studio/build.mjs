import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const files = ['knowledge.js', 'branches.js', 'clue-editor.js', 'reader.js', 'writing.js', 'writing-editor.js', 'app.js'];
const sample = JSON.stringify(JSON.parse(read('../examples/story/Clue_Counter.json')))
  .replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const script = 'const CLUE_EXAMPLE = ' + sample + ';\n' + files.map(read).join('\n');
const html = read('index.html')
  .replace('<!--STYLE-->', () => '<style>' + read('style.css') + '</style>')
  .replace('<!--SCRIPT-->', () => '<script>(() => {\n' + script + '\n})();</script>');

for (const path of ['../public/studio.html', '../offline/Story_Atelier_Offline.html']) {
  const dest = new URL(path, import.meta.url);
  mkdirSync(new URL('./', dest), { recursive: true });
  writeFileSync(dest, html);
}
console.log('已生成工作台和离线编辑版');
