@echo off
chcp 65001 >nul
setlocal
set NODE=D:\Programs\Xiaomi MiMo\resources\runtimes\win32-x64\node\node.exe
set ROOT=D:\tj\822\考研题库
if not exist "%NODE%" set NODE=node

rem 若 8765 已在监听则不再重复启动
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://127.0.0.1:8765/' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if %ERRORLEVEL%==0 goto open

start "kaoyan-note-server" /MIN "%NODE%" "%ROOT%\最终笔记\_serve.js"
timeout /t 2 /nobreak >nul

:open
start "" "http://127.0.0.1:8765/%E6%9C%80%E7%BB%88%E7%AC%94%E8%AE%B0/index.html"
endlocal
