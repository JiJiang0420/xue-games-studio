#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js 22.13 或更新版本，再打开此启动器。'
  exit 1
fi
exec node local-writer.mjs --open
