from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiofiles
import os
from datetime import datetime
import uuid
from file_processor import FileProcessor
from rule_anonymizer import RuleAnonymizer, quick_extract, quick_anonymize
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

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

# 初始化文件处理器和脱敏器
file_processor = FileProcessor()
rule_anonymizer = RuleAnonymizer()


# 请求模型
class AnonymizeRequest(BaseModel):
    text: str
    enabled_rules: Optional[List[str]] = None
    mask_char: str = '*'
    keep_prefix: int = 2
    keep_suffix: int = 2


class ExtractRequest(BaseModel):
    text: str
    enabled_rules: Optional[List[str]] = None


class UploadConfigRequest(BaseModel):
    """文件上传脱敏配置"""
    enabled_rules: Optional[List[str]] = None
    mask_char: str = '●'
    keep_prefix: int = 2
    keep_suffix: int = 2

@app.get("/")
async def root():
    return {"message": "法律文件脱敏智能体 API"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), config: str = '{}'):
    """
    上传文件并提取内容，自动进行脱敏处理
    支持PDF和Word文档
    """
    try:
        # 解析脱敏配置
        try:
            import json
            config_dict = json.loads(config) if config else {}
            anonymize_config = {
                'enabled_rules': config_dict.get('enabled_rules'),
                'mask_char': config_dict.get('mask_char', '●'),
                'keep_prefix': config_dict.get('keep_prefix', 2),
                'keep_suffix': config_dict.get('keep_suffix', 2)
            }
        except:
            # 使用默认配置
            anonymize_config = {
                'enabled_rules': None,
                'mask_char': '●',
                'keep_prefix': 2,
                'keep_suffix': 2
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
        
        # 对提取的文本进行脱敏处理
        original_text = extracted_content["content"]
        try:
            # 创建脱敏器（根据配置）
            if anonymize_config['enabled_rules']:
                anonymizer = RuleAnonymizer(enabled_rules=set(anonymize_config['enabled_rules']))
            else:
                anonymizer = rule_anonymizer
            
            # 提取敏感实体
            sensitive_entities = anonymizer.extract_entities(original_text)
            
            # 执行脱敏处理
            anonymized_text, _ = anonymizer.anonymize_text(
                original_text,
                mask_char=anonymize_config['mask_char'],
                keep_prefix=anonymize_config['keep_prefix'],
                keep_suffix=anonymize_config['keep_suffix']
            )
            
            # 统计敏感信息
            entity_stats = {}
            for entity in sensitive_entities:
                entity_type = entity['type']
                if entity_type not in entity_stats:
                    entity_stats[entity_type] = 0
                entity_stats[entity_type] += 1
                
        except Exception as e:
            # 如果脱敏失败，使用原文本，但记录错误
            anonymized_text = original_text
            sensitive_entities = []
            entity_stats = {}
            print(f"脱敏处理警告: {str(e)}")
        
        # 返回结果
        result = {
            "file_id": file_id,
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content),
            "upload_time": datetime.now().isoformat(),
            "original_content": original_text,
            "anonymized_content": anonymized_text,
            "sensitive_entities": sensitive_entities,
            "entity_statistics": entity_stats,
            "metadata": extracted_content.get("metadata", {}),
            "anonymize_config": anonymize_config,
            "processing_info": {
                "original_length": len(original_text),
                "anonymized_length": len(anonymized_text),
                "entities_found": len(sensitive_entities),
                "entity_types": list(entity_stats.keys())
            },
            "message": f"成功提取并脱敏文件内容，原文 {len(original_text)} 字符，发现 {len(sensitive_entities)} 个敏感实体"
        }
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")
    finally:
        # 清理上传的文件
        if 'file_path' in locals() and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass  # 忽略删除失败

@app.post("/api/extract-entities")
async def extract_entities(request: ExtractRequest):
    """
    从文本中提取敏感实体
    """
    try:
        # 使用指定规则或默认规则
        entities = quick_extract(request.text, request.enabled_rules)
        
        return JSONResponse(content={
            "success": True,
            "entities": entities,
            "count": len(entities),
            "text_length": len(request.text),
            "enabled_rules": request.enabled_rules or list(rule_anonymizer.ALL_RULES),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"实体提取失败: {str(e)}")


@app.post("/api/anonymize")
async def anonymize_text(request: AnonymizeRequest):
    """
    对文本进行脱敏处理
    """
    try:
        # 创建自定义脱敏器（如果指定了规则）
        if request.enabled_rules:
            anonymizer = RuleAnonymizer(enabled_rules=set(request.enabled_rules))
        else:
            anonymizer = rule_anonymizer
        
        # 执行脱敏
        anonymized_text, entities = anonymizer.anonymize_text(
            request.text,
            mask_char=request.mask_char,
            keep_prefix=request.keep_prefix,
            keep_suffix=request.keep_suffix
        )
        
        return JSONResponse(content={
            "success": True,
            "original_text": request.text,
            "anonymized_text": anonymized_text,
            "entities": entities,
            "count": len(entities),
            "settings": {
                "mask_char": request.mask_char,
                "keep_prefix": request.keep_prefix,
                "keep_suffix": request.keep_suffix,
                "enabled_rules": request.enabled_rules or list(anonymizer.get_enabled_rules())
            },
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文本脱敏失败: {str(e)}")


@app.get("/api/rules")
async def get_rules_info():
    """
    获取所有支持的脱敏规则信息
    """
    return JSONResponse(content={
        "success": True,
        "supported_rules": list(rule_anonymizer.ALL_RULES),
        "enabled_rules": list(rule_anonymizer.get_enabled_rules()),
        "patterns": rule_anonymizer.get_pattern_info(),
        "timestamp": datetime.now().isoformat()
    })


@app.post("/api/validate-entity")
async def validate_entity(entity_text: str, entity_type: str):
    """
    验证实体格式是否正确
    """
    try:
        if entity_type not in rule_anonymizer.ALL_RULES:
            raise HTTPException(status_code=400, detail=f"不支持的实体类型: {entity_type}")
        
        is_valid = rule_anonymizer.validate_entity(entity_text, entity_type)
        
        return JSONResponse(content={
            "success": True,
            "entity_text": entity_text,
            "entity_type": entity_type,
            "is_valid": is_valid,
            "timestamp": datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"实体验证失败: {str(e)}")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
