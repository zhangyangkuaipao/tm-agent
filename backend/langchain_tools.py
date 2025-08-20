"""
LangChain 工具模块
为法律文件脱敏智能体提供可调用的工具
"""

from langchain.tools import tool
from typing import Dict, List, Any, Optional, Union
from file_processor import FileProcessor
from rule_anonymizer import RuleAnonymizer
import json
import os
import aiofiles
from datetime import datetime


class DocumentAnonymizerTools:
    """法律文件脱敏工具类"""
    
    def __init__(self):
        self.file_processor = FileProcessor()
        self.rule_anonymizer = RuleAnonymizer()
    
    async def parse_document(self, file_path: str) -> Dict[str, Any]:
        """
        解析文档并提取文本内容
        
        Args:
            file_path: 文档文件路径
            
        Returns:
            Dict: 包含提取的文本内容和元数据
        """
        try:
            # 根据文件扩展名确定内容类型
            file_ext = os.path.splitext(file_path)[1].lower()
            content_type_map = {
                '.pdf': 'application/pdf',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.doc': 'application/msword'
            }
            
            content_type = content_type_map.get(file_ext)
            if not content_type:
                raise ValueError(f"不支持的文件类型: {file_ext}")
            
            # 提取文档内容
            result = await self.file_processor.extract_content(file_path, content_type)
            
            return {
                "success": True,
                "content": result["content"],
                "metadata": result["metadata"],
                "file_path": file_path,
                "content_type": content_type,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "file_path": file_path,
                "timestamp": datetime.now().isoformat()
            }
    
    def rule_anonymizer_extract(self, text: str, enabled_rules: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        使用规则提取敏感实体
        
        Args:
            text: 输入文本
            enabled_rules: 启用的规则列表
            
        Returns:
            Dict: 包含提取的实体列表
        """
        try:
            # 创建脱敏器实例
            if enabled_rules:
                anonymizer = RuleAnonymizer(enabled_rules=set(enabled_rules))
            else:
                anonymizer = self.rule_anonymizer
            
            # 提取敏感实体
            entities = anonymizer.extract_entities(text)
            
            # 统计实体类型
            entity_stats = {}
            for entity in entities:
                entity_type = entity['type']
                entity_stats[entity_type] = entity_stats.get(entity_type, 0) + 1
            
            return {
                "success": True,
                "entities": entities,
                "entity_count": len(entities),
                "entity_statistics": entity_stats,
                "enabled_rules": enabled_rules or list(anonymizer.get_enabled_rules()),
                "text_length": len(text),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "text_length": len(text) if text else 0,
                "timestamp": datetime.now().isoformat()
            }
    
    def replace_text(self, text: str, mapped_entities: List[Dict], 
                    mask_char: str = "●", keep_prefix: int = 2, 
                    keep_suffix: int = 2) -> Dict[str, Any]:
        """
        根据映射的实体替换文本进行脱敏
        
        Args:
            text: 原始文本
            mapped_entities: 实体映射列表
            mask_char: 遮罩字符
            keep_prefix: 保留前缀字符数
            keep_suffix: 保留后缀字符数
            
        Returns:
            Dict: 包含脱敏后的文本
        """
        try:
            if not mapped_entities:
                return {
                    "success": True,
                    "masked_text": text,
                    "original_text": text,
                    "entities_processed": 0,
                    "timestamp": datetime.now().isoformat()
                }
            
            # 从后往前替换，避免位置偏移
            masked_text = text
            entities_sorted = sorted(mapped_entities, key=lambda x: x.get("start", 0), reverse=True)
            
            processed_count = 0
            for entity in entities_sorted:
                if not all(key in entity for key in ["start", "end", "original"]):
                    continue
                    
                start, end = entity["start"], entity["end"]
                original = entity["original"]
                
                # 计算脱敏规则
                if len(original) <= keep_prefix + keep_suffix:
                    # 如果字符串太短，全部用遮罩字符
                    masked = mask_char * len(original)
                else:
                    # 保留前缀和后缀，中间用遮罩字符
                    prefix = original[:keep_prefix]
                    suffix = original[-keep_suffix:] if keep_suffix > 0 else ""
                    middle_length = len(original) - keep_prefix - keep_suffix
                    masked = prefix + mask_char * middle_length + suffix
                
                # 替换文本
                masked_text = masked_text[:start] + masked + masked_text[end:]
                processed_count += 1
            
            return {
                "success": True,
                "masked_text": masked_text,
                "original_text": text,
                "entities_processed": processed_count,
                "mask_settings": {
                    "mask_char": mask_char,
                    "keep_prefix": keep_prefix,
                    "keep_suffix": keep_suffix
                },
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "original_text": text,
                "entities_processed": 0,
                "timestamp": datetime.now().isoformat()
            }
    
    async def export_file(self, content: str, filename: str, export_dir: str = "exports") -> Dict[str, Any]:
        """
        导出脱敏后的内容到文件
        
        Args:
            content: 要导出的内容
            filename: 文件名
            export_dir: 导出目录
            
        Returns:
            Dict: 导出结果信息
        """
        try:
            # 确保导出目录存在
            os.makedirs(export_dir, exist_ok=True)
            
            # 生成唯一文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            name, ext = os.path.splitext(filename)
            if not ext:
                ext = ".txt"
            
            export_filename = f"{name}_anonymized_{timestamp}{ext}"
            export_path = os.path.join(export_dir, export_filename)
            
            # 写入文件
            async with aiofiles.open(export_path, 'w', encoding='utf-8') as f:
                await f.write(content)
            
            return {
                "success": True,
                "export_path": export_path,
                "export_filename": export_filename,
                "file_size": len(content.encode('utf-8')),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


# 创建全局工具实例
_tools_instance = DocumentAnonymizerTools()

# 定义 LangChain 工具
@tool
async def parse_document(file_path: str) -> Dict[str, Any]:
    """
    解析文档文件并提取文本内容
    
    参数:
    - file_path: 文档文件的路径
    
    返回: 包含文本内容和元数据的字典
    """
    return await _tools_instance.parse_document(file_path)


@tool 
def rule_anonymizer(text: str, enabled_rules: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    使用规则从文本中提取敏感实体
    
    参数:
    - text: 要分析的文本内容
    - enabled_rules: 启用的规则列表，如 ['IDCARD', 'PHONE', 'EMAIL']
    
    返回: 包含敏感实体列表的字典
    """
    return _tools_instance.rule_anonymizer_extract(text, enabled_rules)


@tool
def replace_text(text: str, mapped_entities: str, mask_char: str = "●", 
                keep_prefix: int = 2, keep_suffix: int = 2) -> Dict[str, Any]:
    """
    根据实体映射替换文本进行脱敏处理
    
    参数:
    - text: 原始文本
    - mapped_entities: 实体列表的JSON字符串
    - mask_char: 遮罩字符，默认为 "●"
    - keep_prefix: 保留前缀字符数，默认为 2
    - keep_suffix: 保留后缀字符数，默认为 2
    
    返回: 包含脱敏后文本的字典
    """
    try:
        # 解析实体列表
        if isinstance(mapped_entities, str):
            entities = json.loads(mapped_entities)
        else:
            entities = mapped_entities
        
        return _tools_instance.replace_text(text, entities, mask_char, keep_prefix, keep_suffix)
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"实体列表JSON解析失败: {str(e)}",
            "original_text": text,
            "timestamp": datetime.now().isoformat()
        }


@tool
async def export_file(content: str, filename: str, export_dir: str = "exports") -> Dict[str, Any]:
    """
    导出脱敏后的内容到文件
    
    参数:
    - content: 要导出的内容
    - filename: 导出文件名
    - export_dir: 导出目录，默认为 "exports"
    
    返回: 导出结果信息
    """
    return await _tools_instance.export_file(content, filename, export_dir)


# 导出工具列表
ANONYMIZER_TOOLS = [parse_document, rule_anonymizer, replace_text, export_file]
