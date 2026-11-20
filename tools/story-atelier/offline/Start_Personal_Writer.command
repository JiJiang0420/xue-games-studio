#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo '请先安装 Node.js 24 LTS 或更新的 LTS 版本：https://nodejs.org/en/download'
  exit 1
fi
exec node start-personal.mjs
