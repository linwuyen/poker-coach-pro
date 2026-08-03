@echo off
setlocal
cd /d "%~dp0"
set "APP_PORT=3000"
for /f "usebackq tokens=*" %%P in (`powershell.exe -NoProfile -Command "$lines = @(Get-Content '.env' -ErrorAction SilentlyContinue); $portLine = @($lines -match '^PORT=')[0]; if ($portLine) { (($portLine -replace '^PORT=', '').Trim()).Trim([char]34) } else { '3000' }"`) do set "APP_PORT=%%P"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not available in PATH.
  echo Repair or reinstall Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies. This is only needed the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed. Check the error above.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', %APP_PORT%); exit 0 } catch { exit 1 } finally { $client.Dispose() }"
if not errorlevel 1 (
  echo Poker Coach Pro is already running at http://localhost:%APP_PORT% .
  start "" "http://localhost:%APP_PORT%"
  endlocal
  exit /b 0
)

echo Starting Poker Coach Pro at http://localhost:%APP_PORT% ...
echo Close this window or press Ctrl+C to stop the server.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%APP_PORT%'"
call npm run dev

if errorlevel 1 (
  echo.
  echo The server stopped because of an error. Check the message above.
  pause
)

endlocal
