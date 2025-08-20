import re
from typing import List, Dict, Optional, Set
from dataclasses import dataclass


@dataclass
class MatchEntity:
    """匹配实体结果"""
    start: int
    end: int
    type: str
    original_text: str


class RuleAnonymizer:
    """
    脱敏规则模块
    支持身份证号、手机号、邮箱、银行卡号、案号的识别和脱敏
    """
    
    def __init__(self, enabled_rules: Optional[Set[str]] = None):
        """
        初始化脱敏器
        
        Args:
            enabled_rules: 启用的规则集合，默认启用所有规则
        """
        # 所有支持的规则类型
        self.ALL_RULES = {
            'IDCARD',      # 身份证号
            'PHONE',       # 手机号
            'EMAIL',       # 邮箱
            'BANKCARD',    # 银行卡号
            'CASE_NUMBER'  # 案号
        }
        
        # 设置启用的规则
        self.enabled_rules = enabled_rules if enabled_rules is not None else self.ALL_RULES.copy()
        
        # 定义正则表达式规则
        self.patterns = self._init_patterns()
    
    def _init_patterns(self) -> Dict[str, re.Pattern]:
        """初始化正则表达式模式"""
        patterns = {}
        
        # 身份证号码 - 18位或15位
        # 18位：前17位数字 + 最后一位数字或X
        # 15位：全部数字
        patterns['IDCARD'] = re.compile(
            r'\b(?:'
            r'[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]|'  # 18位
            r'[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}'  # 15位
            r')\b'
        )
        
        # 手机号码 - 中国大陆11位手机号
        # 1开头，第二位为3-9，后面9位数字
        patterns['PHONE'] = re.compile(
            r'\b1[3-9]\d{9}\b'
        )
        
        # 邮箱地址
        # 支持常见的邮箱格式
        patterns['EMAIL'] = re.compile(
            r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
        )
        
        # 银行卡号 - 13-19位数字，但排除身份证号格式
        # 常见银行卡号长度为16-19位，也有13-15位的
        patterns['BANKCARD'] = re.compile(
            r'\b(?:\d{4}[-\s]?){3}\d{1,4}\b|'  # 带分隔符的格式：1234-5678-9012-3456
            r'\b(?!(?:[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]|[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3})\b)\d{13,19}\b'  # 连续数字格式但排除身份证格式
        )
        
        # 案号 - 常见的法院案号格式
        # 格式：(年份)地区法院类型字第数字号
        # 例：(2023)京01民初123号、(2024)沪0101刑初456号
        patterns['CASE_NUMBER'] = re.compile(
            r'\(\d{4}\)[^()]*?(?:民|刑|行|执|赔|知|破|清|仲|调|特|其他)[^()]*?(?:第\d+号|\d+号)',
            re.IGNORECASE
        )
        
        return patterns
    
    def enable_rule(self, rule_type: str) -> bool:
        """
        启用指定规则
        
        Args:
            rule_type: 规则类型
            
        Returns:
            bool: 是否成功启用
        """
        if rule_type in self.ALL_RULES:
            self.enabled_rules.add(rule_type)
            return True
        return False
    
    def disable_rule(self, rule_type: str) -> bool:
        """
        禁用指定规则
        
        Args:
            rule_type: 规则类型
            
        Returns:
            bool: 是否成功禁用
        """
        if rule_type in self.enabled_rules:
            self.enabled_rules.remove(rule_type)
            return True
        return False
    
    def is_rule_enabled(self, rule_type: str) -> bool:
        """检查规则是否启用"""
        return rule_type in self.enabled_rules
    
    def get_enabled_rules(self) -> Set[str]:
        """获取当前启用的规则"""
        return self.enabled_rules.copy()
    
    def set_enabled_rules(self, rules: Set[str]) -> bool:
        """
        设置启用的规则
        
        Args:
            rules: 要启用的规则集合
            
        Returns:
            bool: 是否设置成功
        """
        # 验证所有规则都是有效的
        if not rules.issubset(self.ALL_RULES):
            return False
        
        self.enabled_rules = rules.copy()
        return True
    
    def extract_entities(self, text: str) -> List[Dict[str, any]]:
        """
        从文本中提取敏感实体
        
        Args:
            text: 输入文本
            
        Returns:
            List[Dict]: 匹配的实体列表，格式：
                [{"start": 10, "end": 28, "type": "IDCARD", "original": "110101199003078765"}]
        """
        entities = []
        
        # 遍历启用的规则
        for rule_type in self.enabled_rules:
            if rule_type not in self.patterns:
                continue
                
            pattern = self.patterns[rule_type]
            
            # 查找所有匹配
            for match in pattern.finditer(text):
                entity = {
                    "start": match.start(),
                    "end": match.end(),
                    "type": rule_type,
                    "original": match.group()
                }
                entities.append(entity)
        
        # 按开始位置排序
        entities.sort(key=lambda x: x["start"])
        
        return entities
    
    def anonymize_text(self, text: str, mask_char: str = '*', 
                      keep_prefix: int = 2, keep_suffix: int = 2) -> tuple[str, List[Dict[str, any]]]:
        """
        对文本进行脱敏处理
        
        Args:
            text: 输入文本
            mask_char: 遮罩字符
            keep_prefix: 保留前缀字符数
            keep_suffix: 保留后缀字符数
            
        Returns:
            tuple: (脱敏后的文本, 匹配的实体列表)
        """
        entities = self.extract_entities(text)
        
        if not entities:
            return text, entities
        
        # 从后往前替换，避免位置偏移
        anonymized_text = text
        for entity in reversed(entities):
            original = entity["original"]
            start, end = entity["start"], entity["end"]
            
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
            anonymized_text = anonymized_text[:start] + masked + anonymized_text[end:]
        
        return anonymized_text, entities
    
    def validate_entity(self, text: str, entity_type: str) -> bool:
        """
        验证文本是否符合指定实体类型的格式
        
        Args:
            text: 要验证的文本
            entity_type: 实体类型
            
        Returns:
            bool: 是否符合格式
        """
        if entity_type not in self.patterns:
            return False
        
        pattern = self.patterns[entity_type]
        match = pattern.fullmatch(text)
        return match is not None
    
    def get_pattern_info(self) -> Dict[str, str]:
        """获取所有规则的正则表达式信息"""
        return {
            rule_type: pattern.pattern 
            for rule_type, pattern in self.patterns.items()
        }


