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
  onExecuteCode?: (code: string) => void;
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

const VerificationPopup: React.FC<VerificationPopupProps> = ({ isOpen, onClose, status, result, onExecuteCode }) => {
  if (!isOpen) return null;

  const formatElapsedTime = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes > 0 ? `${minutes}분 ` : ''}${remainingSeconds.toFixed(1)}초`;
  };

  const formatVerificationResult = (code?: string) => {
    if (!code) return '';
    return code
      .split('\n')
      .filter(line => !line.trim().startsWith('#') && line.trim() !== '')
      .join('\n');
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

  const handleExecuteCode = () => {
    if (result?.verificationResult?.result_code && onExecuteCode) {
      onExecuteCode(result.verificationResult.result_code);
      onClose();
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
  const [models, setModels] = useState<ModelInfo[]>([]);
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
        verificationTimerRef.current = null;
      }
    };
  }, []);

  const handleVerificationCodeExecute = (code: string) => {
    setCurrentCode(code);
    handleExecuteCode();
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
          <textarea
            value={currentCode}
            readOnly
            placeholder="Python 코드가 여기에 표시됩니다"
            className="python-code-display"
          />
          <button
            onClick={handleSaveCode}
            disabled={isSaving}
            className="save-button"
          >
            {isSaving ? '저장 중...' : (selectedBlockId ? '수정' : '저장')}
          </button>
        </div>
        <div className="code-execution-container">
          <div className="execution-section">
            <h3 className="section-title">코드 실행</h3>
            <button
              className="execute-button"
              onClick={handleExecuteCode}
              disabled={!currentCode}
            >
              코드 실행
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
                <option value="">모델 목록 로딩 중...</option>
              ) : models.length === 0 ? (
                <option value="">사용 가능한 모델이 없습니다</option>
              ) : (
                models.map((model) => (
                  <option key={model.digest} value={model.name}>
                    {model.name}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={handleVerifyCode}
              disabled={isVerifying || !currentCode || !selectedModel}
              className="verify-button"
            >
              코드 검증
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
        onExecuteCode={handleVerificationCodeExecute}
      />
    </div>
  );
}; 