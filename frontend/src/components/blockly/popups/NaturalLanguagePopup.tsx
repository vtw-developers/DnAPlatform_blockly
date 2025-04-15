import React, { useState, useRef, useEffect } from 'react';
import { NaturalLanguagePopupProps, ChatMessage, LLMModel } from '../types/blockly.types';
import { codeBlockApi } from '../../../services/api';
import '../styles/Popup.css';

export const NaturalLanguagePopup: React.FC<NaturalLanguagePopupProps> = ({ 
  isOpen, 
  onClose, 
  onCreateBlock 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<LLMModel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'xml' | 'python'>('chat');
  const [xmlInput, setXmlInput] = useState('');
  const [pythonInput, setPythonInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const loadModels = async () => {
    try {
      console.log('모델 목록 로딩 시작');
      const availableModels = await codeBlockApi.getAvailableModels();
      console.log('사용 가능한 모델:', availableModels);
      setModels(availableModels);
      if (availableModels.length > 0) {
        setSelectedModel(availableModels[0]);
        console.log('기본 모델 선택:', availableModels[0]);
      }
    } catch (error) {
      console.error('모델 로딩 중 오류:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !selectedModel) return;

    console.log('메시지 전송 시작:', {
      message: currentMessage,
      selectedModel
    });

    const userMessage: ChatMessage = {
      role: 'user',
      content: currentMessage
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsLoading(true);

    try {
      if (currentMessage.includes('블록 생성해')) {
        console.log('블록 생성 명령어 감지');
        
        const description = currentMessage.replace('블록 생성해', '').trim();
        console.log('블록 생성에 사용될 설명:', description);

        try {
          const blockXml = await codeBlockApi.generateBlockCode(description, selectedModel);
          console.log('생성된 블록 XML:', blockXml);

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
          
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: '블록이 성공적으로 생성되었습니다.'
          };
          setMessages(prev => [...prev, assistantMessage]);

          try {
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
              throw new Error('생성된 XML이 유효하지 않습니다.');
            }

            if (!blockXml.trim().startsWith('<xml')) {
              throw new Error('생성된 XML이 <xml> 태그로 시작하지 않습니다.');
            }

            if (!xmlDoc.getElementsByTagName('block').length) {
              throw new Error('생성된 XML에 블록이 포함되어 있지 않습니다.');
            }

            onCreateBlock(blockXml);
          } catch (blocklyError) {
            console.error('Blockly 블록 생성 중 오류:', blocklyError);
            alert(`블록 생성에 실패했습니다: ${blocklyError instanceof Error ? blocklyError.message : '알 수 없는 오류'}`);
          }
        } catch (error) {
          console.error('블록 생성 중 오류:', error);
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `블록 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: '블록을 생성하려면 "블록 생성해"라고 입력해주세요.'
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('메시지 처리 중 오류:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      };
      setMessages(prev => [...prev, errorMessage]);
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

  const handleXmlSubmit = () => {
    try {
      if (!xmlInput.trim()) {
        alert('XML을 입력해주세요.');
        return;
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlInput, 'text/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('유효하지 않은 XML 형식입니다.');
      }

      if (!xmlInput.trim().startsWith('<xml')) {
        throw new Error('XML은 <xml> 태그로 시작해야 합니다.');
      }

      onCreateBlock(xmlInput);
      setXmlInput('');
      alert('블록이 생성되었습니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : '유효하지 않은 XML입니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="natural-language-popup">
        <div className="popup-header">
          <h2>블록 생성</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            자연어로 생성
          </button>
          <button
            className={`tab-button ${activeTab === 'xml' ? 'active' : ''}`}
            onClick={() => setActiveTab('xml')}
          >
            XML로 생성
          </button>
          <button
            className={`tab-button ${activeTab === 'python' ? 'active' : ''}`}
            onClick={() => setActiveTab('python')}
          >
            Python 코드로 생성
          </button>
        </div>
        {activeTab === 'chat' ? (
          <>
            <div className="model-selector">
              <label>모델 선택:</label>
              <select
                value={selectedModel?.name || ''}
                onChange={(e) => {
                  const model = models.find(m => m.name === e.target.value);
                  if (model) setSelectedModel(model);
                }}
                className="model-select"
              >
                <optgroup label="OpenAI 모델" key="openai-group">
                  {models.filter(m => m.type === 'openai').map((model) => (
                    <option key={`openai-${model.name}`} value={model.name}>
                      {model.name} {model.description ? `- ${model.description}` : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Ollama 모델" key="ollama-group">
                  {models.filter(m => m.type === 'ollama').map((model) => (
                    <option key={`ollama-${model.name}`} value={model.name}>
                      {model.name} {model.description ? `- ${model.description}` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="chat-container" ref={chatContainerRef}>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-message ${message.role}`}
                >
                  <div className="content">{message.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="chat-message assistant">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
            <div className="input-container">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="자연어로 원하는 블록을 설명해주세요..."
              />
              <button onClick={handleSendMessage} disabled={isLoading || !currentMessage.trim() || !selectedModel}>
                전송
              </button>
            </div>
          </>
        ) : activeTab === 'xml' ? (
          <div className="xml-input-container">
            <textarea
              value={xmlInput}
              onChange={(e) => setXmlInput(e.target.value)}
              placeholder="Blockly XML 코드를 입력해주세요..."
              className="xml-input"
            />
            <div className="xml-button-container">
              <button onClick={handleXmlSubmit} className="xml-submit-button">
                블록 생성
              </button>
            </div>
          </div>
        ) : (
          <div className="python-tab">
            <div className="model-selector">
              <label>모델 선택:</label>
              <select
                value={selectedModel?.name}
                onChange={(e) => {
                  const model = models.find(m => m.name === e.target.value);
                  if (model) setSelectedModel(model);
                }}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name} ({model.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="python-input">
              <textarea
                value={pythonInput}
                onChange={(e) => setPythonInput(e.target.value)}
                placeholder="변환할 Python 코드를 입력하세요..."
                rows={10}
              />
            </div>
            <div className="python-actions">
              <button
                onClick={async () => {
                  if (!pythonInput.trim() || !selectedModel) {
                    alert('Python 코드를 입력하고 모델을 선택해주세요.');
                    return;
                  }
                  
                  try {
                    setIsLoading(true);
                    console.log('Python 코드 변환 시작:', {
                      code: pythonInput,
                      model: selectedModel
                    });

                    const blockXml = await codeBlockApi.convertPythonToBlockly(
                      pythonInput,
                      selectedModel.name,
                      selectedModel.type
                    );
                    
                    console.log('변환된 XML:', blockXml);
                    
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
                    
                    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                      throw new Error('생성된 XML이 유효하지 않습니다.');
                    }

                    if (!blockXml.trim().startsWith('<xml')) {
                      throw new Error('생성된 XML이 <xml> 태그로 시작하지 않습니다.');
                    }

                    if (!xmlDoc.getElementsByTagName('block').length) {
                      throw new Error('생성된 XML에 블록이 포함되어 있지 않습니다.');
                    }
                    
                    onCreateBlock(blockXml);
                    setPythonInput('');
                    alert('Python 코드가 성공적으로 블록으로 변환되었습니다.');
                  } catch (error) {
                    console.error('Python 코드 변환 중 오류:', error);
                    alert(`Python 코드 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? '변환 중...' : 'Python 코드 변환'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 