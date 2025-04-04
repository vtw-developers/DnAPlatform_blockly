import React, { useState, useEffect } from 'react';
import { NaturalLanguagePopupProps, LLMModel, ChatMessage } from '../types/blockly';
import { codeBlockApi } from '../services/api';
import './NaturalLanguagePopup.css';

export const NaturalLanguagePopup: React.FC<NaturalLanguagePopupProps> = ({ isOpen, onClose, onCreateBlock }) => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'description' | 'pythonCode'>('description');

  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  const loadModels = async () => {
    try {
      const availableModels = await codeBlockApi.getModels();
      setModels(availableModels);
      if (availableModels.length > 0) {
        setSelectedModel(availableModels[0].name);
      }
    } catch (error) {
      console.error('모델 로딩 실패:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedModel) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message
    };

    setChatHistory(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);

    try {
      const model = models.find(m => m.name === selectedModel);
      if (!model) throw new Error('선택된 모델을 찾을 수 없습니다.');

      let blockXml = '';
      
      if (mode === 'description') {
        // 자연어 설명으로 블록 생성
        blockXml = await codeBlockApi.generateBlockCode(message, model);
      } else {
        // Python 코드를 Blockly XML로 변환
        blockXml = await codeBlockApi.convertPythonToBlockly(message, model.name, model.type);
      }

      if (blockXml) {
        onCreateBlock(blockXml);
        onClose();
      } else {
        throw new Error('블록 생성 실패');
      }
    } catch (error) {
      console.error('블록 생성 중 오류 발생:', error);
      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '죄송합니다. 블록을 생성하는 중에 오류가 발생했습니다.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleMode = () => {
    setMode(prevMode => prevMode === 'description' ? 'pythonCode' : 'description');
    setMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="natural-language-popup">
        <div className="popup-header">
          <h2>{mode === 'description' ? '자연어로 블록 생성' : 'Python 코드로 블록 생성'}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="popup-content">
          <div className="mode-toggle">
            <button
              className={`mode-button ${mode === 'description' ? 'active' : ''}`}
              onClick={() => setMode('description')}
            >
              자연어 설명
            </button>
            <button
              className={`mode-button ${mode === 'pythonCode' ? 'active' : ''}`}
              onClick={() => setMode('pythonCode')}
            >
              Python 코드
            </button>
          </div>
          <div className="model-selector">
            <label htmlFor="model-select">모델 선택:</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading}
            >
              {models.map(model => (
                <option key={model.name} value={model.name}>
                  {model.name} ({model.type})
                </option>
              ))}
            </select>
          </div>
          <div className="chat-history">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="message-input">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={mode === 'description' 
                ? "생성할 블록에 대한 설명을 입력하세요..."
                : "변환할 Python 코드를 입력하세요..."}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || !selectedModel || isLoading}
            >
              {mode === 'description' ? '블록 생성' : '코드 변환'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 