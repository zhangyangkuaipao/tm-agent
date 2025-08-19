import React, { useState, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      type: 'assistant',
      content: '您好！我是法律文件脱敏智能体。您可以上传PDF或Word文档，我会为您提取和显示文件内容。请点击下方区域上传文件或直接拖拽文件到此处。',
      timestamp: new Date()
    }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const fileInputRef = useRef(null);

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

      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = response.data;

      // 添加助手回复消息，包含文件内容
      addMessage('assistant', data.message, {
        filename: data.filename,
        content: data.content,
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
                    <div className="file-metadata">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span>📄</span>
                        <strong>{message.fileData.filename}</strong>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        <p>文件大小: {formatFileSize(message.fileData.size)}</p>
                        <p>文件类型: {message.fileData.contentType}</p>
                        {message.fileData.metadata?.pages && (
                          <p>页数: {message.fileData.metadata.pages}</p>
                        )}
                        {message.fileData.metadata?.paragraphs && (
                          <p>段落数: {message.fileData.metadata.paragraphs}</p>
                        )}
                        {message.fileData.metadata?.tables && message.fileData.metadata.tables > 0 && (
                          <p>表格数: {message.fileData.metadata.tables}</p>
                        )}
                        <p>提取方法: {message.fileData.metadata?.extraction_method}</p>
                      </div>
                    </div>
                    
                    <div className="file-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#4f46e5' }}>
                        <span>✅</span>
                        <strong>文件内容</strong>
                      </div>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {message.fileData.content}
                      </pre>
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
