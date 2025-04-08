import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { CodeBlock } from '../types/CodeBlock';
import { CodeBlockList } from './CodeBlockList';
import { codeBlockApi } from '../services/api';
import type { ModelInfo } from '../services/api';
import './BlocklyWorkspace.css';

interface BlocklyWorkspaceProps {
  onCodeGenerate: (code: string) => void;
}

interface ExecutionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: {
    output?: string;
    error?: string;
  } | null;
}

interface ExecutionResult {
  output?: string;
  error?: string;
}

interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: {
    dag_run_id?: string;
    error?: string;
    verificationResult?: {
      elapsed_time?: number;
      result_code?: string;
      message?: string;
    };
  } | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface NaturalLanguagePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlock: (blockXml: string) => void;
}

interface LLMModel {
  name: string;
  type: 'ollama' | 'openai';
  modified_at?: string;
  size?: number;
  description?: string;
}

const TOOLBOX_CONFIG = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: '로직',
      categorystyle: 'logic_category',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_null' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category',
      name: '반복',
      categorystyle: 'loop_category',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_repeat' },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for' },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category',
      name: '수학',
      categorystyle: 'math_category',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_trig' },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_number_property' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_on_list' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_constrain' },
        { kind: 'block', type: 'math_random_int' },
        { kind: 'block', type: 'math_random_float' },
        { kind: 'block', type: 'math_atan2' },        
      ]
    },
    {
      kind: 'category',
      name: '텍스트',
      categorystyle: 'text_category',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_multiline' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_isEmpty' },
        { kind: 'block', type: 'text_indexOf' },
        { kind: 'block', type: 'text_charAt' },
        { kind: 'block', type: 'text_getSubstring' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_count' },
        { kind: 'block', type: 'text_replace' },
        { kind: 'block', type: 'text_reverse' },
        { kind: 'block', type: 'text_print' },
        { kind: 'block', type: 'text_prompt_ext' }
      ]
    },
    {
      kind: 'category',
      name: '리스트',
      categorystyle: 'list_category',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_repeat' },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_indexOf' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_getSublist' },
        { kind: 'block', type: 'lists_split' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_reverse' }
      ]
    },
    {
      kind: 'category',
      name: '색상',
      categorystyle: 'colour_category',
      contents: [
        { kind: 'block', type: 'colour_picker' },
        { kind: 'block', type: 'colour_random' },
        { kind: 'block', type: 'colour_rgb' },
        { kind: 'block', type: 'colour_blend' }
      ]
    },
    {
      kind: 'category',
      name: '변수',
      categorystyle: 'variable_category',
      custom: 'VARIABLE'
    },
    {
      kind: 'category',
      name: '함수',
      categorystyle: 'procedure_category',
      custom: 'PROCEDURE'
    },
    {
      kind: 'category',
      name: '자연어 코드',
      categorystyle: 'procedure_category',
      contents: [
        {
          kind: 'button',
          text: '자연어로 블록 생성',
          callbackKey: 'NATURAL_LANGUAGE'
        }
      ]
    }
  ]
};

