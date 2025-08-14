import React, { useState, useEffect } from 'react';
import './RulesManagementModal.css';

interface Py2JsRule {
  id: number;
  examples: string | null;
  mark: string | null;
  rules: string;
  is_commented: boolean;
}

interface Py2JsRuleUpdate {
  examples?: string | null;
  mark?: string | null;
  rules?: string;
  is_commented?: boolean;
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
  const [editingRule, setEditingRule] = useState<Py2JsRuleUpdate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

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
    setIsEditing(false);
    setEditingRule(null);
  };

  const handleEditRule = () => {
    if (selectedRule) {
      setEditingRule({
        examples: selectedRule.examples,
        mark: selectedRule.mark,
        rules: selectedRule.rules,
        is_commented: selectedRule.is_commented
      });
      setIsEditing(true);
    }
  };

  const handleSaveRule = async () => {
    if (!selectedRule || !editingRule) return;
    
    try {
      const response = await fetch(`/api/py2js-rules/${selectedRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingRule),
      });
      
      if (response.ok) {
        // 성공적으로 수정된 경우 목록 새로고침
        await fetchRules();
        setIsEditing(false);
        setEditingRule(null);
        // 수정된 규칙으로 selectedRule 업데이트
        const updatedRule = rules.find(r => r.id === selectedRule.id);
        if (updatedRule) {
          setSelectedRule(updatedRule);
        }
      } else {
        alert('규칙 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('규칙 수정 중 오류 발생:', error);
      alert('규칙 수정 중 오류가 발생했습니다.');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingRule(null);
  };

  const handleSelectRule = (ruleId: number, checked: boolean) => {
    const newSelectedRules = new Set(selectedRules);
    if (checked) {
      newSelectedRules.add(ruleId);
    } else {
      newSelectedRules.delete(ruleId);
    }
    setSelectedRules(newSelectedRules);
    
    // 전체 선택 상태 업데이트
    if (checked && newSelectedRules.size === rules.length) {
      setSelectAll(true);
    } else if (!checked) {
      setSelectAll(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allRuleIds = rules.map(rule => rule.id);
      setSelectedRules(new Set(allRuleIds));
      setSelectAll(true);
    } else {
      setSelectedRules(new Set());
      setSelectAll(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRules.size === 0) return;
    
    if (!confirm(`선택된 ${selectedRules.size}개의 규칙을 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      const deletePromises = Array.from(selectedRules).map(ruleId =>
        fetch(`/api/py2js-rules/${ruleId}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      
      // 삭제 후 목록 새로고침
      await fetchRules();
      setSelectedRules(new Set());
      setSelectAll(false);
      
      // 상세보기 중이었다면 목록으로 돌아가기
      if (showDetail) {
        setShowDetail(false);
        setSelectedRule(null);
      }
      
      alert('선택된 규칙이 삭제되었습니다.');
    } catch (error) {
      console.error('규칙 삭제 중 오류 발생:', error);
      alert('규칙 삭제 중 오류가 발생했습니다.');
    }
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
          <button className="close-button" onClick={onClose} title="닫기">
            ✕
          </button>
        </div>

        <div className="rules-modal-content">
          {!showDetail ? (
            // 규칙 목록 화면
            <>
              {loading ? (
                <div className="loading">로딩 중...</div>
              ) : (
                <>
                  {/* 선택된 규칙 삭제 버튼 */}
                  {selectedRules.size > 0 && (
                    <div className="bulk-actions">
                      <button 
                        className="delete-selected-btn"
                        onClick={handleDeleteSelected}
                      >
                        선택된 {selectedRules.size}개 규칙 삭제
                      </button>
                    </div>
                  )}
                  
                  <div className="rules-table-container">
                    <table className="rules-table">
                      <thead>
                        <tr>
                          <th className="checkbox-header">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                          </th>
                          <th>ID</th>
                          <th>규칙 내용</th>
                          <th>예시</th>
                          <th>마킹</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((rule) => (
                          <tr 
                            key={rule.id} 
                            className="rule-row"
                          >
                            <td className="checkbox-cell">
                              <input
                                type="checkbox"
                                checked={selectedRules.has(rule.id)}
                                onChange={(e) => handleSelectRule(rule.id, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td 
                              className="rule-id clickable"
                              onClick={() => handleRuleClick(rule)}
                            >
                              {rule.id}
                            </td>
                            <td 
                              className="rule-content clickable"
                              onClick={() => handleRuleClick(rule)}
                            >
                              {formatRules(rule.rules)}
                            </td>
                            <td 
                              className="rule-examples clickable"
                              onClick={() => handleRuleClick(rule)}
                            >
                              {rule.examples ? truncateText(rule.examples, 60) : '-'}
                            </td>
                            <td 
                              className="rule-mark clickable"
                              onClick={() => handleRuleClick(rule)}
                            >
                              {rule.mark ? truncateText(rule.mark, 40) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
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
                  <div className="detail-header">
                    <h3>규칙 상세 정보 (ID: {selectedRule.id})</h3>
                    {!isEditing && (
                      <button className="edit-button" onClick={handleEditRule}>
                        수정
                      </button>
                    )}
                  </div>
                  
                  {!isEditing ? (
                    // 읽기 전용 모드
                    <>
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
                      
                      <div className="detail-section">
                        <h4>주석 처리 여부</h4>
                        <p>{selectedRule.is_commented ? '주석 처리됨' : '활성 상태'}</p>
                      </div>
                    </>
                  ) : (
                    // 편집 모드
                    <>
                      <div className="detail-section">
                        <h4>변환 규칙</h4>
                        <textarea
                          className="edit-textarea"
                          value={editingRule?.rules || ''}
                          onChange={(e) => setEditingRule(prev => prev ? {...prev, rules: e.target.value} : null)}
                          rows={8}
                        />
                      </div>
                      
                      <div className="detail-section">
                        <h4>예시 코드</h4>
                        <textarea
                          className="edit-textarea"
                          value={editingRule?.examples || ''}
                          onChange={(e) => setEditingRule(prev => prev ? {...prev, examples: e.target.value} : null)}
                          rows={4}
                          placeholder="예시 코드를 입력하세요"
                        />
                      </div>
                      
                      <div className="detail-section">
                        <h4>마킹 정보</h4>
                        <textarea
                          className="edit-textarea"
                          value={editingRule?.mark || ''}
                          onChange={(e) => setEditingRule(prev => prev ? {...prev, mark: e.target.value} : null)}
                          rows={3}
                          placeholder="마킹 정보를 입력하세요"
                        />
                      </div>
                      
                      <div className="detail-section">
                        <h4>주석 처리 여부</h4>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editingRule?.is_commented || false}
                            onChange={(e) => setEditingRule(prev => prev ? {...prev, is_commented: e.target.checked} : null)}
                          />
                          주석 처리
                        </label>
                      </div>
                      
                      <div className="edit-actions">
                        <button className="save-button" onClick={handleSaveRule}>
                          저장
                        </button>
                        <button className="cancel-button" onClick={handleCancelEdit}>
                          취소
                        </button>
                      </div>
                    </>
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
