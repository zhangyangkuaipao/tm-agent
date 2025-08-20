"""
LangChain 法律文件脱敏智能体
使用 LangChain 框架实现的智能脱敏代理
"""

from langchain.agents import create_openai_functions_agent, AgentExecutor
from langchain.memory import ConversationBufferMemory
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain_community.llms import FakeListLLM

from langchain_tools import ANONYMIZER_TOOLS
from typing import Dict, Any, List, Optional
import json
import asyncio
from datetime import datetime


class LegalDocumentAnonymizerAgent:
    """法律文件脱敏智能体"""
    
    def __init__(self, model_name: str = "gpt-3.5-turbo", use_fake_llm: bool = True):
        """
        初始化智能体
        
        Args:
            model_name: 使用的语言模型名称
            use_fake_llm: 是否使用虚拟LLM（用于演示）
        """
        self.use_fake_llm = use_fake_llm
        
        # 初始化语言模型
        if use_fake_llm:
            # 使用虚拟LLM进行演示，预定义响应
            responses = [
                "我是法律文件脱敏智能体。我将按照以下步骤处理您的文件：\n1. 首先解析文档提取文本\n2. 识别敏感实体\n3. 进行脱敏处理\n4. 导出结果文件",
                "开始解析文档...",
                "正在提取敏感实体...", 
                "执行脱敏处理...",
                "导出脱敏结果...",
                "处理完成！"
            ]
            self.llm = FakeListLLM(responses=responses)
        else:
            self.llm = ChatOpenAI(model=model_name, temperature=0)
        
        # 初始化记忆
        self.memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True
        )
        
        # 创建系统提示模板
        self.system_prompt = """你是一个专业的法律文件脱敏智能体。你的任务是帮助用户安全地处理法律文档，识别并脱敏其中的敏感信息。

你可以使用以下工具：
1. parse_document(file_path) - 解析文档并提取文本内容
2. rule_anonymizer(text, enabled_rules) - 识别文本中的敏感实体
3. replace_text(text, mapped_entities, mask_char, keep_prefix, keep_suffix) - 对文本进行脱敏处理
4. export_file(content, filename, export_dir) - 导出脱敏后的文件

当用户上传文件时，你应该按照以下工作流程：
1. 调用 parse_document 解析文档
2. 调用 rule_anonymizer 识别敏感实体
3. 调用 replace_text 生成脱敏文本
4. 调用 export_file 导出结果文件

请始终用中文与用户交流，并提供详细的处理过程说明。"""

        # 创建提示模板
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # 创建代理
        if not use_fake_llm:
            self.agent = create_openai_functions_agent(
                llm=self.llm,
                tools=ANONYMIZER_TOOLS,
                prompt=self.prompt
            )
            
            # 创建代理执行器
            self.agent_executor = AgentExecutor(
                agent=self.agent,
                tools=ANONYMIZER_TOOLS,
                memory=self.memory,
                verbose=True,
                max_iterations=10
            )
        else:
            # 对于虚拟LLM，我们手动实现执行逻辑
            self.agent_executor = None
    
    async def process_document(self, file_path: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        处理文档的完整工作流
        
        Args:
            file_path: 文档文件路径
            config: 脱敏配置
            
        Returns:
            Dict: 处理结果
        """
        try:
            # 设置默认配置
            if config is None:
                config = {
                    "enabled_rules": None,
                    "mask_char": "●",
                    "keep_prefix": 2,
                    "keep_suffix": 2
                }
            
            result = {
                "success": False,
                "steps": [],
                "timestamp": datetime.now().isoformat()
            }
            
            # 步骤1: 解析文档
            result["steps"].append({"step": 1, "action": "解析文档", "status": "进行中"})
            
            from langchain_tools import _tools_instance
            parse_result = await _tools_instance.parse_document(file_path)
            
            if not parse_result["success"]:
                result["steps"][-1]["status"] = "失败"
                result["steps"][-1]["error"] = parse_result["error"]
                result["error"] = f"文档解析失败: {parse_result['error']}"
                return result
            
            result["steps"][-1]["status"] = "完成"
            result["steps"][-1]["result"] = {
                "text_length": len(parse_result["content"]),
                "metadata": parse_result["metadata"]
            }
            
            extracted_text = parse_result["content"]
            
            # 步骤2: 识别敏感实体
            result["steps"].append({"step": 2, "action": "识别敏感实体", "status": "进行中"})
            
            entity_result = _tools_instance.rule_anonymizer_extract(
                extracted_text, 
                config.get("enabled_rules")
            )
            
            if not entity_result["success"]:
                result["steps"][-1]["status"] = "失败"
                result["steps"][-1]["error"] = entity_result["error"]
                result["error"] = f"实体识别失败: {entity_result['error']}"
                return result
            
            result["steps"][-1]["status"] = "完成"
            result["steps"][-1]["result"] = {
                "entity_count": entity_result["entity_count"],
                "entity_statistics": entity_result["entity_statistics"]
            }
            
            entities = entity_result["entities"]
            
            # 步骤3: 脱敏处理
            result["steps"].append({"step": 3, "action": "脱敏处理", "status": "进行中"})
            
            replace_result = _tools_instance.replace_text(
                extracted_text,
                entities,
                config.get("mask_char", "●"),
                config.get("keep_prefix", 2),
                config.get("keep_suffix", 2)
            )
            
            if not replace_result["success"]:
                result["steps"][-1]["status"] = "失败" 
                result["steps"][-1]["error"] = replace_result["error"]
                result["error"] = f"脱敏处理失败: {replace_result['error']}"
                return result
            
            result["steps"][-1]["status"] = "完成"
            result["steps"][-1]["result"] = {
                "entities_processed": replace_result["entities_processed"],
                "original_length": len(replace_result["original_text"]),
                "masked_length": len(replace_result["masked_text"])
            }
            
            masked_text = replace_result["masked_text"]
            
            # 步骤4: 导出文件
            result["steps"].append({"step": 4, "action": "导出文件", "status": "进行中"})
            
            import os
            original_filename = os.path.basename(file_path)
            name, ext = os.path.splitext(original_filename)
            export_filename = f"{name}_脱敏结果.txt"
            
            export_result = await _tools_instance.export_file(
                masked_text,
                export_filename,
                "exports"
            )
            
            if not export_result["success"]:
                result["steps"][-1]["status"] = "失败"
                result["steps"][-1]["error"] = export_result["error"]
                result["error"] = f"文件导出失败: {export_result['error']}"
                return result
            
            result["steps"][-1]["status"] = "完成"
            result["steps"][-1]["result"] = {
                "export_path": export_result["export_path"],
                "file_size": export_result["file_size"]
            }
            
            # 汇总结果
            result.update({
                "success": True,
                "original_text": extracted_text,
                "masked_text": masked_text,
                "entities_found": entities,
                "entity_statistics": entity_result["entity_statistics"],
                "export_info": export_result,
                "config_used": config,
                "processing_summary": {
                    "original_length": len(extracted_text),
                    "masked_length": len(masked_text),
                    "entities_count": len(entities),
                    "steps_completed": len([s for s in result["steps"] if s["status"] == "完成"])
                }
            })
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "error": f"处理过程中发生错误: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
    
    async def chat(self, message: str) -> str:
        """
        与智能体进行对话
        
        Args:
            message: 用户消息
            
        Returns:
            str: 智能体回复
        """
        if self.use_fake_llm:
            # 简单的规则匹配回复
            if "文件" in message or "上传" in message:
                return "请提供文件路径，我将帮您处理法律文档的脱敏工作。"
            elif "脱敏" in message:
                return "我可以识别并脱敏身份证号、手机号、邮箱、银行卡号、案号等敏感信息。"
            elif "帮助" in message or "功能" in message:
                return "我是法律文件脱敏智能体，可以帮您：\n1. 解析PDF和Word文档\n2. 识别敏感信息\n3. 安全脱敏处理\n4. 导出处理结果"
            else:
                return "您好！我是法律文件脱敏智能体，可以帮您安全处理法律文档中的敏感信息。请上传文件或询问相关功能。"
        else:
            try:
                response = await self.agent_executor.ainvoke({"input": message})
                return response["output"]
            except Exception as e:
                return f"对话过程中发生错误: {str(e)}"
    
    def get_conversation_history(self) -> List[Dict[str, str]]:
        """获取对话历史"""
        messages = self.memory.chat_memory.messages
        history = []
        
        for msg in messages:
            if isinstance(msg, HumanMessage):
                history.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                history.append({"role": "assistant", "content": msg.content})
        
        return history
    
    def clear_memory(self):
        """清除对话记忆"""
        self.memory.clear()


# 创建全局智能体实例
anonymizer_agent = LegalDocumentAnonymizerAgent(use_fake_llm=True)
