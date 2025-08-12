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
  onConvert: (snartContent: string) => void;  // snartContent 매개변수 추가
  convertedCode: string;
  currentUser: any;
  sourceCodeTitle: string;
  sourceCodeId: number;
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
}) => {
  const [memo, setMemo] = useState('');
  const [convertedBlocks, setConvertedBlocks] = useState<ConvertedCodeBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ConvertedCodeBlock | null>(null);
  const [displayCode, setDisplayCode] = useState<string>('');
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [ruleCreationStatus, setRuleCreationStatus] = useState<string>('');
  
  useEffect(() => {
    if (isOpen) {
      loadConvertedBlocks();
      setSelectedBlock(null);
      setMemo('');
      setDisplayCode('');
      setRuleCreationStatus('');
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
    
    try {
      // py2js_rules 데이터를 가져와서 .snart 파일 생성
      const snartContent = await generateSnartFile();
      // snart 내용을 onConvert에 전달
      onConvert(snartContent);
    } catch (error) {
      console.error('변환규칙 파일 생성 실패:', error);
      // 에러가 발생해도 변환은 진행 (빈 snart 내용으로)
      onConvert('');
    }
  };

  // .snart 파일 생성 함수 - 다운로드하지 않고 내용만 반환
  const generateSnartFile = async (): Promise<string> => {
    try {
      // 1. py2js_rules 데이터 조회
      const response = await fetch('/api/py2js-rules');
      if (!response.ok) {
        throw new Error('변환규칙 데이터를 가져올 수 없습니다.');
      }
      
      const rules = await response.json();
      
      // 2. rules를 sn 순서대로 정렬 (순서 보장)
      const sortedRules = rules.sort((a: any, b: any) => {
        // sn 필드로 정렬 (sn이 있으면 sn으로, 없으면 인덱스로)
        if (a.sn !== undefined && b.sn !== undefined) {
          return a.sn - b.sn;
        }
        return 0; // 원래 순서 유지
      });
      
      // 3. .snart 파일 형식으로 변환 (올바른 형식)
      let snartContent = '';
      
      sortedRules.forEach((rule: any, index: number) => {
        // 각 rule 블록 시작
        snartContent += `; Rule ${rule.sn || index + 1}\n`;
        
        // examples가 있으면 주석으로 추가
        if (rule.examples && rule.examples.trim()) {
          // 따옴표 이스케이프 처리
          const escapedExamples = rule.examples.replace(/"/g, '\\"').replace(/\n/g, '\\n');
          snartContent += `; examples: "${escapedExamples}"\n`;
        }
        
        // mark가 있으면 주석으로 추가
        if (rule.mark && typeof rule.mark === 'object') {
          snartContent += `; mark: ${JSON.stringify(rule.mark)}\n`;
        }
        
        // rules 내용 추가
        if (rule.rules && rule.rules.trim()) {
          snartContent += `${rule.rules}\n\n`;
        } else {
          snartContent += '\n';
        }
      });
      
      console.log(`${sortedRules.length}개의 변환규칙이 포함된 .snart 내용이 생성되었습니다.`);
      console.log('Snart 내용 미리보기:', snartContent.substring(0, 500));
      return snartContent;
      
    } catch (error) {
      console.error('변환규칙 파일 생성 중 오류:', error);
      throw error;
    }
  };

  // 변환규칙 생성 핸들러
  const handleCreateRule = async () => {
    if (!sourceCodeId || !sourceCodeTitle) {
      alert('원본 코드 정보가 필요합니다.');
      return;
    }

    setIsCreatingRule(true);
    setRuleCreationStatus('변환규칙 생성 요청 중...');
    
    try {
      const response = await codeBlockApi.createTranslationRule(sourceCodeId, sourceCodeTitle);
      setRuleCreationStatus(`변환규칙 생성 요청 완료. DAG Run ID: ${response.dag_run_id}`);
      
      // 잠시 후 상태 메시지 초기화
      setTimeout(() => {
        setRuleCreationStatus('');
      }, 5000);
      
    } catch (error) {
      console.error('변환규칙 생성 실패:', error);
      setRuleCreationStatus('변환규칙 생성 실패. 다시 시도해주세요.');
      
      // 에러 메시지도 잠시 후 초기화
      setTimeout(() => {
        setRuleCreationStatus('');
      }, 5000);
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleSave = async () => {
    if (!displayCode) {
      alert('변환된 코드가 필요합니다.');
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
          displayCode
        );
        alert('변환된 코드가 수정되었습니다.');
      } else {
        // 새로운 코드 저장
        await codeBlockApi.saveConvertedCode(
          sourceCodeId,
          sourceCodeTitle,
          memo,
          displayCode
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
                onClick={handleCreateRule}
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
              {ruleCreationStatus && (
                <div className="console-line info">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">{ruleCreationStatus}</span>
                </div>
              )}
            </div>
          </div>
          
          {(displayCode || selectedBlock) && (
            <div className="result-container">
              <div className="save-form">                                
                <h4>변환된 코드</h4>
                <pre className="converted-code-textarea">
                  {displayCode}
                </pre>
                <div className="source-title">원본 코드: {selectedBlock ? selectedBlock.source_code_title : sourceCodeTitle}</div>
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