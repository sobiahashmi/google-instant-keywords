@echo off
rem Starts Google Instant Keywords. Double-click this file to use the tool.
rem The page opens by itself at http://localhost:3000 (or the PORT set in the .env file).

title Google Instant Keywords
cd /d "%~dp0"

rem Read PORT from .env (default 3000).
set "PORT=3000"
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if /i "%%A"=="PORT" set "PORT=%%B"
  )
)
set "PORT=%PORT: =%"

rem Node.js must be installed first (https://nodejs.org, the LTS version).
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Please install the LTS version from https://nodejs.org
  echo then double-click start.bat again.
  echo.
  pause
  exit /b 1
)

rem The first time only: download everything the tool needs (takes a few minutes).
if not exist "node_modules" (
  echo First start: installing the tool. This takes a few minutes, please wait...
  call npm install
  if errorlevel 1 (
    echo.
    echo The installation did not finish. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

rem Stop with a clear message if the port is already taken, instead of using another one.
netstat -ano | findstr /r /c:"TCP.*:%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo Port %PORT% is busy: another program is already using it.
  echo If the tool is already running in another window, just open http://localhost:%PORT%
  echo Otherwise close the other program, or choose a different port in the .env file, for example PORT=3001
  echo.
  pause
  exit /b 1
)

echo Starting Google Instant Keywords on port %PORT%...
call npm start

rem Keep this window open so any message stays readable.
pause