# 便捷函数
def create_anonymizer(enabled_rules: Optional[List[str]] = None) -> RuleAnonymizer:
    """
    创建脱敏器实例的便捷函数
    
    Args:
        enabled_rules: 启用的规则列表
        
    Returns:
        RuleAnonymizer: 脱敏器实例
    """
    rules_set = set(enabled_rules) if enabled_rules else None
    return RuleAnonymizer(enabled_rules=rules_set)


def quick_extract(text: str, rules: Optional[List[str]] = None) -> List[Dict[str, any]]:
    """
    快速提取文本中的敏感实体
    
    Args:
        text: 输入文本
        rules: 要使用的规则列表，None表示使用所有规则
        
    Returns:
        List[Dict]: 匹配的实体列表
    """
    anonymizer = create_anonymizer(rules)
    return anonymizer.extract_entities(text)


def quick_anonymize(text: str, rules: Optional[List[str]] = None, 
                   mask_char: str = '*') -> tuple[str, List[Dict[str, any]]]:
    """
    快速脱敏文本
    
    Args:
        text: 输入文本
        rules: 要使用的规则列表，None表示使用所有规则
        mask_char: 遮罩字符
        
    Returns:
        tuple: (脱敏后的文本, 匹配的实体列表)
    """
    anonymizer = create_anonymizer(rules)
    return anonymizer.anonymize_text(text, mask_char=mask_char)
