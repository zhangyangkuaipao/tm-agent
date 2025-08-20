import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [localIP, setLocalIP] = useState('localhost');
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'assistant',
      content: '您好！我是法律文件脱敏智能体。🛡️\n\n我可以为您的PDF或Word文档提供：\n• 自动识别敏感信息（身份证、手机号、邮箱、银行卡号、案号）\n• 智能脱敏处理，保护隐私数据\n• 原始版本与脱敏版本对比查看\n• 灵活的脱敏规则配置\n\n请点击下方区域上传文件，或直接拖拽文件到此处开始体验。\n\n💡 提示：您也可以点击"演示脱敏效果"按钮来预览功能。',
      timestamp: new Date()
    }
  ]);
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
  const fileInputRef = useRef(null);

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

  const handleFileUpload = async (file) => {
    if (!file) return;

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
    addMessage('user', `上传文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', JSON.stringify(anonymizeSettings));

      const response = await axios.post(`http://172.18.40.140:8001/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;

      // 添加助手回复消息，包含原始和脱敏内容
      addMessage('assistant', data.message, {
        filename: data.filename,
        originalContent: data.original_content || data.content,
        anonymizedContent: data.anonymized_content || data.content,
        sensitiveEntities: data.sensitive_entities || [],
        entityStatistics: data.entity_statistics || {},
        processingInfo: data.processing_info || {},
        anonymizeConfig: data.anonymize_config || {},
        metadata: data.metadata,
        size: data.size,
        contentType: data.content_type
      });

      // 设置文件已上传状态
      setHasUploadedFile(true);

    } catch (error) {
      let errorMessage = '文件上传失败，请稍后重试。';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = `上传错误: ${error.message}`;
      }

      addMessage('assistant', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const addMessage = (type, content, fileData) => {
    const newMessage = {
      id: Date.now().toString(),
      type,
      content,
      fileData,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = () => {
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
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.type}`}>
                <div className="message-content">
                  {message.content}
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
          </div>

          {!hasUploadedFile && (
            <div className="chat-input-area">
              {/* 脱敏设置面板 */}
              {showSettings && (
                <div className="settings-panel" style={{ padding: '16px', marginBottom: '16px' }}>
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
              
              <div
                className={`file-upload-area ${dragOver ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileSelect}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {isUploading ? (
                  <div className="loading">
                    <div className="spinner"></div>
                    <span>正在处理文件...</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📤</div>
                    <div className="upload-text">
                      <p>点击此处或拖拽文件到这里上传</p>
                      <p style={{ fontSize: '12px', marginTop: '4px' }}>
                        支持 PDF、Word 文档 (最大 10MB)
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSettings(!showSettings);
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            backgroundColor: '#f3f4f6',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#374151'
                          }}
                        >
                          🛡️ 脱敏设置
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDemoAnonymization();
                          }}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            backgroundColor: '#dbeafe',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#1e40af'
                          }}
                        >
                          🎭 演示脱敏效果
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {hasUploadedFile && (
            <div
              className="floating-upload-button"
              onClick={handleFileSelect}
              title="上传新文件"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {isUploading ? (
                <div className="spinner small"></div>
              ) : (
                <span style={{ fontSize: '20px' }}>+</span>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

export default App;
