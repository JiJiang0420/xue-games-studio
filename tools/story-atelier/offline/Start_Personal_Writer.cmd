@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 首次使用请先安装 Node.js 24 LTS 或更新的 LTS 版本。
  echo 官方下载：https://nodejs.org/en/download
  echo 安装后关闭本窗口，再双击启动器。
  pause
  exit /b 1
)
node "start-personal.mjs"
if errorlevel 1 pause
