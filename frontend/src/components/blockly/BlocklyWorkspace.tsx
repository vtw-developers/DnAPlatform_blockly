import React, { useRef, useState, useEffect } from 'react';
import { BlocklyWorkspaceProps } from './types/blockly.types';
import { useBlocklySetup } from './hooks/useBlocklySetup';
import { useCodeExecution } from './hooks/useCodeExecution';
import { ExecutionPopup } from './popups/ExecutionPopup';
import { NaturalLanguagePopup } from './popups/NaturalLanguagePopup';
import { VerificationPopup } from './popups/VerificationPopup';
import { ConversionPopup } from './popups/ConversionPopup';
import { CodeBlockList } from '../../components/CodeBlockList';
import { useAuth } from '../../contexts/AuthContext';
import { TOOLBOX_CONFIG } from './configs/toolboxConfig';
import { CodeBlock } from '../../types/CodeBlock';
import * as Blockly from 'blockly';
import { codeBlockApi } from '../../services/api';
import './styles/BlocklyWorkspace.css';
import { useVerification } from './hooks/useVerification';

const BlocklyWorkspace: React.FC<BlocklyWorkspaceProps> = ({ onCodeGenerate }) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const conversionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversionElapsedTimeRef = useRef<NodeJS.Timeout | null>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [isNaturalLanguagePopupOpen, setIsNaturalLanguagePopupOpen] = useState(false);
  const [isExecutionPopupOpen, setIsExecutionPopupOpen] = useState(false);
  const [isConversionPopupOpen, setIsConversionPopupOpen] = useState(false);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [isShared, setIsShared] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<string>('');
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [convertedCode, setConvertedCode] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionDagRunId, setConversionDagRunId] = useState<string | null>(null);
  const [conversionElapsedTime, setConversionElapsedTime] = useState(0);
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [models, setModels] = useState<Array<{ name: string; type: string; description?: string }>>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const {
    isVerificationPopupOpen,
    verificationStatus,
    verificationResult,
    verificationElapsedTime,
    isVerifying,
    handleVerifyCode,
    handleCloseVerificationPopup,
    verificationDagRunId,
    verificationError
  } = useVerification();
  const [selectedBlockUserId, setSelectedBlockUserId] = useState<number | null>(null);

  const { workspace, resetWorkspace } = useBlocklySetup({
    workspaceRef,
    toolboxConfig: TOOLBOX_CONFIG,
    onCodeChange: (code: string) => {
      setCurrentCode(code);
      onCodeGenerate(code);
    }
  });

  const {
    executeCode,
    executionStatus,
    executionResult,
    closeExecutionPopup
  } = useCodeExecution();

  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await codeBlockApi.getModels();
        setModels(response);
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  const handleExecute = () => {
    setIsExecutionPopupOpen(true);
    executeCode(currentCode);
  };

  const handleSave = async () => {
    if (!currentCode.trim()) {
      alert('저장할 코드가 없습니다.');
      return;
    }

    if (!title.trim()) {
      alert('코드 제목을 입력해주세요.');
      return;
    }

    if (selectedBlocks.length > 0 && selectedBlockUserId !== null) {
      if (!user || user.id !== selectedBlockUserId) {
        alert('자신이 작성한 코드만 수정할 수 있습니다.');
        return;
      }
    }

    try {
      const blocklyXml = workspace ? Blockly.Xml.workspaceToDom(workspace) : null;
      const xmlString = blocklyXml ? Blockly.Xml.domToText(blocklyXml) : '';

      const codeBlock = {
        title,
        description,
        code: currentCode,
        blockly_xml: xmlString,
        is_shared: isShared
      };

      if (selectedBlocks.length > 0) {
        // 수정
        await codeBlockApi.updateCodeBlock(parseInt(selectedBlocks[0]), codeBlock);
        alert('코드가 수정되었습니다.');
      } else {
        // 새로 저장
        await codeBlockApi.createCodeBlock(codeBlock);
        alert('코드가 저장되었습니다.');
      }

      setShouldRefresh(true);
    } catch (error) {
      console.error('Error saving code:', error);
      alert('코드 저장에 실패했습니다.');
    }
  };

  const handleCreateBlock = (blockXml: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(blockXml, 'text/xml');
      
      if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Invalid XML format');
      }

      if (workspace) {
        workspace.clear();
        const xml = Blockly.utils.xml.textToDom(blockXml);
        Blockly.Xml.domToWorkspace(xml, workspace);
      }
    } catch (error) {
      console.error('Error creating block:', error);
      alert('블록 생성에 실패했습니다.');
    }
  };

  const handleBlockSelect = (block: CodeBlock) => {
    if (block.blockly_xml) {
      handleCreateBlock(block.blockly_xml);
      setTitle(block.title || '');
      setDescription(block.description || '');
      setIsShared(block.is_shared || false);
      setSelectedBlocks([block.id.toString()]);
      setSelectedBlockUserId(block.user_id || null);
    }
  };

  const handleRefreshComplete = () => {
    setShouldRefresh(false);
  };

  const handleConvert = async () => {
    if (!currentCode.trim()) {
      alert('변환할 코드가 없습니다.');
      return;
    }

    setIsConversionPopupOpen(true);
    setConversionStatus('변환 시작...');
    setConversionError(null);
    setConvertedCode('');
    setIsConverting(true);
    setConversionElapsedTime(0);
    
    try {
      const response = await codeBlockApi.convertCode(currentCode, 'python');
      console.log("Conversion initiated:", response);
      
      if (response.dag_run_id) {
        setConversionDagRunId(response.dag_run_id);
        
        // 상태 폴링 시작
        if (conversionTimerRef.current) {
          clearInterval(conversionTimerRef.current);
        }
        conversionTimerRef.current = setInterval(() => {
          checkConversionResult(response.dag_run_id);
        }, 2000);

        // 경과 시간 타이머 시작
        if (conversionElapsedTimeRef.current) {
          clearInterval(conversionElapsedTimeRef.current);
        }
        conversionElapsedTimeRef.current = setInterval(() => {
          setConversionElapsedTime(prev => prev + 1);
        }, 1000);

      } else {
        throw new Error('DAG 실행 ID를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('Error during conversion initiation:', error);
      setConversionStatus('변환 시작 실패');
      setConversionError(error instanceof Error ? error.message : '변환 시작 중 오류 발생');
      setIsConverting(false);
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
          shouldStopPolling = true;
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
        case 'error':
          setConversionStatus('변환 실패');
          setConversionError(statusResponse.error || 'Airflow DAG 실행 실패 또는 상태 조회 오류');
          shouldStopPolling = true;
          setIsConverting(false);
          break;

        case 'running':
        case 'queued':
          if (conversionStatus !== '변환 진행 중...') {
            setConversionStatus('변환 진행 중...');
          }
          break;

        default:
          setConversionStatus(`상태 알 수 없음: ${statusResponse.state}`);
          break;
      }

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

  const handleCloseConversionPopup = () => {
    setIsConversionPopupOpen(false);
    setConversionStatus('');
    setConversionError(null);
    setIsConverting(false);
    setConversionDagRunId(null);
    setConversionElapsedTime(0);
    
    if (conversionTimerRef.current) {
      clearInterval(conversionTimerRef.current);
      conversionTimerRef.current = null;
    }
    if (conversionElapsedTimeRef.current) {
      clearInterval(conversionElapsedTimeRef.current);
      conversionElapsedTimeRef.current = null;
    }
  };

  const handleReset = () => {
    resetWorkspace();
    // 제목과 설명 초기화
    setTitle('');
    setDescription('');
    // 선택된 블록 ID와 공유 상태도 초기화
    setSelectedBlocks([]);
    setSelectedBlockUserId(null);
    setIsShared(false);
  };

  const handleCloseExecutionPopup = () => {
    closeExecutionPopup();
    setIsExecutionPopupOpen(false);
  };

  const handleToggleShare = async () => {
    if (!selectedBlocks.length) {
      alert('공유할 코드를 선택해주세요.');
      return;
    }

    // 자신의 코드만 공유 가능
    if (selectedBlockUserId !== null && (!user || user.id !== selectedBlockUserId)) {
      alert('자신이 작성한 코드만 공유할 수 있습니다.');
      return;
    }

    try {
      await codeBlockApi.toggleShareCodeBlock(parseInt(selectedBlocks[0]));
      setIsShared(!isShared);
      setShouldRefresh(true);
      alert(isShared ? '공유가 해제되었습니다.' : '코드가 공유되었습니다.');
    } catch (error) {
      console.error('Error toggling share:', error);
      alert('공유 상태 변경에 실패했습니다.');
    }
  };

  return (
    <div className="blockly-container">
      <div className="blockly-workspace-container">
        <div ref={workspaceRef} className="blockly-workspace" />
      </div>
      <div className="right-panel">
        <div className="code-input-container">
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
        <div className="button-container">
          <button className="reset-button" onClick={handleReset}>
            초기화
          </button>
          <button className="save-button" onClick={handleSave}>
            저장
          </button>
          {selectedBlocks.length > 0 && user && user.id === selectedBlockUserId && (
            <button 
              className={`share-button ${isShared ? 'shared' : ''}`} 
              onClick={handleToggleShare}
            >
              {isShared ? '공유 해제' : '공유하기'}
            </button>
          )}
        </div>
        <div className="code-group">
          <h3 className="section-title">생성된 Python 코드</h3>
          <textarea
            value={currentCode}
            readOnly
            className="python-code-display"
          />
          <div className="code-actions">
            <button className="action-button" onClick={handleExecute}>
              코드 실행
            </button>
            <button className="action-button" onClick={handleConvert}>
              코드 변환
            </button>
          </div>
        </div>
        <div className="code-group">
          <h3 className="section-title">변환된 코드</h3>
          <textarea
            value={convertedCode}
            readOnly
            placeholder="변환된 코드가 여기에 표시됩니다"
            className="python-code-display"
          />
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
              onClick={() => handleVerifyCode(currentCode, selectedModel)}
              disabled={isVerifying || !currentCode || !selectedModel || isLoadingModels}
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
            currentUser={user ? {
              id: user.id,
              email: user.email,
              name: user.name
            } : undefined}
          />
        </div>
      </div>

      <ExecutionPopup
        isOpen={isExecutionPopupOpen}
        onClose={handleCloseExecutionPopup}
        status={executionStatus}
        result={executionResult}
      />

      <NaturalLanguagePopup
        isOpen={isNaturalLanguagePopupOpen}
        onClose={() => setIsNaturalLanguagePopupOpen(false)}
        onCreateBlock={handleCreateBlock}
      />

      <VerificationPopup
        isOpen={isVerificationPopupOpen}
        onClose={handleCloseVerificationPopup}
        status={verificationStatus}
        result={verificationResult}
        elapsedTime={verificationElapsedTime}
        dagRunId={verificationDagRunId}
        error={verificationError}
      />

      <ConversionPopup
        isOpen={isConversionPopupOpen}
        onClose={handleCloseConversionPopup}
        status={conversionStatus}
        dagRunId={conversionDagRunId}
        error={conversionError}
        isConverting={isConverting}
        elapsedTime={conversionElapsedTime}
      />
    </div>
  );
};

export default BlocklyWorkspace; 