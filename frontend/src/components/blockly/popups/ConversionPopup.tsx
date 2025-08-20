import React, { useState, useEffect } from 'react';
import { formatElapsedTime } from '../utils/time';
import { codeBlockApi } from '../../../services/api';
import './ConversionPopup.css';

interface ConvertedCodeBlock {
  id: number;
  title: string;
  description: string;
  converted_code: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
  source_code_title: string;
}

interface ConversionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  dagRunId?: string;
  error?: string;
  isConverting: boolean;
  elapsedTime: number;
  onConvert: (snartContent: string) => void;
  convertedCode: string;
  currentUser: any;
  sourceCodeTitle: string;
  sourceCodeId: number;
  currentCode: string;
  // useConversion 훅에서 관리하는 변환규칙 생성 상태들
  isCreatingRule: boolean;
  ruleCreationStatus: string;
  ruleDagRunId: string | null;
  ruleCreationElapsedTime: number;
  ruleCreationResult: string;
  ruleCreationError: string | null;
  onStartRuleCreation: () => void;
}

export const ConversionPopup: React.FC<ConversionPopupProps> = ({
  isOpen,
  onClose,
  status,
  dagRunId,
  error,
  isConverting,
  elapsedTime,
  onConvert,
  convertedCode,  
  sourceCodeTitle,
  sourceCodeId,
  currentCode,
  // 변환규칙 생성 관련 props
  isCreatingRule,
  ruleCreationStatus,
  ruleDagRunId,
  ruleCreationElapsedTime,
  ruleCreationResult,
  ruleCreationError,
  onStartRuleCreation,
}) => {
  const [memo, setMemo] = useState('');
  const [convertedBlocks, setConvertedBlocks] = useState<ConvertedCodeBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ConvertedCodeBlock | null>(null);
  const [displayCode, setDisplayCode] = useState<string>('');
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  
  useEffect(() => {
    if (isOpen) {
      loadConvertedBlocks();
      setSelectedBlock(null);
      setMemo('');
      setDisplayCode('');
    }
  }, [isOpen]);

  const loadConvertedBlocks = async () => {
    try {
      const response = await codeBlockApi.getConvertedCodes(sourceCodeId);
      setConvertedBlocks(response.blocks);
    } catch (error) {
      console.error('변환된 코드 목록 로딩 실패:', error);
    }
  };

  const handleBlockClick = (block: ConvertedCodeBlock) => {
    setSelectedBlock(block);
    setMemo(block.description);
    setDisplayCode(block.converted_code);
  };

  const handleConvert = async () => {
    setSelectedBlock(null);
    setMemo('');
    setDisplayCode('');
    
    // 변환규칙 처리는 백엔드에서 담당하므로 바로 변환 시작
    onConvert('');
  };

  const handleSave = async () => {
    // 변환된 코드 또는 변환규칙 생성 결과가 있어야 저장 가능
    const codeToSave = ruleCreationResult || displayCode;
    if (!codeToSave) {
      alert('저장할 코드가 필요합니다.');
      return;
    }

    setIsSaving(true);
    try {
      if (selectedBlock) {
        // 기존 코드 수정
        await codeBlockApi.updateConvertedCode(
          selectedBlock.id,
          sourceCodeId,
          memo,
          codeToSave
        );
        alert('변환된 코드가 수정되었습니다.');
      } else {
        // 새로운 코드 저장
        const title = ruleCreationResult ? `${sourceCodeTitle} (변환규칙 생성)` : sourceCodeTitle;
        await codeBlockApi.saveConvertedCode(
          sourceCodeId,
          title,
          memo,
          codeToSave
        );
        alert('변환된 코드가 저장되었습니다.');
      }
      
      setMemo('');
      setDisplayCode('');
      setSelectedBlock(null);
      await loadConvertedBlocks();
    } catch (error) {
      console.error('코드 저장 실패:', error);
      alert('코드 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (convertedCode) {
      setDisplayCode(convertedCode);
    }
  }, [convertedCode]);

  const getStatusClass = () => {
    if (error) return 'error';
    if (status.includes('완료')) return 'success';
    if (isConverting) return 'running';
    return '';
  };

  // 체크박스 토글 핸들러
  const handleCheck = (id: number) => {
    setCheckedIds(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  // 삭제 버튼 클릭 핸들러
  const handleDelete = async () => {
    try {
      await codeBlockApi.deleteConvertedCodes(checkedIds);
      setConvertedBlocks(blocks => blocks.filter(b => !checkedIds.includes(b.id)));
      setCheckedIds([]);
      alert('삭제되었습니다.');
    } catch (error) {
      alert('삭제 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 변환</h3>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-body">
          <div className="converted-blocks-container">
            <h4>저장된 변환 코드 목록</h4>
            <div className="converted-blocks-list">
              {convertedBlocks.map((block) => (
                <div 
                  key={block.id} 
                  className={`converted-block-item ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                  onClick={() => handleBlockClick(block)}
                >
                  <input
                    type="checkbox"
                    checked={checkedIds.includes(block.id)}
                    onChange={e => {
                      e.stopPropagation();
                      handleCheck(block.id);
                    }}
                    style={{ marginRight: 8 }}
                  />
                  <div className="block-header">
                    <span className="block-title">{block.source_code_title}</span>
                    <span className="block-date">
                      {new Date(block.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="block-description">{block.description}</div>
                </div>
              ))}
              {convertedBlocks.length === 0 && (
                <div className="no-blocks">저장된 변환 코드가 없습니다.</div>
              )}
            </div>
          </div>
          <div className="button-group">
            <button 
              className="convert-button primary" 
              onClick={handleConvert}
              disabled={isConverting}
            >
              {isConverting ? '변환 중...' : '변환 시작'}
            </button>
            
            {/* TranslationRuleNotFoundException 에러가 발생한 경우에만 표시 */}
            {(error && (error.includes('TranslationRuleNotFoundException') || 
                        error.includes('TranslationRule') || 
                        error.includes('Rule'))) ||
             (convertedCode && (convertedCode.includes('TranslationRuleNotFoundException') || 
                               convertedCode.includes('TranslationRule') || 
                               convertedCode.includes('Rule'))) ? (
              <button 
                className="create-rule-button secondary" 
                onClick={onStartRuleCreation}
                disabled={isCreatingRule}
              >
                {isCreatingRule ? '규칙 생성 중...' : '변환규칙 생성'}
              </button>
            ) : null}
          </div>
          
          {checkedIds.length > 0 && (
              <button onClick={handleDelete} className="convert-delete-button">
                선택 삭제
              </button>
          )}
          <div className="console-container">
            <div className="console-header">
              <span className="console-title">변환 과정</span>
              {isConverting && (
                <span className="elapsed-time">
                  소요시간: {formatElapsedTime(elapsedTime)}
                </span>
              )}
            </div>
            <div className="console-output">
              <div className={`console-line ${getStatusClass()}`}>
                {status && (
                  <>
                    <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                    <span className="console-message">{status}</span>
                  </>
                )}
              </div>
              {dagRunId && (
                <div className="console-line">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">DAG Run ID: {dagRunId}</span>
                </div>
              )}
              {error && (
                <div className="console-line error">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">오류: {error}</span>
                </div>
              )}
              
              {/* 변환규칙 생성 관련 콘솔 출력 */}
              {ruleCreationStatus && (
                <div className={`console-line ${ruleCreationError ? 'error' : ruleCreationResult ? 'success' : 'info'}`}>
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">{ruleCreationStatus}</span>
                </div>
              )}
              {ruleDagRunId && isCreatingRule && (
                <div className="console-line info">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">DAG Run ID: {ruleDagRunId}</span>
                </div>
              )}
              {isCreatingRule && (
                <div className="console-line info">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">소요시간: {formatElapsedTime(ruleCreationElapsedTime)}</span>
                </div>
              )}
              {ruleCreationError && (
                <div className="console-line error">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">오류: {ruleCreationError}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* 변환된 코드 표시 영역 - 기존 변환 결과 또는 변환규칙 생성 결과 */}
          {(displayCode || selectedBlock || ruleCreationResult) && (
            <div className="result-container">
              <div className="save-form">                                
                <h4>변환된 코드</h4>
                <pre className="converted-code-textarea">
                  {ruleCreationResult || displayCode}
                </pre>
                <div className="source-title">
                  원본 코드: {selectedBlock ? selectedBlock.source_code_title : sourceCodeTitle}
                  {ruleCreationResult && ' (변환규칙 생성 결과)'}
                </div>
                <textarea
                  className="memo-textarea"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  rows={3}
                />
                <button 
                  className="convert-save-button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}          
        </div>
      </div>
    </div>
  );
};

export default ConversionPopup; 