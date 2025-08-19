#!/bin/bash

echo "法律文件脱敏智能体 - 启动脚本"
echo "================================"

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到Python3，请先安装Python 3.8+"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js 16+"
    exit 1
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "backend/venv" ]; then
    echo "创建Python虚拟环境..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# 激活虚拟环境并安装依赖
echo "安装后端依赖..."
cd backend
source venv/bin/activate
pip install -r requirements.txt
cd ..

# 安装前端依赖
if [ ! -d "frontend/node_modules" ]; then
    echo "安装前端依赖..."
    cd frontend
    npm install
    cd ..
fi

echo ""
echo "依赖安装完成！"
echo ""
echo "启动服务:"
echo "1. 启动后端服务器: cd backend && source venv/bin/activate && python main.py"
echo "2. 启动前端服务器: cd frontend && npm start"
echo ""
echo "访问地址: http://localhost:3000"
echo ""
