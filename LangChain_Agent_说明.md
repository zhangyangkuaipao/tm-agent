# LangChain 法律文件脱敏智能体

## 概述

这是一个基于 LangChain 框架重构的法律文件脱敏智能体，提供智能化的文档处理和敏感信息脱敏功能。

## 架构特点

### 🤖 智能体角色
- **身份**: 法律文件脱敏智能体
- **框架**: LangChain + FastAPI
- **语言模型**: 支持 OpenAI GPT 或虚拟LLM（演示用）

### 🛠️ 可调用工具

1. **parse_document(file_path)** - 文档解析工具
   - 支持 PDF、Word 文档
   - 提取文本内容和元数据

2. **rule_anonymizer(text, enabled_rules)** - 敏感实体识别工具
   - 身份证号 (IDCARD)
   - 手机号 (PHONE) 
   - 邮箱地址 (EMAIL)
   - 银行卡号 (BANKCARD)
   - 案号 (CASE_NUMBER)

3. **replace_text(text, mapped_entities, mask_char, keep_prefix, keep_suffix)** - 文本脱敏工具
   - 可配置遮罩字符
   - 可设置保留前后缀长度

4. **export_file(content, filename, export_dir)** - 文件导出工具
   - 导出脱敏后的文档
   - 自动生成时间戳文件名

## 📋 Agent 任务流

当用户上传文件时，Agent 自动执行以下步骤：

```
1. 调用 parse_document → 解析文档内容
2. 调用 rule_anonymizer → 识别敏感实体  
3. 调用 replace_text → 生成脱敏文本
4. 调用 export_file → 导出结果文件
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd tm-agent/backend
pip install -r requirements-langchain.txt
```

### 2. 启动服务

**Windows:**
```bash
# 运行启动脚本
../start-langchain.bat
```

**手动启动:**
```bash
cd tm-agent/backend
python main_langchain.py
```

### 3. 访问服务

- **API 服务**: http://localhost:8001
- **API 文档**: http://localhost:8001/docs
- **健康检查**: http://localhost:8001/api/health

## 📚 API 接口

### 核心接口

#### 1. 文件上传处理
```
POST /api/upload-and-process
```
上传文件并自动执行完整脱敏流程

**参数:**
- `file`: 上传的文件 (PDF/Word)
- `config`: 脱敏配置 (JSON字符串)

**配置示例:**
```json
{
  "enabled_rules": ["IDCARD", "PHONE", "EMAIL"],
  "mask_char": "●",
  "keep_prefix": 2,
  "keep_suffix": 2
}
```

#### 2. 智能体对话
```
POST /api/chat
```
与智能体进行对话交互

**请求体:**
```json
{
  "message": "你好，我想处理一个法律文档",
  "session_id": "可选的会话ID"
}
```

#### 3. 文档处理
```
POST /api/process-document
```
处理指定路径的文档

#### 4. 文件下载
```
GET /api/download/{filename}
```
下载导出的脱敏文件

### 辅助接口

- `GET /api/tools` - 获取可用工具列表
- `GET /api/export-list` - 列出已导出的文件
- `GET /api/conversation/{session_id}` - 获取会话历史
- `DELETE /api/conversation/{session_id}` - 清除会话历史

## 🧪 测试与演示

### 运行测试脚本

```bash
cd tm-agent/backend
python test_langchain_agent.py
```

测试包括：
1. 对话功能测试
2. 工具功能测试  
3. 完整文档处理流程测试
4. API 调用模拟测试

### 示例使用

#### 示例 1: 文档脱敏
```python
import asyncio
from langchain_agent import anonymizer_agent

async def process_doc():
    config = {
        "enabled_rules": ["IDCARD", "PHONE"],
        "mask_char": "●",
        "keep_prefix": 2,
        "keep_suffix": 2
    }
    
    result = await anonymizer_agent.process_document(
        "path/to/document.pdf", 
        config
    )
    
    if result["success"]:
        print(f"处理完成，导出文件: {result['export_info']['export_path']}")
    else:
        print(f"处理失败: {result['error']}")

asyncio.run(process_doc())
```

#### 示例 2: 对话交互
```python
import asyncio
from langchain_agent import anonymizer_agent

async def chat_example():
    response = await anonymizer_agent.chat("请帮我处理一个法律合同")
    print(response)

asyncio.run(chat_example())
```

## 🔧 配置选项

### 脱敏规则
- `IDCARD` - 身份证号码
- `PHONE` - 手机号码
- `EMAIL` - 邮箱地址
- `BANKCARD` - 银行卡号
- `CASE_NUMBER` - 法院案号

### 脱敏参数
- `mask_char` - 遮罩字符，默认 "●"
- `keep_prefix` - 保留前缀字符数，默认 2
- `keep_suffix` - 保留后缀字符数，默认 2

### 示例效果
```
原文: 13812345678
脱敏: 13●●●●●●78
```

## 📁 文件结构

```
tm-agent/backend/
├── langchain_tools.py      # LangChain 工具定义
├── langchain_agent.py      # 智能体主逻辑
├── main_langchain.py       # FastAPI 应用
├── test_langchain_agent.py # 测试脚本
├── requirements-langchain.txt # LangChain 依赖
├── file_processor.py       # 文件处理器 (复用)
├── rule_anonymizer.py      # 脱敏规则 (复用)
├── uploads/               # 上传文件目录
└── exports/              # 导出文件目录
```

## 🔄 与原版本对比

| 特性 | 原版本 | LangChain 版本 |
|------|--------|----------------|
| 架构 | FastAPI + 自定义逻辑 | LangChain + FastAPI |
| 交互方式 | REST API | REST API + 对话交互 |
| 工具化 | 函数调用 | LangChain Tools |
| 工作流 | 手动编排 | Agent 自动执行 |
| 扩展性 | 中等 | 高 (工具可插拔) |
| 会话管理 | 无 | 支持多会话 |

## 🛡️ 注意事项

1. **生产环境使用**: 当前使用虚拟 LLM，生产环境请配置真实的语言模型 API
2. **文件安全**: 上传的文件会被临时保存后删除，导出文件保存在 `exports` 目录
3. **会话管理**: 会话信息存储在内存中，服务重启后会丢失
4. **性能考虑**: 大文件处理可能需要较长时间，建议添加进度指示

## 🤝 扩展开发

### 添加新工具

1. 在 `langchain_tools.py` 中定义新的工具函数
2. 使用 `@tool` 装饰器标记
3. 将工具添加到 `ANONYMIZER_TOOLS` 列表
4. 更新 Agent 的系统提示

### 自定义语言模型

修改 `langchain_agent.py` 中的模型配置：

```python
# 使用 OpenAI
self.llm = ChatOpenAI(
    model="gpt-4",
    temperature=0,
    openai_api_key="your-api-key"
)

# 使用其他模型
from langchain_community.llms import Ollama
self.llm = Ollama(model="llama2")
```

## 📄 许可证

本项目基于原有项目协议进行开发和分发。
