import React, { useState, useEffect } from 'react';
import './RulesManagementModal.css';

interface Py2JsRule {
  sn: number;
  examples: string | null;
  mark: string | null;
  rules: string;
}

interface RulesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesManagementModal: React.FC<RulesManagementModalProps> = ({
  isOpen,
  onClose
}) => {
  const [rules, setRules] = useState<Py2JsRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Py2JsRule | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRules();
    }
  }, [isOpen]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/py2js-rules');
      if (response.ok) {
        const data = await response.json();
        setRules(data);
      } else {
        console.error('규칙 데이터를 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 데이터 요청 중 오류 발생:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRuleClick = (rule: Py2JsRule) => {
    setSelectedRule(rule);
    setShowDetail(true);
  };

  const handleBackToList = () => {
    setShowDetail(false);
    setSelectedRule(null);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const formatRules = (rules: string) => {
    // rules 내용이 너무 길면 뒷부분 생략
    return truncateText(rules, 80);
  };

  if (!isOpen) return null;

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-modal-header">
          <h2>Python to JavaScript 변환규칙 관리</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="rules-modal-content">
          {!showDetail ? (
            // 규칙 목록 화면
            <>
              {loading ? (
                <div className="loading">로딩 중...</div>
              ) : (
                <div className="rules-table-container">
                  <table className="rules-table">
                    <thead>
                      <tr>
                        <th>순번</th>
                        <th>규칙 내용</th>
                        <th>예시</th>
                        <th>마킹</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr 
                          key={rule.sn} 
                          className="rule-row"
                          onClick={() => handleRuleClick(rule)}
                        >
                          <td className="rule-sn">{rule.sn}</td>
                          <td className="rule-content">
                            {formatRules(rule.rules)}
                          </td>
                          <td className="rule-examples">
                            {rule.examples ? truncateText(rule.examples, 60) : '-'}
                          </td>
                          <td className="rule-mark">
                            {rule.mark ? truncateText(rule.mark, 40) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            // 상세 화면
            <div className="rule-detail">
              <button className="back-button" onClick={handleBackToList}>
                ← 목록으로 돌아가기
              </button>
              
              {selectedRule && (
                <div className="detail-content">
                  <h3>규칙 상세 정보 (순번: {selectedRule.sn})</h3>
                  
                  <div className="detail-section">
                    <h4>변환 규칙</h4>
                    <pre className="rules-code">{selectedRule.rules}</pre>
                  </div>
                  
                  {selectedRule.examples && (
                    <div className="detail-section">
                      <h4>예시 코드</h4>
                      <pre className="examples-code">{selectedRule.examples}</pre>
                    </div>
                  )}
                  
                  {selectedRule.mark && (
                    <div className="detail-section">
                      <h4>마킹 정보</h4>
                      <pre className="mark-info">{selectedRule.mark}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
