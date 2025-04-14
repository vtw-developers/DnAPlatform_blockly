import { useState } from 'react';
import { codeBlockApi } from '../services/api';
import { ExecutionResult } from '../types/blockly';

export const useCodeExecution = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [showExecutionPopup, setShowExecutionPopup] = useState(false);

  const executeCode = async (code: string) => {
    setIsExecuting(true);
    setShowExecutionPopup(true);
    setExecutionResult(null);

    try {
      const result = await codeBlockApi.executeCode(code);
      setExecutionResult(result);
    } catch (error) {
      console.error('코드 실행 중 오류 발생:', error);
      setExecutionResult({
        output: '',
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const closeExecutionPopup = () => {
    setShowExecutionPopup(false);
    setExecutionResult(null);
  };

  return {
    isExecuting,
    executionResult,
    showExecutionPopup,
    executeCode,
    closeExecutionPopup
  };
}; 