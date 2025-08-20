# 法律文件脱敏智能体 (Legal Document Anonymizer Agent)

🛡️ 基于 AI 的智能法律文件脱敏系统，支持自动识别和脱敏处理法律文档中的敏感信息。

## ✨ 项目特色

- 🤖 **双引擎架构**：简单版 REST API + LangChain 智能代理版
- 📄 **多格式支持**：PDF、Word 文档解析与处理
- 🔍 **智能识别**：身份证、手机号、邮箱、银行卡号、案号等敏感信息
- 🎨 **现代化界面**：React 前端，支持拖拽上传
- ⚙️ **灵活配置**：可自定义脱敏规则和参数
- 💬 **对话式交互**：LangChain 版本支持自然语言对话

## 🏗️ 系统架构

```
tm-agent/
├── backend/           # 后端服务
│   ├── main.py       # 简单版API服务 (端口8000)
│   ├── main_langchain.py  # LangChain智能代理 (端口8001)
│   ├── file_processor.py # 文件解析器
│   ├── rule_anonymizer.py # 脱敏规则引擎
│   ├── langchain_agent.py # LangChain代理
│   └── langchain_tools.py # LangChain工具集
├── frontend/         # React前端界面
│   ├── src/
│   │   ├── App.js   # 主应用组件
│   │   └── ...
│   └── package.json
└── demo_api_client.py # API使用演示
```

## 🚀 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 安装与运行

#### 1. 后端设置

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动简单版服务 (端口8000)
python main.py

# 或启动LangChain智能代理版 (端口8001)
python main_langchain.py
```

#### 2. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口3000)
npm start
```

#### 3. 访问应用

- 🌐 **Web界面**: http://localhost:3000
- 📚 **API文档**: 
  - 简单版: http://localhost:8000/docs
  - LangChain版: http://localhost:8001/docs
- 🔍 **健康检查**: http://localhost:8000/api/health

## 🔧 API 接口

### 简单版 API (端口8000)

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/upload` | POST | 上传文件并脱敏 |
| `/api/anonymize` | POST | 文本脱敏处理 |
| `/api/extract-entities` | POST | 提取敏感实体 |
| `/api/rules` | GET | 获取脱敏规则 |

### LangChain版 API (端口8001)

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/chat` | POST | 智能对话交互 |
| `/api/upload-and-process` | POST | 上传并智能处理 |
| `/api/download/{filename}` | GET | 下载脱敏文件 |
| `/api/conversation/{session_id}` | GET | 获取对话历史 |

## 📋 支持的脱敏规则

- **IDCARD**: 身份证号 (18位)
- **PHONE**: 手机号码 (11位)
- **EMAIL**: 电子邮箱地址
- **BANKCARD**: 银行卡号 (16-19位)
- **CASE_NUMBER**: 法院案号

## 🎯 使用示例

### Python API 调用

```python
import requests

# 文本脱敏
response = requests.post("http://localhost:8000/api/anonymize", json={
    "text": "张三的手机号是13812345678，身份证号110101199001011234",
    "enabled_rules": ["PHONE", "IDCARD"],
    "mask_char": "●"
})

# LangChain对话
response = requests.post("http://localhost:8001/api/chat", json={
    "message": "请帮我处理这个法律文档",
    "session_id": "my-session"
})
```

### 脱敏效果示例

**原始文本**:
```
张三，身份证号：110101199001011234，手机：13812345678
```

**脱敏后**:
```
张三，身份证号：11●●●●●●●●●●●●●●1234，手机：13●●●●●●●78
```

## 🔧 配置说明

### 脱敏参数配置

```json
{
  "enabled_rules": ["IDCARD", "PHONE", "EMAIL", "BANKCARD", "CASE_NUMBER"],
  "mask_char": "●",
  "keep_prefix": 2,
  "keep_suffix": 2
}
```

- `enabled_rules`: 启用的脱敏规则
- `mask_char`: 脱敏字符 (默认: ●)
- `keep_prefix`: 保留前缀字符数
- `keep_suffix`: 保留后缀字符数

## 📁 项目文件说明

### 核心文件

- `main.py` / `main_langchain.py`: API服务入口
- `file_processor.py`: 文档解析 (PDF/Word)
- `rule_anonymizer.py`: 脱敏规则引擎
- `langchain_agent.py`: LangChain智能代理
- `App.js`: React前端主组件

### 配置文件

- `requirements*.txt`: Python依赖
- `package.json`: Node.js依赖
- `.gitignore`: Git忽略规则

## 🛠️ 开发指南

### 添加新的脱敏规则

1. 在 `rule_anonymizer.py` 中定义正则表达式
2. 更新 `ALL_RULES` 字典
3. 在前端 `App.js` 中添加规则选项

### 扩展文件格式支持

1. 在 `file_processor.py` 中添加新的解析器
2. 更新 `extract_content` 方法
3. 在API中添加对应的MIME类型

## 🚀 部署建议

### Docker 部署

```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY backend/ ./backend/
COPY frontend/build/ ./static/

RUN pip install -r backend/requirements.txt

EXPOSE 8000
CMD ["python", "backend/main.py"]
```

### 生产环境配置

- 使用 `gunicorn` 或 `uvicorn` 作为 WSGI 服务器
- 配置 Nginx 反向代理
- 设置适当的环境变量和安全配置
- 启用HTTPS

## 📄 许可证

本项目基于 MIT 许可证开源。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 邮箱: [your-email@example.com]
- 🐛 问题反馈: [GitHub Issues]
- 📖 文档: [项目Wiki]

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！