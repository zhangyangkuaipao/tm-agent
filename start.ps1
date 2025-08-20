# 法律文件脱敏智能体 - Windows启动脚本
# PowerShell版本

Write-Host "法律文件脱敏智能体 - 启动脚本" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# 检查Python是否安装
Write-Host "检查Python环境..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python已安装: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python未正确安装"
    }
} catch {
    Write-Host "✗ 错误: 未找到Python，请先安装Python 3.8+" -ForegroundColor Red
    Write-Host "下载地址: https://www.python.org/downloads/" -ForegroundColor Cyan
    exit 1
}

# 检查Node.js是否安装
Write-Host "检查Node.js环境..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Node.js已安装: $nodeVersion" -ForegroundColor Green
    } else {
        throw "Node.js未正确安装"
    }
} catch {
    Write-Host "✗ 错误: 未找到Node.js，请先安装Node.js 16+" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

# 检查npm是否可用
Write-Host "检查npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ npm已安装: $npmVersion" -ForegroundColor Green
    } else {
        throw "npm未正确安装"
    }
} catch {
    Write-Host "✗ 错误: npm不可用" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 创建Python虚拟环境（如果不存在）
Write-Host "设置Python虚拟环境..." -ForegroundColor Yellow
if (-not (Test-Path "backend\venv")) {
    Write-Host "创建Python虚拟环境..." -ForegroundColor Cyan
    Set-Location backend
    python -m venv venv
    Set-Location ..
} else {
    Write-Host "✓ Python虚拟环境已存在" -ForegroundColor Green
}

# 激活虚拟环境并安装依赖
Write-Host "安装后端依赖..." -ForegroundColor Yellow
Set-Location backend
try {
    # 激活虚拟环境
    & ".\venv\Scripts\Activate.ps1"
    
    # 升级pip
    Write-Host "升级pip..." -ForegroundColor Cyan
    python -m pip install --upgrade pip
    
    # 安装依赖
    Write-Host "安装Python依赖包..." -ForegroundColor Cyan
    pip install -r requirements.txt
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 后端依赖安装完成" -ForegroundColor Green
    } else {
        throw "依赖安装失败"
    }
} catch {
    Write-Host "✗ 后端依赖安装失败: $_" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

# 安装前端依赖
Write-Host "安装前端依赖..." -ForegroundColor Yellow
if (-not (Test-Path "frontend\node_modules")) {
    Set-Location frontend
    try {
        Write-Host "安装npm依赖包..." -ForegroundColor Cyan
        npm install
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ 前端依赖安装完成" -ForegroundColor Green
        } else {
            throw "npm依赖安装失败"
        }
    } catch {
        Write-Host "✗ 前端依赖安装失败: $_" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
    Set-Location ..
} else {
    Write-Host "✓ 前端依赖已存在" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 依赖安装完成！" -ForegroundColor Green
Write-Host ""

# 创建启动脚本
Write-Host "创建启动脚本..." -ForegroundColor Yellow

# 创建启动后端的脚本
$backendScript = @"
@echo off
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
python main.py
pause
"@

# 创建启动前端的脚本
$frontendScript = @"
@echo off
cd /d "%~dp0frontend"
npm start
pause
"@

# 创建一键启动脚本
$startAllScript = @"
@echo off
echo 启动法律文件脱敏智能体...
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
echo.
echo 按任意键退出...
pause >nul
"@

# 保存脚本文件
$backendScript | Out-File -FilePath "start-backend.bat" -Encoding ASCII
$frontendScript | Out-File -FilePath "start-frontend.bat" -Encoding ASCII
$startAllScript | Out-File -FilePath "start-all.bat" -Encoding ASCII

Write-Host "✓ 启动脚本创建完成" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 启动方式:" -ForegroundColor Cyan
Write-Host "1. 一键启动所有服务: 双击 start-all.bat" -ForegroundColor White
Write-Host "2. 仅启动后端: 双击 start-backend.bat" -ForegroundColor White
Write-Host "3. 仅启动前端: 双击 start-frontend.bat" -ForegroundColor White
Write-Host ""

Write-Host "📱 访问地址:" -ForegroundColor Cyan
Write-Host "前端界面: http://localhost:3000" -ForegroundColor White
Write-Host "后端API: http://localhost:8000" -ForegroundColor White
Write-Host ""

Write-Host "💡 提示:" -ForegroundColor Cyan
Write-Host "- 首次启动可能需要几分钟时间" -ForegroundColor White
Write-Host "- 确保端口8000和3000未被占用" -ForegroundColor White
Write-Host "- 如遇问题，请检查防火墙设置" -ForegroundColor White
Write-Host ""

Write-Host "是否现在启动所有服务？(Y/N)" -ForegroundColor Yellow
$response = Read-Host

if ($response -eq "Y" -or $response -eq "y" -or $response -eq "是") {
    Write-Host "启动所有服务..." -ForegroundColor Green
    & ".\start-all.bat"
} else {
    Write-Host "您可以选择手动启动，或稍后双击 start-all.bat 文件" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "脚本执行完成！" -ForegroundColor Green
