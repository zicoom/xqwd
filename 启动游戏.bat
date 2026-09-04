@echo off
REM 双击这个文件即可启动本地游戏服务器。
REM 请保持这个黑色窗口开启；关闭窗口就等于停止游戏服务器。
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=9000"
start "" "http://localhost:%PORT%"
node server.cjs
pause
