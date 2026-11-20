// Check the runtime before importing modules that require modern Node.js.
const [major,minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('当前 Node.js 版本为 ' + process.versions.node + '，请安装 Node.js 24 LTS 或更新的 LTS 版本，再重新启动。');
  console.error('官方下载：https://nodejs.org/en/download');
  process.exitCode = 1;
} else {
  try {
    const {startLocalWriter} = await import('./local-writer.mjs');
    if (process.argv.includes('--check')) console.log('本地版运行检查通过，Node.js ' + process.versions.node + '。');
    else await startLocalWriter({personal:true,openBrowser:!process.argv.includes('--no-open')});
  } catch (error) {
    console.error('叙事工坊未能启动：' + error.message);
    process.exitCode = 1;
  }
}
