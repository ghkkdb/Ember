@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."
set "TERRA_TEST_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined TERRA_TEST_NODE set "TERRA_TEST_NODE=%%N"
if not defined TERRA_TEST_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "TERRA_TEST_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined TERRA_TEST_NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "TERRA_TEST_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined TERRA_TEST_NODE if exist "D:\nodeV20.20.1\node.exe" set "TERRA_TEST_NODE=D:\nodeV20.20.1\node.exe"
if not defined TERRA_TEST_NODE (
    echo 未找到Node.js。请安装Node.js后重新运行本工具。
    pause
    exit /b 1
)
echo 正在启动泰拉兄弟测试台，请保留此窗口。
if /i "%~1"=="--check" (
    "%TERRA_TEST_NODE%" --version
    exit /b 0
)
"%TERRA_TEST_NODE%" tools/test-server.cjs --open
pause