const ExecutionPopup: React.FC<ExecutionPopupProps> = ({ isOpen, onClose, status, result }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 실행</h3>
          {status !== '실행 중...' && (
            <button className="popup-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="popup-body">
          <div className="execution-status">
            {status === '실행 중...' && <div className="status-spinner" />}
            <span>{status}</span>
          </div>
          {result && (
            <div className={`popup-result ${result.error ? 'error' : 'success'}`}>
              <pre>{result.output || result.error}</pre>
            </div>
          )}
        </div>
        <div className="popup-footer">
          {status !== '실행 중...' && (
            <button className="popup-button primary" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const VerificationPopup: React.FC<VerificationPopupProps> = ({ isOpen, onClose, status, result }) => {
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 검증이 시작되면 타이머 시작
    if (status === '검증 중...') {
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      // 검증이 완료되거나 실패하면 타이머 정지
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  if (!isOpen) return null;

  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes > 0 ? `${minutes}분 ` : ''}${remainingSeconds}초`;
  };

  const formatVerificationResult = (code?: string) => {
    if (!code) return '';
    try {
      return code
        .split('\n')
        .filter(line => !line.trim().startsWith('#') && line.trim() !== '')
        .join('\n');
    } catch (error) {
      console.error('코드 포맷팅 중 오류:', error);
      return String(code);
    }
  };

  const handleCopyCode = async () => {
    if (result?.verificationResult?.result_code) {
      try {
        await navigator.clipboard.writeText(result.verificationResult.result_code);
        alert('코드가 클립보드에 복사되었습니다.');
      } catch (error) {
        console.error('코드 복사 중 오류:', error);
        alert('코드 복사에 실패했습니다.');
      }
    }
  };

  const handleExecuteCode = async () => {
    if (!result?.verificationResult?.result_code) return;

    setExecutionStatus('실행 중...');
    setExecutionResult(null);

    try {
      const executeResult = await codeBlockApi.executeCode(result.verificationResult.result_code);
      setExecutionStatus('실행 완료');
      setExecutionResult({
        output: executeResult.output || '',
        error: executeResult.error || ''
      });
    } catch (error) {
      setExecutionStatus('실행 실패');
      setExecutionResult({
        output: '',
        error: '코드 실행 중 오류가 발생했습니다.'
      });
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content verification-popup">
        <div className="popup-header">
          <h3>코드 검증</h3>
          {status !== '검증 중...' && (
            <button className="popup-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="popup-body">
          <div className="execution-status">
            {status === '검증 중...' && <div className="status-spinner" />}
            <span>{status}</span>
            <span className="elapsed-time">
              (소요시간: {formatElapsedTime(elapsedTime)})
            </span>
          </div>
          {result && (
            <div className={`popup-result ${result.error ? 'error' : 'success'}`}>
              {result.error ? (
                <pre className="error-message">{result.error}</pre>
              ) : result.verificationResult ? (
                <div className="verification-details">
                  {result.verificationResult.message && (
                    <div className="verification-message">
                      {result.verificationResult.message}
                    </div>
                  )}
                  {result.verificationResult.result_code && (
                    <div className="verification-code">
                      <div className="code-header">
                        <span>검증 결과:</span>
                        <div className="code-actions">
                          <button onClick={handleCopyCode} className="code-action-button">
                            복사
                          </button>
                          <button onClick={handleExecuteCode} className="code-action-button">
                            실행
                          </button>
                        </div>
                      </div>
                      <pre className="code-snippet">
                        <code>{formatVerificationResult(result.verificationResult.result_code)}</code>
                      </pre>
                      {executionStatus && (
                        <div className="execution-result-container">
                          <div className="execution-status">
                            {executionStatus === '실행 중...' && <div className="status-spinner" />}
                            <span>{executionStatus}</span>
                          </div>
                          {executionResult && (
                            <div className={`execution-result ${executionResult.error ? 'error' : 'success'}`}>
                              <pre>{executionResult.output || executionResult.error}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <pre>검증이 시작되었습니다.{'\n'}DAG Run ID: {result.dag_run_id}</pre>
              )}
            </div>
          )}
        </div>
        <div className="popup-footer">
          {status !== '검증 중...' && (
            <button className="popup-button primary" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const NaturalLanguagePopup: React.FC<NaturalLanguagePopupProps> = ({ isOpen, onClose, onCreateBlock }) => {
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

  // 팝업이 열릴 때 모델 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen]);

  // 메시지가 추가될 때마다 스크롤
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
        
        // 현재 메시지를 설명으로 사용
        const description = currentMessage.replace('블록 생성해', '').trim();
        console.log('블록 생성에 사용될 설명:', description);

        try {
          const blockXml = await codeBlockApi.generateBlockCode(description, selectedModel);
          console.log('생성된 블록 XML:', blockXml);

          // XML 유효성 검사
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
          
          // 먼저 성공 메시지를 채팅에 표시
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: '블록이 성공적으로 생성되었습니다.'
          };
          setMessages(prev => [...prev, assistantMessage]);

          // 그 다음 Blockly에 적용 시도
          try {
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
              throw new Error('생성된 XML이 유효하지 않습니다.');
            }

            // XML이 <xml> 태그로 시작하는지 확인
            if (!blockXml.trim().startsWith('<xml')) {
              throw new Error('생성된 XML이 <xml> 태그로 시작하지 않습니다.');
            }

            // block 태그가 있는지 확인
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

      // XML 유효성 검사
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlInput, 'text/xml');
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('유효하지 않은 XML 형식입니다.');
      }

      // XML이 <xml> 태그로 시작하는지 확인
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
                    
                    // XML 유효성 검사
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
                    
                    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
                      throw new Error('생성된 XML이 유효하지 않습니다.');
                    }

                    // XML이 <xml> 태그로 시작하는지 확인
                    if (!blockXml.trim().startsWith('<xml')) {
                      throw new Error('생성된 XML이 <xml> 태그로 시작하지 않습니다.');
                    }

                    // block 태그가 있는지 확인
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

// Helper function to format time (if not already defined globally)
const formatElapsedTime = (seconds: number): string => {
  if (seconds < 0) return '0초';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes > 0 ? `${minutes}분 ` : ''}${remainingSeconds}초`;
};

export const BlocklyWorkspace: React.FC<BlocklyWorkspaceProps> = ({ onCodeGenerate }) => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);
  const [shouldRefresh, setShouldRefresh] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedConversionModel, setSelectedConversionModel] = useState<string>("");
  const [models, setModels] = useState<LLMModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('');
  const [isVerificationPopupOpen, setIsVerificationPopupOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [verificationResult, setVerificationResult] = useState<{
    dag_run_id?: string;
    error?: string;
    verificationResult?: {
      elapsed_time?: number;
      result_code?: string;
      message?: string;
    };
  } | null>(null);
  const verificationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isNaturalLanguagePopupOpen, setIsNaturalLanguagePopupOpen] = useState(false);
  const [convertedCode, setConvertedCode] = useState<string>('');
  const [isConversionPopupOpen, setIsConversionPopupOpen] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('');
  const [conversionDagRunId, setConversionDagRunId] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const conversionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversionElapsedTimeRef = useRef<NodeJS.Timeout | null>(null);
  const [conversionElapsedTime, setConversionElapsedTime] = useState<number>(0);

  useEffect(() => {
    if (blocklyDiv.current && !workspaceRef.current) {
      try {
        const workspace = Blockly.inject(blocklyDiv.current, {
          toolbox: TOOLBOX_CONFIG,
          scrollbars: true,
          move: {
            drag: true,
            wheel: true
          },
          zoom: {
            controls: true,
            wheel: true,
            startScale: 1.0,
            maxScale: 3,
            minScale: 0.3,
            scaleSpeed: 1.2
          },
          grid: {
            spacing: 20,
            length: 3,
            colour: '#ccc',
            snap: true
          },
          trashcan: true,
          renderer: 'geras'
        });

        workspaceRef.current = workspace;

        const onWorkspaceChange = (event: Blockly.Events.Abstract) => {
          if (!workspace) return;

          if (event.type === Blockly.Events.BLOCK_CHANGE || 
              event.type === Blockly.Events.BLOCK_CREATE ||
              event.type === Blockly.Events.BLOCK_DELETE ||
              event.type === Blockly.Events.BLOCK_MOVE) {
            try {
              const code = pythonGenerator.workspaceToCode(workspace);
              handleCodeGeneration(code);
            } catch (e) {
              console.error('Python 코드 생성 중 오류:', e);
            }
          }
        };

        workspace.addChangeListener(onWorkspaceChange);

        const code = pythonGenerator.workspaceToCode(workspace);
        handleCodeGeneration(code);

        // 윈도우 리사이즈 이벤트 핸들러 추가
        const handleResize = () => {
          if (workspace) {
            Blockly.svgResize(workspace);
          }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        workspace.registerButtonCallback('NATURAL_LANGUAGE', () => {
          setIsNaturalLanguagePopupOpen(true);
        });

        return () => {
          if (workspace) {
            workspace.removeChangeListener(onWorkspaceChange);
            window.removeEventListener('resize', handleResize);
            workspace.dispose();
            workspaceRef.current = null;
          }
        };
      } catch (error) {
        console.error('Blockly 워크스페이스 초기화 중 오류:', error);
      }
    }
  }, []);

  // 모델 목록 로드
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoadingModels(true);
        const modelList = await codeBlockApi.getModels();
        setModels(modelList);
        if (modelList.length > 0) {
          setSelectedModel(modelList[0].name);
        }
      } catch (error) {
        console.error('모델 목록 로드 중 오류:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  const handleCodeGeneration = (code: string) => {
    setCurrentCode(code);
    onCodeGenerate(code);
  };

  const handleExecuteCode = async () => {
    if (!currentCode) {
      alert('실행할 코드가 없습니다.');
      return;
    }

    setIsPopupOpen(true);
    setExecutionStatus('실행 중...');
    setExecutionResult(null);

    try {
      const result = await codeBlockApi.executeCode(currentCode);
      setExecutionStatus('실행 완료');
      setExecutionResult({
        output: result.output || '',
        error: result.error || ''
      });
    } catch (error) {
      setExecutionStatus('실행 실패');
      setExecutionResult({
        output: '',
        error: '코드 실행 중 오류가 발생했습니다.'
      });
    }
  };

  const checkVerificationResult = async (dagRunId: string) => {
    try {
      const result = await codeBlockApi.getVerificationResult(dagRunId);
      console.log('검증 결과:', result); // 디버깅용 로그 추가
      
      if (result.status === 'SUCCESS' && result.result) {
        const { elapsed_time = 0, result_code = '', message = '' } = result.result;
        setVerificationStatus('검증 완료');
        setVerificationResult(prev => ({
          ...prev,
          verificationResult: {
            elapsed_time,
            result_code,
            message
          }
        }));
        if (verificationTimerRef.current) {
          clearInterval(verificationTimerRef.current);
          verificationTimerRef.current = null;
        }
      } else if (result.status === 'ERROR') {
        setVerificationStatus('검증 실패');
        setVerificationResult(prev => ({
          ...prev,
          error: result.error || '검증 중 오류가 발생했습니다.'
        }));
        if (verificationTimerRef.current) {
          clearInterval(verificationTimerRef.current);
          verificationTimerRef.current = null;
        }
      } else {
        setVerificationStatus('검증 중...');
      }
    } catch (error) {
      console.error('검증 결과 조회 중 오류:', error);
      setVerificationStatus('검증 실패');
      setVerificationResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '검증 결과 조회 중 오류가 발생했습니다.'
      }));
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
        verificationTimerRef.current = null;
      }
    }
  };

  const handleVerifyCode = async () => {
    if (!currentCode) {
      alert('검증할 코드가 없습니다.');
      return;
    }

    // 이전 타이머가 있다면 제거
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }

    setIsVerificationPopupOpen(true);
    setVerificationStatus('검증 중...');
    setVerificationResult(null);

    try {
      const result = await codeBlockApi.verifyCode(currentCode, selectedModel);
      setVerificationResult({
        dag_run_id: result.dag_run_id
      });

      // 10초 간격으로 결과 확인
      verificationTimerRef.current = setInterval(
        () => checkVerificationResult(result.dag_run_id),
        10000
      );
    } catch (error) {
      console.error('코드 검증 중 오류:', error);
      setVerificationStatus('검증 실패');
      setVerificationResult({
        error: error instanceof Error ? error.message : '코드 검증 중 알 수 없는 오류가 발생했습니다.'
      });
    }
  };

  const resetWorkspace = () => {
    // Blockly 작업화면 초기화
    const workspace = workspaceRef.current;
    if (workspace) {
      workspace.clear();
      const code = pythonGenerator.workspaceToCode(workspace);
      handleCodeGeneration(code);
    }

    // 입력 필드 초기화
    setTitle('');
    setDescription('');
    setSelectedBlockId(null);
    setExecutionResult(null);
  };

  const handleSaveCode = async () => {
    if (!currentCode || !title || !description) {
      alert('제목, 설명, 코드를 모두 입력해주세요.');
      return;
    }

    try {
      setIsSaving(true);
      const workspace = workspaceRef.current;
      if (!workspace) {
        throw new Error('워크스페이스를 찾을 수 없습니다.');
      }

      const dom = Blockly.Xml.workspaceToDom(workspace);
      const blockly_xml = Blockly.Xml.domToText(dom);

      if (selectedBlockId) {
        // 기존 코드 블록 수정
        await codeBlockApi.updateCodeBlock(selectedBlockId, {
          title,
          description,
          code: currentCode,
          blockly_xml
        });
        alert('코드가 성공적으로 수정되었습니다!');
      } else {
        // 새로운 코드 블록 생성
        await codeBlockApi.createCodeBlock({
          title,
          description,
          code: currentCode,
          blockly_xml
        });
        alert('코드가 성공적으로 저장되었습니다!');
      }

      // 저장 후 초기화
      resetWorkspace();
      setShouldRefresh(true);
    } catch (error) {
      console.error('코드 저장 중 오류:', error);
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('코드 저장 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlockSelect = async (block: CodeBlock) => {
    try {
      setTitle(block.title);
      setDescription(block.description);
      setSelectedBlockId(block.id);
      
      const workspace = workspaceRef.current;
      if (!workspace || !block.blockly_xml) {
        throw new Error('워크스페이스를 찾을 수 없거나 Blockly XML이 없습니다.');
      }

      workspace.clear();
      const xml = Blockly.Xml.textToDom(block.blockly_xml);
      Blockly.Xml.domToWorkspace(xml, workspace);
    } catch (error) {
      console.error('코드 블록 로드 중 오류:', error);
      alert('코드 블록을 불러오는데 실패했습니다.');
    }
  };

  const handleRefreshComplete = () => {
    setShouldRefresh(false);
  };

  const handleClosePopup = () => {
    setIsPopupOpen(false);
    setExecutionStatus('');
    setExecutionResult(null);
  };

  const handleCloseVerificationPopup = () => {
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    setIsVerificationPopupOpen(false);
    setVerificationStatus('');
    setVerificationResult(null);
  };

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (verificationTimerRef.current) {
        clearInterval(verificationTimerRef.current);
      }
      if (conversionTimerRef.current) {
        clearInterval(conversionTimerRef.current);
      }
      if (conversionElapsedTimeRef.current) {
        clearInterval(conversionElapsedTimeRef.current);
      }
    };
  }, []);

  const handleVerificationCodeExecute = (code: string) => {
    setCurrentCode(code);
    handleExecuteCode();
  };

  // 자연어로 생성된 블록 추가 함수
  const handleCreateBlock = (blockXml: string) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    try {
      const xml = Blockly.Xml.textToDom(blockXml);
      Blockly.Xml.domToWorkspace(xml, workspace);
    } catch (error) {
      console.error('블록 생성 중 오류:', error);
      alert('블록 생성에 실패했습니다.');
    }
  };

  const checkConversionResult = async (runId: string) => {
    let shouldStopPolling = false;
    try {
      const statusResponse = await codeBlockApi.getConversionStatus(runId);
      console.log("Conversion status check (backend):", statusResponse);

      switch (statusResponse.state) {
        case 'success':
          setConversionStatus('변환 성공, 결과 가져오는 중...');
          shouldStopPolling = true; // Stop polling timer
          const resultResponse = await codeBlockApi.getConversionResult(runId);
          console.log("Conversion result check (backend):", resultResponse);
          if (resultResponse.value) {
            setConvertedCode(resultResponse.value);
            setConversionStatus('변환 완료');
          } else {
            setConvertedCode('// 변환 결과 없음');
            setConversionStatus('변환 성공 (결과 없음)');
            setConversionError(resultResponse.error || '성공했으나 결과를 가져오지 못했습니다.');
          }
          setIsConverting(false);
          break;

        case 'failed':
        case 'error': // Treat backend error state same as failed state
          setConversionStatus('변환 실패');
          setConversionError(statusResponse.error || 'Airflow DAG 실행 실패 또는 상태 조회 오류');
          shouldStopPolling = true;
          setIsConverting(false);
          break;

        case 'running':
        case 'queued': // Keep showing 'running' status even when queued
          // Ensure the status is set to 'running' if it wasn't already
          if (conversionStatus !== '변환 진행 중...') {
              setConversionStatus('변환 진행 중...');
          }
          // Continue polling
          break;

        default: // Handle unknown or other unexpected states
          setConversionStatus(`상태 알 수 없음: ${statusResponse.state}`);
          // Continue polling for now, maybe add a timeout later
          break;
      }

      // Clear timer if needed
      if (shouldStopPolling) {
        if (conversionTimerRef.current) {
          clearInterval(conversionTimerRef.current);
          conversionTimerRef.current = null;
          console.log("Conversion polling timer stopped.");
        }
        if (conversionElapsedTimeRef.current) {
          clearInterval(conversionElapsedTimeRef.current);
          conversionElapsedTimeRef.current = null;
          console.log("Conversion elapsed time timer stopped.");
        }
      }

    } catch (error) {
      // This catch block might not be reached if api.ts handles errors, but added for safety
      console.error('Error during conversion status check process:', error);
      setConversionStatus('폴링 오류');
      setConversionError(error instanceof Error ? error.message : '상태/결과 확인 중 오류');
      if (conversionTimerRef.current) {
        clearInterval(conversionTimerRef.current);
        conversionTimerRef.current = null;
        console.log("Conversion polling timer stopped due to error.");
      }
      if (conversionElapsedTimeRef.current) {
        clearInterval(conversionElapsedTimeRef.current);
        conversionElapsedTimeRef.current = null;
        console.log("Conversion elapsed time timer stopped due to error.");
      }
      setIsConverting(false);
    }
  };

  const handleConvertCode = async () => {
    if (!currentCode || !selectedConversionModel) {
      alert("먼저 Python 코드를 생성하고 변환 모델을 선택하세요.");
      return;
    }

    // Clear previous timers
    if (conversionTimerRef.current) clearInterval(conversionTimerRef.current);
    if (conversionElapsedTimeRef.current) clearInterval(conversionElapsedTimeRef.current);
    conversionTimerRef.current = null;
    conversionElapsedTimeRef.current = null;

    // Reset states
    setIsConversionPopupOpen(true);
    setConversionStatus('변환 요청 중...');
    setConversionError(null);
    setIsConverting(true);
    setConversionDagRunId(null);
    setConvertedCode('');
    setConversionElapsedTime(0); // Reset elapsed time

    // Start elapsed time timer
    conversionElapsedTimeRef.current = setInterval(() => {
      setConversionElapsedTime(prev => prev + 1);
    }, 1000);
    console.log("Conversion elapsed time timer started.");

    try {
      console.log(`Requesting conversion (via backend): Code=${currentCode.substring(0,100)}..., Model=${selectedConversionModel}`);
      const result = await codeBlockApi.convertCode(currentCode, selectedConversionModel);
      setConversionDagRunId(result.dag_run_id);
      setConversionStatus('변환 진행 중...');

      // Start status polling timer
      conversionTimerRef.current = setInterval(() => {
        checkConversionResult(result.dag_run_id);
      }, 5000); // Poll every 5 seconds
      console.log("Conversion status polling timer started.");

      // Initial check immediately
      checkConversionResult(result.dag_run_id);

    } catch (error) {
      console.error("Failed to initiate code conversion (via backend):", error);
      setConversionStatus('변환 요청 실패');
      setConversionError(error instanceof Error ? error.message : '알 수 없는 오류 발생');
      setIsConverting(false);
      // Stop both timers on initial request error
      if (conversionTimerRef.current) clearInterval(conversionTimerRef.current);
      if (conversionElapsedTimeRef.current) clearInterval(conversionElapsedTimeRef.current);
      conversionTimerRef.current = null;
      conversionElapsedTimeRef.current = null;
      console.log("All conversion timers stopped due to request error.");
    }
  };

  const handleCloseConversionPopup = () => {
    if (conversionTimerRef.current) {
      clearInterval(conversionTimerRef.current);
      conversionTimerRef.current = null;
      console.log("Conversion polling timer stopped on popup close.");
    }
    if (conversionElapsedTimeRef.current) {
      clearInterval(conversionElapsedTimeRef.current);
      conversionElapsedTimeRef.current = null;
      console.log("Conversion elapsed time timer stopped on popup close.");
    }
    setIsConversionPopupOpen(false);
    setConversionStatus('');
    setConversionError(null);
    setIsConverting(false);
    setConversionDagRunId(null);
  };

  return (
    <div className="blockly-container">
      <div className="blockly-workspace-container">
        <div ref={blocklyDiv} id="blocklyDiv" className="blockly-workspace" />
      </div>
      <div className="right-panel">
        <div className="code-input-container">
          <div className="button-container">
            <button
              onClick={resetWorkspace}
              className="reset-button"
              type="button"
            >
              초기화
            </button>
            <button
              onClick={handleSaveCode}
              disabled={isSaving || !currentCode || !title || !description}
              className="save-button"
            >
              {isSaving ? '저장 중...' : (selectedBlockId ? '수정' : '저장')}
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="코드 제목"
            className="code-title-input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="코드 설명"
            className="code-description-input"
          />
        </div>

        <div className="code-group">
          <h3 className="section-title">Python 코드</h3>
          <textarea
            value={currentCode}
            readOnly
            placeholder="Python 코드가 여기에 표시됩니다"
            className="python-code-display"
          />
          <button
            className="execute-button action-button"
            onClick={handleExecuteCode}
            disabled={!currentCode}
          >
            코드 실행
          </button>
        </div>

        <div className="code-group">
          <h3 className="section-title">변환된 코드</h3>
          <textarea
            value={convertedCode}
            readOnly
            placeholder="변환된 코드가 여기에 표시됩니다"
            className="python-code-display"
          />
          <div className="verify-container">
            <select
              value={selectedConversionModel}
              onChange={(e) => setSelectedConversionModel(e.target.value)}
              className="model-select"
              disabled={isLoadingModels || models.length === 0}
            >
              {isLoadingModels ? (
                <option key="loading" value="">모델 목록 로딩 중...</option>
              ) : models.length === 0 ? (
                <option key="empty" value="">사용 가능한 모델이 없습니다</option>
              ) : (
                <>
                  <optgroup label="OpenAI 모델" key="openai-group">
                    {models.filter(m => m.type === 'openai').map((model) => (
                      <option key={`conv-openai-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ollama 모델" key="ollama-group">
                    {models.filter(m => m.type === 'ollama').map((model) => (
                      <option key={`conv-ollama-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            <button
              className="execute-button action-button"
              onClick={handleConvertCode}
              disabled={!currentCode || !selectedConversionModel}
            >
              코드 변환
            </button>
          </div>
        </div>

        <div className="verification-section">
          <h3 className="section-title">코드 검증</h3>
          <div className="verify-container">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select"
              disabled={isLoadingModels || models.length === 0}
            >
              {isLoadingModels ? (
                <option key="loading" value="">모델 목록 로딩 중...</option>
              ) : models.length === 0 ? (
                <option key="empty" value="">사용 가능한 모델이 없습니다</option>
              ) : (
                 <>
                  <optgroup label="OpenAI 모델" key="openai-group">
                    {models.filter(m => m.type === 'openai').map((model) => (
                      <option key={`verify-openai-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ollama 모델" key="ollama-group">
                    {models.filter(m => m.type === 'ollama').map((model) => (
                      <option key={`verify-ollama-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                 </>
              )}
            </select>
            <button
              onClick={handleVerifyCode}
              disabled={isVerifying || !currentCode || !selectedModel}
              className="verify-button"
            >
              {isVerifying ? '검증 중...' : '코드 검증'}
            </button>
          </div>
        </div>
        <div className="saved-codes-section">
          <h3 className="section-title">저장된 코드 목록</h3>
          <CodeBlockList
            onSelectBlock={handleBlockSelect}
            shouldRefresh={shouldRefresh}
            onRefreshComplete={handleRefreshComplete}
            onDeleteComplete={resetWorkspace}
          />
        </div>
      </div>
      <ExecutionPopup
        isOpen={isPopupOpen}
        onClose={handleClosePopup}
        status={executionStatus}
        result={executionResult}
      />
      <VerificationPopup
        isOpen={isVerificationPopupOpen}
        onClose={handleCloseVerificationPopup}
        status={verificationStatus}
        result={verificationResult}
      />
      <NaturalLanguagePopup
        isOpen={isNaturalLanguagePopupOpen}
        onClose={() => setIsNaturalLanguagePopupOpen(false)}
        onCreateBlock={handleCreateBlock}
      />
      {isConversionPopupOpen && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div className="popup-header">
              <h3>코드 변환</h3>
              {(!isConverting || conversionStatus === '변환 완료' || conversionStatus.includes('실패') || conversionStatus.includes('오류') || conversionStatus.includes('없음')) && (
                <button className="popup-close" onClick={handleCloseConversionPopup}>&times;</button>
              )}
            </div>
            <div className="popup-body">
              <div className="execution-status">
                {(conversionStatus === '변환 요청 중...' || conversionStatus === '변환 진행 중...' || conversionStatus === '변환 성공, 결과 가져오는 중...') && <div className="status-spinner" />}
                <span>{conversionStatus}</span>
                {(isConverting || conversionStatus === '변환 진행 중...' || conversionStatus === '변환 성공, 결과 가져오는 중...') && (
                  <span className="elapsed-time">
                    (소요시간: {formatElapsedTime(conversionElapsedTime)})
                  </span>
                )}
              </div>
              {conversionDagRunId && <p>DAG Run ID: {conversionDagRunId}</p>}
              {conversionError && <pre>오류: {conversionError}</pre>}
            </div>
            <div className="popup-footer">
              {(!isConverting || conversionStatus === '변환 완료' || conversionStatus.includes('실패') || conversionStatus.includes('오류') || conversionStatus.includes('없음')) && (
                <button className="popup-button primary" onClick={handleCloseConversionPopup}>
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 