import { useState } from 'react';
import { codeBlockApi } from '../../../services/api';
import { ExecutionResult } from 'src/types/blockly';

export const useCodeExecution = () => {
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const executeCode = async (code: string) => {
    console.log('executeCode 호출됨, 코드:', code);
    
    if (!code.trim()) {
      console.log('코드가 비어있음');
      setExecutionStatus('실행할 코드가 없습니다.');
      return;
    }

    console.log('코드 실행 시작');
    setExecutionStatus('실행 중...');
    setExecutionResult(null);

    try {
      console.log('API 호출 중...');
      const result = await codeBlockApi.executeCode(code);
      console.log('API 응답:', result);
      
      // unittest 결과인지 확인 (성공한 unittest도 stderr에 출력됨)
      const isUnittestResult = result.error && (
        result.error.includes('Ran ') && 
        (result.error.includes('OK') || result.error.includes('FAILED'))
      );
      
      const executionResult = {
        output: result.output || (isUnittestResult ? result.error : ''),
        error: isUnittestResult ? '' : result.error
      };
      
      setExecutionResult(executionResult);
      
      // unittest 성공인지 확인
      const isUnittestSuccess = isUnittestResult && result.error.includes('OK');
      const hasError = result.error && !isUnittestResult;
      
      setExecutionStatus(hasError ? '실행 실패' : '실행 완료');
      
      console.log('실행 결과 설정 완료:', executionResult);
      console.log('실행 상태:', hasError ? '실행 실패' : '실행 완료');
      console.log('unittest 결과인가?', isUnittestResult);
      console.log('unittest 성공인가?', isUnittestSuccess);
    } catch (error) {
      console.error('코드 실행 중 오류:', error);
      const errorResult = {
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      };
      setExecutionResult(errorResult);
      setExecutionStatus('실행 실패');
      
      console.log('에러 결과 설정:', errorResult);
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