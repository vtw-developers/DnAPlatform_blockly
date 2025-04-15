import { useState } from 'react';
import { codeBlockApi } from '../../../services/api';
import { ExecutionResult } from '../types/blockly.types';

export const useCodeExecution = () => {
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const executeCode = async (code: string) => {
    if (!code.trim()) {
      setExecutionStatus('실행할 코드가 없습니다.');
      return;
    }

    setExecutionStatus('실행 중...');
    setExecutionResult(null);

    try {
      const result = await codeBlockApi.executeCode(code);
      setExecutionResult({
        output: result.output,
        error: result.error
      });
      setExecutionStatus(result.error ? '실행 실패' : '실행 완료');
    } catch (error) {
      setExecutionResult({
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      });
      setExecutionStatus('실행 실패');
    }
  };

  const closeExecutionPopup = () => {
    setExecutionStatus('');
    setExecutionResult(null);
  };

  return {
    executeCode,
    executionStatus,
    executionResult,
    closeExecutionPopup
  };
}; 