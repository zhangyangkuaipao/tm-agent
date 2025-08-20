"""
LangChain 法律文件脱敏智能体 - API 客户端演示
展示如何通过 HTTP 请求与智能体交互
"""

import requests
import json
import time
import os
from typing import Dict, Any

class LangChainAgentClient:
    """LangChain Agent API 客户端"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.session_id = f"demo-{int(time.time())}"
    
    def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            response = requests.get(f"{self.base_url}/api/health")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def chat(self, message: str) -> Dict[str, Any]:
        """与智能体对话"""
        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json={
                    "message": message,
                    "session_id": self.session_id
                }
            )
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def get_tools(self) -> Dict[str, Any]:
        """获取可用工具列表"""
        try:
            response = requests.get(f"{self.base_url}/api/tools")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def upload_and_process(self, file_path: str, config: Dict = None) -> Dict[str, Any]:
        """上传文件并处理"""
        if not os.path.exists(file_path):
            return {"error": f"文件不存在: {file_path}"}
        
        if config is None:
            config = {
                "enabled_rules": ["IDCARD", "PHONE", "EMAIL", "BANKCARD", "CASE_NUMBER"],
                "mask_char": "●",
                "keep_prefix": 2,
                "keep_suffix": 2
            }
        
        try:
            with open(file_path, 'rb') as f:
                files = {'file': f}
                data = {'config': json.dumps(config)}
                response = requests.post(
                    f"{self.base_url}/api/upload-and-process",
                    files=files,
                    data=data
                )
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def download_file(self, filename: str, save_path: str = None) -> bool:
        """下载导出的文件"""
        try:
            response = requests.get(f"{self.base_url}/api/download/{filename}")
            if response.status_code == 200:
                if save_path is None:
                    save_path = filename
                with open(save_path, 'wb') as f:
                    f.write(response.content)
                return True
            return False
        except Exception as e:
            print(f"下载失败: {e}")
            return False
    
    def get_export_list(self) -> Dict[str, Any]:
        """获取导出文件列表"""
        try:
            response = requests.get(f"{self.base_url}/api/export-list")
            return response.json()
        except Exception as e:
            return {"error": str(e)}

def demo_chat_interaction():
    """演示对话交互"""
    print("🤖 对话交互演示")
    print("=" * 50)
    
    client = LangChainAgentClient()
    
    # 健康检查
    health = client.health_check()
    if "error" in health:
        print(f"❌ 服务不可用: {health['error']}")
        return
    
    print(f"✅ 服务状态: {health.get('status', '未知')}")
    print(f"📊 活跃会话: {health.get('sessions_count', 0)}")
    print()
    
    # 对话示例
    messages = [
        "你好，我是新用户",
        "你能帮我处理什么类型的文档？",
        "支持哪些脱敏规则？",
        "如何上传文件进行处理？"
    ]
    
    for msg in messages:
        print(f"👤 用户: {msg}")
        
        response = client.chat(msg)
        if "error" in response:
            print(f"❌ 错误: {response['error']}")
        else:
            print(f"🤖 智能体: {response.get('response', '无响应')}")
        
        print()
        time.sleep(1)

def demo_tools_info():
    """演示工具信息获取"""
    print("🛠️ 工具信息演示")
    print("=" * 50)
    
    client = LangChainAgentClient()
    
    tools_info = client.get_tools()
    if "error" in tools_info:
        print(f"❌ 获取工具信息失败: {tools_info['error']}")
        return
    
    print("📋 可用工具:")
    for tool in tools_info.get("tools", []):
        print(f"  🔧 {tool['name']}")
        print(f"     📝 功能: {tool['description']}")
        print(f"     📋 参数: {', '.join(tool['parameters'])}")
        print()
    
    print("📏 支持的脱敏规则:")
    for rule in tools_info.get("supported_rules", []):
        rule_names = {
            "IDCARD": "身份证号",
            "PHONE": "手机号", 
            "EMAIL": "邮箱地址",
            "BANKCARD": "银行卡号",
            "CASE_NUMBER": "案号"
        }
        print(f"  🏷️  {rule} - {rule_names.get(rule, '未知')}")
    print()

def demo_text_processing():
    """演示文本处理（模拟文件）"""
    print("📄 文本处理演示")
    print("=" * 50)
    
    # 创建测试文档
    test_content = """
    法律咨询记录
    
    咨询人：张三，身份证号：110101199001011234
    联系电话：13812345678
    电子邮箱：zhangsan@example.com
    
    案件相关：
    案号：(2023)京01民初123号
    银行账户：6225881234567890
    
    咨询内容：
    关于合同纠纷的法律问题...
    """
    
    test_file = "demo_test.txt"
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(test_content)
    
    print("📝 创建测试文档:")
    print(test_content[:100] + "...")
    print()
    
    client = LangChainAgentClient()
    
    # 由于是txt文件，我们展示如何通过对话方式处理
    print("💬 通过对话处理文本:")
    response = client.chat(f"请帮我分析这段文本中的敏感信息：{test_content}")
    
    if "error" in response:
        print(f"❌ 处理失败: {response['error']}")
    else:
        print(f"🤖 分析结果: {response.get('response', '无响应')}")
    
    # 清理测试文件
    if os.path.exists(test_file):
        os.remove(test_file)
    
    print()

def demo_export_list():
    """演示导出文件列表"""
    print("📂 导出文件演示")
    print("=" * 50)
    
    client = LangChainAgentClient()
    
    export_list = client.get_export_list()
    if "error" in export_list:
        print(f"❌ 获取文件列表失败: {export_list['error']}")
        return
    
    files = export_list.get("files", [])
    if not files:
        print("📭 暂无导出文件")
        print("💡 提示: 先处理一些文档后，这里会显示导出的脱敏文件")
    else:
        print(f"📋 共找到 {len(files)} 个导出文件:")
        for file_info in files:
            print(f"  📄 {file_info['filename']}")
            print(f"     📏 大小: {file_info['size']} 字节")
            print(f"     📅 创建时间: {file_info['created_time']}")
            print(f"     🔗 下载链接: {file_info['download_url']}")
            print()
    
    print()

def main():
    """主演示函数"""
    print("🎉 LangChain 法律文件脱敏智能体 - API 演示")
    print("=" * 60)
    print()
    
    print("📍 确保服务正在运行:")
    print("   python main_langchain.py")
    print("   或运行: start-langchain.bat")
    print()
    
    try:
        # 1. 对话交互演示
        demo_chat_interaction()
        
        # 2. 工具信息演示  
        demo_tools_info()
        
        # 3. 文本处理演示
        demo_text_processing()
        
        # 4. 导出文件演示
        demo_export_list()
        
        print("🎊 演示完成！")
        print()
        print("💡 更多功能:")
        print("   📚 访问 API 文档: http://localhost:8001/docs")
        print("   🔍 健康检查: http://localhost:8001/api/health")
        print("   📱 Web 界面: 查看 frontend 目录")
        
    except KeyboardInterrupt:
        print("\n👋 演示被用户中断")
    except Exception as e:
        print(f"\n❌ 演示过程中出错: {e}")

if __name__ == "__main__":
    main()
