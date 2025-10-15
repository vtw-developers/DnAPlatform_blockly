import React, { useEffect, useState } from 'react';
import './VerificationPopup.css';

interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: string | null;
  error: string | null;
  elapsedTime: number;
  dagRunId: string | null;
  code: string;
  isVerifying: boolean;
  onExecute: (code: string) => void;
  executionResult: {output?: string; error?: string} | null;
  isExecuting: boolean;

}



const VerificationPopup: React.FC<VerificationPopupProps> = ({
  isOpen,
  onClose,
  status,
  result,
  error,
  elapsedTime,
  dagRunId,
  code,
  isVerifying,
  onExecute,
  executionResult,
  isExecuting
}) => {
  // testOutput 상태 관리
  const [testOutput, setTestOutput] = useState<string | null>(null);

  // 팝업이 열릴 때마다 testOutput 초기화
  useEffect(() => {
    if (isOpen) {
      setTestOutput(null);
    }
  }, [isOpen]);

  // executionResult가 변경될 때 testOutput 업데이트
  useEffect(() => {
    if (executionResult) {
      setTestOutput(executionResult.output || executionResult.error || null);
    }
  }, [executionResult]);

  if (!isOpen) return null;

  const hasValidationResults = result && !error;
  const canExecute = hasValidationResults && !isExecuting;

  // JSON 파싱하여 test_cases 값 추출하는 함수
  const parseTestCases = (resultString: string | null): string | null => {
    if (!resultString) return null;
    
    console.log('받은 result 데이터:', resultString); // 디버깅용 로그
    console.log('result 데이터 타입:', typeof resultString); // 타입 확인
    
    let parsedData: any = null;
    
    // 이미 객체인 경우 처리
    if (typeof resultString === 'object') {
      parsedData = resultString;
      console.log('이미 객체 형태의 데이터:', parsedData);
    } else {
      // 문자열인 경우 파싱 시도
      const trimmedResult = resultString.trim();
      console.log('파싱할 문자열:', trimmedResult);
      
      // JSON 형태인지 확인 ({}로 시작하고 끝나는지)
      if (trimmedResult.startsWith('{') && trimmedResult.endsWith('}')) {
        try {
          // 표준 JSON 파싱 시도
          parsedData = JSON.parse(trimmedResult);
          console.log('표준 JSON 파싱 성공:', parsedData);
        } catch (error) {
          console.log('표준 JSON 파싱 실패, Python 딕셔너리 형태로 재시도');
          
          try {
            // Python 딕셔너리 형태를 안전하게 JavaScript 객체로 변환
            console.log('Python 딕셔너리 형태 변환 시도');
            
            // Function 생성자를 사용하여 안전하게 파싱 (eval보다 안전)
            // Python 딕셔너리 형태를 JavaScript 객체 리터럴로 변환
            const jsCode = `return ${trimmedResult}`;
            const parseFunction = new Function(jsCode);
            parsedData = parseFunction();
            
            console.log('Python 딕셔너리 형태 파싱 성공:', parsedData);
            
          } catch (conversionError) {
            console.error('Python 딕셔너리 변환 실패:', conversionError);
            console.error('원본 문자열:', trimmedResult);
            console.error('문자열 길이:', trimmedResult.length);
            console.error('첫 10글자:', trimmedResult.substring(0, 10));
            console.error('마지막 10글자:', trimmedResult.substring(Math.max(0, trimmedResult.length - 10)));
            
            return null; // 변환 실패 시 null 반환하여 전체 result 표시
          }
        }
      } else {
        // JSON 형태가 아닌 경우, 전체 문자열을 test_cases로 간주
        console.log('JSON 형태가 아닌 데이터, 전체를 test_cases로 처리:', trimmedResult);
        return trimmedResult;
      }
    }
    
    // test_cases 값 추출 및 처리
    if (parsedData && parsedData.test_cases) {
      const testCases = parsedData.test_cases;
      console.log('원본 test_cases:', testCases); // 디버깅용 로그
      
      if (Array.isArray(testCases)) {
        // 배열인 경우 각 테스트 케이스를 문자열로 변환하여 조합
        const testCasesString = testCases.map((testCase, index) => {
          if (typeof testCase === 'string') {
            return `# 테스트 케이스 ${index + 1}\n${testCase}`;
          } else {
            return `# 테스트 케이스 ${index + 1}\n${JSON.stringify(testCase, null, 2)}`;
          }
        }).join('\n\n');
        
        console.log('처리된 test_cases:', testCasesString); // 디버깅용 로그
        return testCasesString;
      } else if (typeof testCases === 'string') {
        // 문자열인 경우 이스케이프 처리
        let processedText = testCases
          .replace(/\\\\n/g, '\n')     // \\n을 실제 개행으로 (이중 이스케이프)
          .replace(/\\n/g, '\n')       // \n을 실제 개행으로
          .replace(/\\\\t/g, '\t')     // \\t를 실제 탭으로 (이중 이스케이프)
          .replace(/\\t/g, '\t')       // \t를 실제 탭으로
          .replace(/\\'/g, "'")        // \'를 실제 따옴표로
          .replace(/\\"/g, '"')        // \"를 실제 쌍따옴표로
          .replace(/\\\\/g, '\\');     // \\를 실제 백슬래시로
        
        console.log('처리된 test_cases:', processedText); // 디버깅용 로그
        return processedText;
      } else {
        console.log('test_cases가 배열이나 문자열이 아님:', typeof testCases, testCases);
        return JSON.stringify(testCases, null, 2); // JSON 형태로 변환
      }
    }
    
    return null;
  };

  const testCasesCode = parseTestCases(result);

  // 디버깅용 로그
  console.log('VerificationPopup 렌더링 상태:');
  console.log('- result 원본:', result);
  console.log('- result 타입:', typeof result);
  console.log('- result 길이:', result ? result.length : 0);
  console.log('- executionResult:', executionResult);
  console.log('- testOutput:', testOutput);
  console.log('- isExecuting:', isExecuting);
  console.log('- testCasesCode 존재:', !!testCasesCode);
  console.log('- testCasesCode 내용:', testCasesCode);
  console.log('- canExecute:', canExecute);

  return (
    <div className="popup-overlay">
      <div className="popup-content verification-popup">
        <div className="popup-header">
          <h2>코드 검증 결과</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          {isVerifying ? (
            <div className="verification-status">
              <p>검증 중... ({elapsedTime}초)</p>
              {dagRunId && <p>DAG Run ID: {dagRunId}</p>}
            </div>
          ) : (
            <div className="verification-results">
              {error ? (
                <div className="error-message">
                  <h3>검증 오류</h3>
                  <pre>{error}</pre>
                </div>
              ) : result ? (
                <>
                  <div className="success-message">
                    <h3>검증 성공</h3>
                    {testCasesCode ? (
                      <div className="test-cases-section">
                        <h4>생성된 테스트 케이스</h4>
                        <code className="test-cases-code">
                          <pre style={{ whiteSpace: 'pre-wrap' }}>{testCasesCode}</pre>
                        </code>
                      </div>
                    ) : (
                      <pre>{result}</pre>
                    )}
                  </div>
                  {(executionResult || testOutput) && !isExecuting && (
                    <div className="execution-results">
                      <h3>동등성 테스트 실행 결과</h3>
                      <div className="raw-execution-result">
                        <pre>{testOutput}</pre>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
              {canExecute && testCasesCode && (
                <button 
                  className="execute-button"
                  onClick={() => {
                    console.log('테스트 케이스 실행 시작');
                    console.log('실행할 코드:', testCasesCode);
                    onExecute(testCasesCode);
                  }}
                  disabled={isExecuting}
                >
                  {isExecuting ? '실행 중...' : '테스트 케이스 실행'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationPopup; 
