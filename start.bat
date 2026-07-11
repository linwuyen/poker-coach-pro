@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist node_modules (
  echo 第一次執行，安裝相依套件中...
  call npm install
)

echo 啟動德州撲克 AI 教練 (http://localhost:3000)...
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
npm run dev
