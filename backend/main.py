from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiofiles
import os
from datetime import datetime
import uuid
from file_processor import FileProcessor
from typing import Dict, Any

app = FastAPI(title="法律文件脱敏智能体", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保上传目录存在
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 初始化文件处理器
file_processor = FileProcessor()

@app.get("/")
async def root():
    return {"message": "法律文件脱敏智能体 API"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件并提取内容
    支持PDF和Word文档
    """
    try:
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
        
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        file_extension = allowed_types.get(file.content_type, "")
        filename = f"{file_id}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 保存文件
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # 提取文件内容
        try:
            extracted_content = await file_processor.extract_content(file_path, file.content_type)
        except Exception as e:
            # 删除已保存的文件
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=500, detail=f"文件内容提取失败: {str(e)}")
        
        # 返回结果
        result = {
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "upload_time": datetime.now().isoformat(),
            "content": extracted_content["content"],
            "metadata": extracted_content.get("metadata", {}),
            "message": f"成功提取文件内容，共 {len(extracted_content['content'])} 个字符"
        }
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
