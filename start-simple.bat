@echo off
chcp 65001 >nul
title 法律文件脱敏智能体 - 启动脚本

echo.
echo ========================================
echo    法律文件脱敏智能体 - 启动脚本
echo ========================================
echo.

echo 正在检查环境...
echo.

REM 检查Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Python，请先安装Python 3.8+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo [✓] Python已安装

REM 检查Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Node.js，请先安装Node.js 16+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo [✓] Node.js已安装

echo.
echo 正在设置环境...
echo.

REM 创建Python虚拟环境
if not exist "backend\venv" (
    echo 创建Python虚拟环境...
    cd backend
    python -m venv venv
    cd ..
)

REM 安装后端依赖
echo 安装后端依赖...
cd backend
call venv\Scripts\activate.bat
pip install -r requirements.txt
cd ..

REM 安装前端依赖
if not exist "frontend\node_modules" (
    echo 安装前端依赖...
    cd frontend
    npm install
    cd ..
)

echo.
echo [✓] 环境设置完成！
echo.

echo 选择启动方式:
echo 1. 启动所有服务
echo 2. 仅启动后端
echo 3. 仅启动前端
echo 4. 退出
echo.
set /p choice=请输入选择 (1-4): 

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto end
goto invalid

:start_all
echo.
echo 启动所有服务...
echo.
echo 启动后端服务器...
start "后端服务器" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate.bat && python main.py"
echo 等待后端启动...
timeout /t 3 /nobreak >nul
echo 启动前端服务器...
start "前端服务器" cmd /k "cd /d "%~dp0frontend" && npm start"
echo.
echo 服务启动完成！
echo 前端地址: http://localhost:3000
echo 后端地址: http://localhost:8000
goto end

:start_backend
echo.
echo 启动后端服务器...
cd backend
call venv\Scripts\activate.bat
python main.py
cd ..
goto end

:start_frontend
echo.
echo 启动前端服务器...
cd frontend
npm start
cd ..
goto end

:invalid
echo.
echo 无效选择，请重新运行脚本
goto end

:end
echo.
echo 按任意键退出...
pause >nul
