👌明白了，你是想要一份**开发提示词（system / developer prompt 设计稿）**，让你在写代码或调用大模型时，尽量“一句 prompt 就能自动生成代码/功能骨架”，覆盖我上面架构里提到的主要部分。

我帮你设计一套 **小规模覆盖、足够详细的提示词库**，分模块，结合你的需求：

---

# 🎯 总体说明

* **目标**：开发一个“法律文件脱敏智能体”的原型系统，支持文档上传、规则 + NER 脱敏、实体一致化替换、前端预览。
* **使用方式**：在调用大模型生成代码时，直接复制这些提示词（或拼接参数），就能快速得到初步代码，然后再手动调整。
* **提示词分层**：

  1. **后端 API**（FastAPI + 数据模型）
  2. **规则脱敏器（Regex + Pipeline）**
  3. **实体映射/一致化模块**
  4. **NER 模块**（HanLP/HF 模型）
  5. **前端 Web**（Next.js + PDF.js + 高亮预览）
  6. **任务流（Celery/队列处理）**

---

# 🧩 提示词模板库

## 1. 后端 API 骨架

```
你是一名高级 Python 后端工程师。  
请帮我用 **FastAPI** 写一个基础 API 服务，要求：  
- 支持上传文件接口（POST /cases/{case_id}/documents）  
- 支持触发脱敏任务接口（POST /documents/{doc_id}/process）  
- 支持预览接口（GET /documents/{doc_id}/preview），返回 JSON 格式：
  {
    "text": "原始文本",
    "entities": [
      {"start": 0, "end": 2, "type": "PERSON", "original": "张三", "alias": "张某1"}
    ],
    "masked_text": "..."
  }
- 数据模型用 **Pydantic**  
- 日志打印请求与响应（过滤掉文件内容）  
```

---

## 2. 规则脱敏器（Regex Pipeline）

```
你是一名 Python 数据处理工程师。  
请帮我实现一个 **脱敏规则模块**，要求：  
- 输入：字符串 text  
- 输出：所有匹配的实体（start, end, type, original_text）  
- 必须支持：身份证号、手机号、邮箱、银行卡号、案号  
- 用正则表达式实现，写成一个类 RuleAnonymizer  
- 支持配置：不同规则可启用/禁用  
- 最终返回一个 list[dict]，类似：  
  [{"start":10,"end":28,"type":"IDCARD","original":"110101199003078765"}]  
```

---

## 3. 实体映射/一致化

```
你是一名 Python 工程师。  
请帮我实现一个 **实体一致化替换器**，要求：  
- 输入：实体列表 [{"type":"PERSON","original":"张三"}, ...]  
- 每个实体生成一个稳定的别名，比如 "张某1" / "PERSON_1"  
- 同一实体在同一 case_id 下必须一致  
- 方案：用 SHA256(salt + original) 作为 key  
- 维护一个全局字典 {hash: alias}  
- 别名生成逻辑：  
  - 人名：张某1、张某2...  
  - 机构：某公司1、某公司2...  
  - 其他：GEN_{type}_{n}  
- 提供一个 replace_text(text, entities) 方法，返回替换后的文本  
```

---

## 4. NER 模块（HanLP/HuggingFace）

```
你是一名 NLP 工程师。  
请帮我写一个中文命名实体识别（NER）模块，要求：  
- 使用 HuggingFace Transformers（bert-base-chinese）  
- 定义标签集：PERSON, ORG, LOC, DATE, LAW_ID  
- 输入：文本字符串  
- 输出：实体列表 [{"start":int,"end":int,"type":str,"original":str,"confidence":float}]  
- 如果没有 GPU，就用 CPU 推理  
- 提供接口类 NERExtractor，方法 extract(text) -> list[dict]  
- 要能兼容前面 RuleAnonymizer 的输出格式  
```

---

## 5. 前端 Web（Next.js + PDF.js）

```
你是一名前端工程师。  
请帮我用 Next.js + React 写一个页面，要求：  
- 上传文档（PDF/Word），调用后端 API 上传  
- 展示脱敏结果对照：  
  - 左边：原文 PDF 渲染（用 PDF.js）  
  - 右边：脱敏后文本，高亮实体（不同颜色区分 PERSON/ORG/LOC）  
- 支持切换视图（原文/脱敏/对照）  
- 支持下载按钮，调用 /download 接口  
- 样式：Tailwind，简洁风格  
```

---

## 6. 任务流（Celery Worker）

```
你是一名 Python 后端工程师。  
请帮我写一个 Celery 任务模块，要求：  
- 任务：process_document(doc_id)  
- 步骤：  
  1. 从数据库加载文档文本  
  2. 调用 RuleAnonymizer + NERExtractor，合并结果  
  3. 送入 EntityMapper 替换  
  4. 存储 masked_text 与实体映射  
- Celery 配置：使用 Redis 作为 broker & backend  
- 支持重试和日志打印  
```

---

# 🚀 用法示例

假设你要做一个“规则脱敏器”，只需一句：
👉 把上面 **提示词 #2** 丢给大模型，它就会生成一份完整的 Python 类，你直接粘进项目里即可。

如果你要做一个“前端对照页面”，只需丢 **提示词 #5**，它就会产出一个可运行的 React/Next.js 页面骨架。

---

要不要我帮你把这套提示词进一步“打包成一个分阶段的开发指南”（比如 Sprint 1 就用 #1、#2、#3；Sprint 2 再加 #4、#5、#6），这样你直接跟着跑就能一步步做完？
