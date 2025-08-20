import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [localIP, setLocalIP] = useState('localhost');
  const [messages, setMessages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [contentView, setContentView] = useState('anonymized'); // 'original' | 'anonymized'
  const [showSettings, setShowSettings] = useState(false);
  const [anonymizeSettings, setAnonymizeSettings] = useState({
    enabled_rules: ['IDCARD', 'PHONE', 'EMAIL', 'BANKCARD', 'CASE_NUMBER'],
    mask_char: '●',
    keep_prefix: 2,
    keep_suffix: 2
  });
  const [sessionId, setSessionId] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // 待处理的文件
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 滚动到消息底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 当消息更新时自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 获取本地IP地址
  const getLocalIP = async () => {
    try {
      // 使用WebRTC获取本地IP
      const pc = new RTCPeerConnection({
        iceServers: []
      });
      
      pc.createDataChannel('');
      
      return new Promise((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ip = candidate.split(' ')[4];
            if (ip && ip.includes('.') && !ip.startsWith('127.') && !ip.startsWith('169.254.')) {
              pc.close();
              resolve(ip);
            }
          }
        };
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        // 超时处理，如果5秒内没有获取到IP，使用localhost
        setTimeout(() => {
          pc.close();
          resolve('localhost');
        }, 5000);
      });
    } catch (error) {
      console.log('无法获取本地IP，使用localhost:', error);
      return 'localhost';
    }
  };

  // 组件加载时获取本地IP
  useEffect(() => {
    getLocalIP().then(ip => {
      setLocalIP(ip);
      console.log('检测到本地IP:', ip);
    });
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPlusMenu) {
        setShowPlusMenu(false);
      }
    };

    if (showPlusMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showPlusMenu]);

  const handleFileUpload = async (file) => {
    if (!file) return;

    // 如果正在处理文件，禁止上传新文件
    if (isUploading || isSending) {
      addMessage('assistant', '⚠️ 当前正在处理中，请等待完成后再上传新文件。');
      return;
    }

    // 检查文件类型
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      addMessage('assistant', '抱歉，目前只支持PDF和Word文档格式。请上传.pdf、.docx或.doc文件。');
      return;
    }

    // 添加用户消息
    //addMessage('user', `📎 已选择文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // 存储待处理的文件
    setPendingFile(file);

    // 添加提示消息
    //addMessage('assistant', '📋 文件已准备就绪！请输入您想要处理的内容或直接按回车开始文档脱敏处理。');
  };

  // 流式处理文件上传
  const handleStreamingUpload = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(anonymizeSettings));

    // 添加开始处理的消息，并保存其ID用于后续更新
    // 使用更精确的ID生成方式，确保不会与用户消息ID冲突
    const processingMessageId = `processing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const processingMessage = {
      id: processingMessageId,
      type: 'assistant',
      content: '🚀 开始处理文件...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, processingMessage]);

    const response = await fetch(`http://localhost:8001/api/upload-and-process-stream`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留最后一行（可能不完整）

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                // 开始消息已经显示了
              } else if (data.type === 'progress') {
                const statusIcon = data.status === '完成' ? '✅' : '🔄';
                const progressContent = `${statusIcon} **步骤 ${data.step}: ${data.action}**\n${data.message}`;
                
                // 更新现有的处理消息而不是添加新消息
                setMessages(prev => prev.map(msg => 
                  msg.id === processingMessageId 
                    ? { ...msg, content: progressContent }
                    : msg
                ));
              } else if (data.type === 'complete') {
                finalResult = data.result;
              } else if (data.type === 'error') {
                // 更新为错误消息
                setMessages(prev => prev.map(msg => 
                  msg.id === processingMessageId 
                    ? { ...msg, content: `❌ ${data.message}` }
                    : msg
                ));
                return;
              }
            } catch (e) {
              console.error('解析SSE数据错误:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 处理最终结果
    if (finalResult) {
      const data = finalResult;
      
      console.log('最终结果数据:', data);
      
      if (data.success) {
        // 构建最终完成消息
        const entityCount = data.entities_found ? data.entities_found.length : 0;
        const entityStats = data.entity_statistics || {};
        const statsText = Object.entries(entityStats).map(([type, count]) => {
          const typeNames = {
            'IDCARD': '身份证号',
            'PHONE': '手机号码',
            'EMAIL': '电子邮箱', 
            'BANKCARD': '银行卡号',
            'CASE_NUMBER': '案件编号'
          };
          return `${typeNames[type] || type}: ${count}个`;
        }).join('、');
        
        const completionMessage = `🎉 **处理完成！**\n\n• 发现 ${entityCount} 个敏感实体：${statsText}\n• 原文本长度：${data.processing_summary?.original_length || 0} 字符\n• 脱敏后长度：${data.processing_summary?.masked_length || 0} 字符`;
        
        // 构建文件数据
        const fileData = {
          filename: data.file_info?.original_name || file.name,
          originalContent: data.original_text || '无法获取原始内容',
          anonymizedContent: data.masked_text || '无法获取脱敏内容',
          sensitiveEntities: data.entities_found || [],
          entityStatistics: data.entity_statistics || {},
          processingInfo: data.processing_summary || { message: '处理完成' },
          anonymizeConfig: data.config_used || anonymizeSettings,
          metadata: { 
            extraction_method: 'langchain',
            steps: data.steps || [],
            export_info: data.export_info
          },
          size: data.file_info?.size || file.size,
          contentType: data.file_info?.content_type || file.type
        };
        
        // 更新处理消息为最终完成消息，并添加文件数据
        setMessages(prev => prev.map(msg => 
          msg.id === processingMessageId 
            ? { ...msg, content: completionMessage, fileData: fileData }
            : msg
        ));
      } else {
        // 更新为错误消息
        setMessages(prev => prev.map(msg => 
          msg.id === processingMessageId 
            ? { ...msg, content: `❌ ${data.error || '文件处理失败，请重试'}` }
            : msg
        ));
      }

      // 设置文件已上传状态
      setHasUploadedFile(true);
    } else {
      // 更新为失败消息
      setMessages(prev => prev.map(msg => 
        msg.id === processingMessageId 
          ? { ...msg, content: '❌ 文件处理失败，未收到有效结果。' }
          : msg
      ));
    }
  };

  const addMessage = (type, content, fileData) => {
    const newMessage = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      fileData,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    // 如果正在处理，不允许拖拽
    if (!isUploading && !isSending) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    // 如果正在处理，不允许拖拽上传
    if (isUploading || isSending) {
      return;
    }
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = () => {
    // 如果正在处理，不允许选择文件
    if (isUploading || isSending) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // 清除输入值，允许重复上传同一文件
    e.target.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 处理文本消息发送
  const handleSendMessage = async () => {
    if (isSending || isUploading) return;

    // 如果有待处理的文件，优先处理文件
    if (pendingFile) {
      const message = inputMessage.trim();
      setInputMessage('');
      setIsSending(true);
      setIsUploading(true);

      // 如果用户输入了消息，添加用户消息
      if (message) {
        addMessage('user', message);
      }

      try {
        await handleStreamingUpload(pendingFile);
        // 清除待处理文件
        setPendingFile(null);
      } catch (error) {
        let errorMessage = '文件处理失败，请稍后重试。';
        
        if (error.message) {
          errorMessage = `处理错误: ${error.message}`;
        }

        addMessage('assistant', errorMessage);
      } finally {
        setIsSending(false);
        setIsUploading(false);
      }
      return;
    }

    // 常规消息发送逻辑
    if (!inputMessage.trim()) return;

    const message = inputMessage.trim();
    setInputMessage('');
    setIsSending(true);

    // 添加用户消息
    addMessage('user', message);

    try {
      const response = await axios.post(`http://localhost:8001/api/chat`, {
        message: message,
        session_id: sessionId
      });

      const data = response.data;

      // 更新会话ID
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
      }

      // 添加助手回复
      addMessage('assistant', data.response || '抱歉，我暂时无法回复您的问题。');

    } catch (error) {
      let errorMessage = '发送消息失败，请稍后重试。';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = `错误: ${error.message}`;
      }

      addMessage('assistant', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // 处理键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 格式化消息内容，支持简单的Markdown渲染
  const formatMessageContent = (content) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
      .replace(/\*(.*?)\*/g, '<em>$1</em>')              // 斜体
      .replace(/\n/g, '<br/>')                           // 换行
      .replace(/• /g, '&nbsp;&nbsp;&bull; ')           // 项目符号
      .replace(/└ /g, '&nbsp;&nbsp;&nbsp;&nbsp;└ '); // 缩进
  };

  const handleDemoAnonymization = () => {
    // 创建演示数据
    const demoOriginalContent = `Legal Document Test

Case Information:
Plaintiff: Li Ming
ID Card: 110101199001011234
Phone: 13800138000
Email: liming@example.com
Bank Account: 6225880123456789
Case Number: (2023)京01民初123号

Defendant: Wang Hong
ID Card: 330106198705234567
Phone: 15900159000
Email: wanghong@legal.com`;

    const demoAnonymizedContent = `Legal Document Test

Case Information:
Plaintiff: Li Ming
ID Card: 11●●●●●●●●●●●●●●34
Phone: 13●●●●●●●00
Email: li●●●●●●●●●●●●●●om
Bank Account: 62●●●●●●●●●●●●89
Case Number: (2●●●●●●●●●●●3号

Defendant: Wang Hong
ID Card: 33●●●●●●●●●●●●●●67
Phone: 15●●●●●●●00
Email: wa●●●●●●●●●●●●●●om`;

    const demoEntities = [
      { start: 67, end: 85, type: "IDCARD", original: "110101199001011234" },
      { start: 93, end: 104, type: "PHONE", original: "13800138000" },
      { start: 112, end: 130, type: "EMAIL", original: "liming@example.com" },
      { start: 145, end: 161, type: "BANKCARD", original: "6225880123456789" },
      { start: 175, end: 190, type: "CASE_NUMBER", original: "(2023)京01民初123号" },
      { start: 222, end: 240, type: "IDCARD", original: "330106198705234567" },
      { start: 248, end: 259, type: "PHONE", original: "15900159000" },
      { start: 267, end: 285, type: "EMAIL", original: "wanghong@legal.com" }
    ];

    const demoEntityStats = {
      "IDCARD": 2,
      "PHONE": 2,
      "EMAIL": 2,
      "BANKCARD": 1,
      "CASE_NUMBER": 1
    };

    // 添加用户消息
    addMessage('user', '🎭 演示脱敏效果');

    // 添加演示结果
    addMessage('assistant', '这是脱敏功能的演示效果。已成功识别并脱敏了文档中的敏感信息。', {
      filename: 'demo_legal_document.docx',
      originalContent: demoOriginalContent,
      anonymizedContent: demoAnonymizedContent,
      sensitiveEntities: demoEntities,
      entityStatistics: demoEntityStats,
      processingInfo: {
        originalLength: demoOriginalContent.length,
        anonymizedLength: demoAnonymizedContent.length,
        entitiesFound: demoEntities.length,
        entityTypes: ['IDCARD', 'PHONE', 'EMAIL', 'BANKCARD', 'CASE_NUMBER']
      },
      anonymizeConfig: {
        enabled_rules: ['IDCARD', 'PHONE', 'EMAIL', 'BANKCARD', 'CASE_NUMBER'],
        mask_char: '●',
        keep_prefix: 2,
        keep_suffix: 2
      },
      metadata: {
        extraction_method: 'demo',
        pages: 1
      },
      size: 1024,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    setHasUploadedFile(true);
  };

  return (
    <div className="App">
      <div className="chat-container">
          <div className="chat-messages">
            <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-content">
                  {/* 支持简单的Markdown渲染 */}
                  <div 
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                    dangerouslySetInnerHTML={{
                      __html: formatMessageContent(message.content)
                    }}
                  />
                </div>
                
                {message.fileData && (
                  <>
                    
                    {/* 敏感信息统计 */}
                    {message.fileData.sensitiveEntities && message.fileData.sensitiveEntities.length > 0 && (
                      <div className="sensitive-entities-stats" style={{ 
                        padding: '12px', 
                        marginBottom: '16px' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#92400e' }}>
                          <span>🛡️</span>
                          <strong>敏感信息检测</strong>
                        </div>
                        <div style={{ fontSize: '14px', color: '#92400e' }}>
                          <p style={{ marginBottom: '8px' }}>发现 {message.fileData.sensitiveEntities.length} 个敏感实体：</p>
                          <div>
                            {Object.entries(message.fileData.entityStatistics).map(([type, count]) => {
                              const typeNames = {
                                'IDCARD': '身份证号',
                                'PHONE': '手机号码', 
                                'EMAIL': '电子邮箱',
                                'BANKCARD': '银行卡号',
                                'CASE_NUMBER': '案件编号'
                              };
                              return (
                                <span key={type} className="entity-tag">
                                  {typeNames[type] || type}: {count}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 内容显示控制 */}
                    <div className="file-content">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5' }}>
                          <span>📄</span>
                          <strong>文档内容</strong>
                        </div>
                        
                        {message.fileData.sensitiveEntities && message.fileData.sensitiveEntities.length > 0 && (
                          <div className="content-switch-buttons">
                            <button
                              onClick={() => setContentView('anonymized')}
                              className={`content-switch-button ${contentView === 'anonymized' ? 'active anonymized' : ''}`}
                            >
                              🛡️ 脱敏版本
                            </button>
                            <button
                              onClick={() => setContentView('original')}
                              className={`content-switch-button ${contentView === 'original' ? 'active original' : ''}`}
                            >
                              ⚠️ 原始版本
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className={`content-display-area ${contentView}`} style={{ padding: '12px' }}>
                        {contentView === 'original' && message.fileData.sensitiveEntities && message.fileData.sensitiveEntities.length > 0 && (
                          <div className="security-warning">
                            ⚠️ 
                            <span>警告：此内容包含敏感信息，请谨慎处理</span>
                          </div>
                        )}
                        
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {contentView === 'anonymized' 
                            ? (message.fileData.anonymizedContent || message.fileData.originalContent || message.fileData.content)
                            : (message.fileData.originalContent || message.fileData.content)
                          }
                        </pre>
                      </div>
                    </div>
                  </>
                )}
                
                {/* <div className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </div> */}
              </div>
            ))}
            {/* 用于自动滚动到底部的标记 */}
            <div ref={messagesEndRef} />
            </div>
          </div>

              {/* 脱敏设置面板 */}
              {showSettings && (
            <div className="settings-panel" style={{ padding: '16px', margin: '16px', marginBottom: '0' }}>
                  <div className="settings-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>🛡️ 脱敏设置</h3>
                    <button
                      onClick={() => setShowSettings(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#6b7280',
                        borderRadius: '4px',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                  
                  {/* 规则选择 */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>
                      检测规则：
                    </label>
                    <div className="rule-checkbox-group">
                      {[
                        { key: 'IDCARD', label: '身份证号' },
                        { key: 'PHONE', label: '手机号码' },
                        { key: 'EMAIL', label: '电子邮箱' },
                        { key: 'BANKCARD', label: '银行卡号' },
                        { key: 'CASE_NUMBER', label: '案件编号' }
                      ].map(rule => (
                        <label key={rule.key} className="rule-checkbox-item">
                          <input
                            type="checkbox"
                            checked={anonymizeSettings.enabled_rules.includes(rule.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAnonymizeSettings(prev => ({
                                  ...prev,
                                  enabled_rules: [...prev.enabled_rules, rule.key]
                                }));
                              } else {
                                setAnonymizeSettings(prev => ({
                                  ...prev,
                                  enabled_rules: prev.enabled_rules.filter(r => r !== rule.key)
                                }));
                              }
                            }}
                          />
                          <span style={{ fontSize: '12px' }}>{rule.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* 脱敏参数 */}
                  <div className="settings-grid">
                    <div className="settings-input-group">
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                        遮罩字符：
                      </label>
                      <select
                        value={anonymizeSettings.mask_char}
                        onChange={(e) => setAnonymizeSettings(prev => ({ ...prev, mask_char: e.target.value }))}
                        className="settings-input"
                      >
                        <option value="●">● (圆点)</option>
                        <option value="*">* (星号)</option>
                        <option value="▪">▪ (方块)</option>
                        <option value="✱">✱ (星形)</option>
                      </select>
                    </div>
                    
                    <div className="settings-input-group">
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                        保留前缀：
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={anonymizeSettings.keep_prefix}
                        onChange={(e) => setAnonymizeSettings(prev => ({ ...prev, keep_prefix: parseInt(e.target.value) || 0 }))}
                        className="settings-input"
                      />
                    </div>
                    
                    <div className="settings-input-group">
                      <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#374151' }}>
                        保留后缀：
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={anonymizeSettings.keep_suffix}
                        onChange={(e) => setAnonymizeSettings(prev => ({ ...prev, keep_suffix: parseInt(e.target.value) || 0 }))}
                        className="settings-input"
                      />
                    </div>
                  </div>
                  
                  <div className="settings-example">
                    <strong>示例预览：</strong> 手机号 13812345678 → 
                    <span style={{ color: '#4f46e5', fontFamily: 'monospace', fontWeight: 'bold', marginLeft: '4px' }}>
                      {`138${'●'.repeat(Math.max(0, 11 - anonymizeSettings.keep_prefix - anonymizeSettings.keep_suffix))}678`.replace(/●/g, anonymizeSettings.mask_char)}
                    </span>
                  </div>
                </div>
              )}
              


          {/* 统一的输入区域 */}
              <div
            className={`unified-input-area ${dragOver && !isUploading && !isSending ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            style={{
              padding: '14px 60px 50px 50px',
              backgroundColor: 'white',
              position: 'fixed',
              bottom: '0',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '70%',
              zIndex: 1000
            }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {/* 待处理文件状态指示器 */}
                {pendingFile && (
                  <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    marginBottom: '10px',
                    fontSize: '13px',
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>📎</span>
                    <span>已选择文件: {pendingFile.name}</span>
                    <button
                      onClick={() => {
                        if (!isUploading && !isSending) {
                          setPendingFile(null);
                        }
                      }}
                      disabled={isUploading || isSending}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: (isUploading || isSending) ? '#d1d5db' : '#6b7280',
                        cursor: (isUploading || isSending) ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        padding: '0',
                        lineHeight: '1'
                      }}
                      title={isUploading || isSending ? "处理中无法取消" : "取消文件处理"}
                    >
                      ×
                    </button>
                  </div>
                )}
                
            <div style={{ position: 'relative' }}>
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={pendingFile ? "输入处理说明或直接回车开始处理文件..." : "上传需要脱敏的文件或内容..."}
                  disabled={isSending || isUploading}
                  style={{
                    width: '100%',
                    minHeight: '40px',
                    maxHeight: '120px',
                    padding: '12px 18px 12px 60px',
                    border: '1px solid #d1d5db',
                    borderRadius: '20px',
                    resize: 'none',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: isSending ? '#f3f4f6' : 'white',
                    outline: 'none',
                    lineHeight: '1.2'
                  }}
                />
                
                                {/* 加号按钮放在输入框内部左侧 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // 如果正在处理，不允许打开菜单
                    if (isUploading || isSending) {
                      return;
                    }
                    setShowPlusMenu(!showPlusMenu);
                  }}
                  disabled={isUploading || isSending}
                  style={{
                    position: 'absolute',
                    left: '18px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: (isUploading || isSending) ? '#e5e7eb' : '#f8f9fa',
                    color: (isUploading || isSending) ? '#9ca3af' : '#374151',
                    border: '1px solid #e5e7eb',
                    cursor: (isUploading || isSending) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '400',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isUploading && !isSending) {
                      e.target.style.backgroundColor = '#f1f3f4';
                      e.target.style.transform = 'translateY(-50%) scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isUploading && !isSending) {
                      e.target.style.backgroundColor = '#f8f9fa';
                      e.target.style.transform = 'translateY(-50%) scale(1)';
                    }
                  }}
                >
                  +
                </button>
                
                {/* 下拉菜单 */}
                {showPlusMenu && (
                  <div style={{
                    position: 'absolute',
                    bottom: '50px',
                    left: '18px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    minWidth: '200px'
                  }}>
                    <div 
                      onClick={() => {
                        if (!isUploading && !isSending) {
                          setShowPlusMenu(false);
                          handleFileSelect();
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        cursor: (isUploading || isSending) ? 'not-allowed' : 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: (isUploading || isSending) ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isUploading && !isSending) {
                          e.target.style.backgroundColor = '#f9fafb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isUploading && !isSending) {
                          e.target.style.backgroundColor = 'white';
                        }
                      }}
                    >
                      <span>📁</span>
                      <span>{(isUploading || isSending) ? '处理中...' : '上传文件'}</span>
                    </div>
                    <div 
                      onClick={() => {
                        setShowPlusMenu(false);
                        setShowSettings(!showSettings);
                      }}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <span>🛡️</span>
                      <span>脱敏设置</span>
                    </div>
                    <div 
                      onClick={() => {
                        setShowPlusMenu(false);
                        handleDemoAnonymization();
                      }}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                    >
                      <span>🎭</span>
                      <span>演示脱敏效果</span>
                    </div>
            </div>
          )}
            </div>
            
            {/* {sessionId && (
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6b7280',
                textAlign: 'center'
              }}>
                会话ID: {sessionId.substring(0, 8)}...
              </div>
            )} */}
          </div>
      </div>
    </div>
  );
}

export default App;
