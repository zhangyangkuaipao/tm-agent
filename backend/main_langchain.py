"""
基于 LangChain 的法律文件脱敏智能体 FastAPI 应用
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import aiofiles
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import json

from langchain_agent import anonymizer_agent, LegalDocumentAnonymizerAgent
from langchain_tools import _tools_instance

# 创建 FastAPI 应用
app = FastAPI(
    title="LangChain 法律文件脱敏智能体",
    description="基于 LangChain 框架的智能法律文件脱敏系统",
    version="2.0.0"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保必要目录存在
UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# 挂载静态文件服务（用于下载导出的文件）
app.mount("/exports", StaticFiles(directory=EXPORT_DIR), name="exports")

# 请求模型
class ChatRequest(BaseModel):
    """聊天请求模型"""
    message: str
    session_id: Optional[str] = None

class AnonymizeConfig(BaseModel):
    """脱敏配置模型"""
    enabled_rules: Optional[List[str]] = None
    mask_char: str = "●"
    keep_prefix: int = 2
    keep_suffix: int = 2

class ProcessRequest(BaseModel):
    """处理请求模型"""
    file_path: str
    config: Optional[AnonymizeConfig] = None

# 用于存储会话
sessions: Dict[str, LegalDocumentAnonymizerAgent] = {}

def get_or_create_session(session_id: Optional[str] = None) -> str:
    """获取或创建会话"""
    if not session_id:
        session_id = str(uuid.uuid4())
    
    if session_id not in sessions:
        sessions[session_id] = LegalDocumentAnonymizerAgent(use_fake_llm=True)
    
    return session_id

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "LangChain 法律文件脱敏智能体 API",
        "version": "2.0.0",
        "framework": "LangChain + FastAPI",
        "capabilities": [
            "文档解析 (PDF, Word)",
            "敏感实体识别",
            "智能脱敏处理", 
            "文件导出",
            "对话交互"
        ]
    }

@app.post("/api/chat")
async def chat_with_agent(request: ChatRequest):
    """与智能体对话"""
    try:
        session_id = get_or_create_session(request.session_id)
        agent = sessions[session_id]
        
        # 获取智能体回复
        response = await agent.chat(request.message)
        
        return JSONResponse(content={
            "success": True,
            "response": response,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"对话失败: {str(e)}")

@app.post("/api/upload-and-process")
async def upload_and_process(
    file: UploadFile = File(...),
    config: str = Form("{}")
):
    """上传文件并使用 Agent 处理"""
    try:
        # 解析配置
        try:
            config_dict = json.loads(config) if config else {}
            anonymize_config = {
                "enabled_rules": config_dict.get("enabled_rules"),
                "mask_char": config_dict.get("mask_char", "●"),
                "keep_prefix": config_dict.get("keep_prefix", 2),
                "keep_suffix": config_dict.get("keep_suffix", 2)
            }
        except json.JSONDecodeError:
            anonymize_config = {
                "enabled_rules": None,
                "mask_char": "●",
                "keep_prefix": 2,
                "keep_suffix": 2
            }
        
        # 检查文件类型
        allowed_types = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "application/msword": ".doc"
        }
        
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型。支持的类型: PDF, Word文档"
            )
        
        # 保存上传的文件
        file_id = str(uuid.uuid4())
        file_extension = allowed_types.get(file.content_type, "")
        filename = f"{file_id}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        try:
            # 使用 Agent 处理文档
            result = await anonymizer_agent.process_document(file_path, anonymize_config)
            
            # 添加文件信息
            result.update({
                "file_info": {
                    "original_name": file.filename,
                    "file_id": file_id,
                    "content_type": file.content_type,
                    "size": len(content),
                    "upload_time": datetime.now().isoformat()
                }
            })
            
            return JSONResponse(content=result)
            
        finally:
            # 清理上传的临时文件
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass  # 忽略删除失败
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")

@app.post("/api/process-document")
async def process_document(request: ProcessRequest):
    """处理指定路径的文档"""
    try:
        # 检查文件是否存在
        if not os.path.exists(request.file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 转换配置
        config_dict = request.config.dict() if request.config else {}
        
        # 使用 Agent 处理文档
        result = await anonymizer_agent.process_document(request.file_path, config_dict)
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """下载导出的文件"""
    file_path = os.path.join(EXPORT_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        file_path,
        media_type='application/octet-stream',
        filename=filename
    )

@app.get("/api/conversation/{session_id}")
async def get_conversation(session_id: str):
    """获取会话历史"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    agent = sessions[session_id]
    history = agent.get_conversation_history()
    
    return JSONResponse(content={
        "success": True,
        "session_id": session_id,
        "conversation": history,
        "timestamp": datetime.now().isoformat()
    })

@app.delete("/api/conversation/{session_id}")
async def clear_conversation(session_id: str):
    """清除会话历史"""
    if session_id in sessions:
        sessions[session_id].clear_memory()
        return JSONResponse(content={
            "success": True,
            "message": "会话历史已清除",
            "session_id": session_id
        })
    else:
        raise HTTPException(status_code=404, detail="会话不存在")

@app.get("/api/tools")
async def get_available_tools():
    """获取可用的工具列表"""
    return JSONResponse(content={
        "success": True,
        "tools": [
            {
                "name": "parse_document",
                "description": "解析文档并提取文本内容",
                "parameters": ["file_path"]
            },
            {
                "name": "rule_anonymizer", 
                "description": "识别文本中的敏感实体",
                "parameters": ["text", "enabled_rules"]
            },
            {
                "name": "replace_text",
                "description": "对文本进行脱敏处理",
                "parameters": ["text", "mapped_entities", "mask_char", "keep_prefix", "keep_suffix"]
            },
            {
                "name": "export_file",
                "description": "导出脱敏后的文件",
                "parameters": ["content", "filename", "export_dir"]
            }
        ],
        "supported_rules": [
            "IDCARD",      # 身份证号
            "PHONE",       # 手机号
            "EMAIL",       # 邮箱
            "BANKCARD",    # 银行卡号
            "CASE_NUMBER"  # 案号
        ]
    })

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "framework": "LangChain + FastAPI",
        "agent_status": "active",
        "timestamp": datetime.now().isoformat(),
        "sessions_count": len(sessions)
    }

@app.get("/api/export-list")
async def list_exported_files():
    """列出已导出的文件"""
    try:
        files = []
        if os.path.exists(EXPORT_DIR):
            for filename in os.listdir(EXPORT_DIR):
                file_path = os.path.join(EXPORT_DIR, filename)
                if os.path.isfile(file_path):
                    stat = os.stat(file_path)
                    files.append({
                        "filename": filename,
                        "size": stat.st_size,
                        "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "download_url": f"/api/download/{filename}"
                    })
        
        return JSONResponse(content={
            "success": True,
            "files": files,
            "count": len(files)
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
