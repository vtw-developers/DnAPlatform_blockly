import React from 'react';
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
  executionResult: string | null;
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
  if (!isOpen) return null;

  const hasValidationResults = result && !error;
  const canExecute = hasValidationResults && !isExecuting;

  // JSON 파싱하여 equiv_test 값 추출하는 함수
  const parseEquivTest = (resultString: string | null): string | null => {
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
      if (!trimmedResult.startsWith('{') || !trimmedResult.endsWith('}')) {
        console.log('JSON 형태가 아닌 데이터:', trimmedResult);
        return null;
      }
      
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
    }
    
    // equiv_test 값 추출 및 처리
    if (parsedData && parsedData.equiv_test) {
      const equivTest = parsedData.equiv_test;
      console.log('원본 equiv_test:', equivTest); // 디버깅용 로그
      
      if (typeof equivTest === 'string') {
        // 모든 가능한 이스케이프 패턴을 처리
        let processedText = equivTest
          .replace(/\\\\n/g, '\n')     // \\n을 실제 개행으로 (이중 이스케이프)
          .replace(/\\n/g, '\n')       // \n을 실제 개행으로
          .replace(/\\\\t/g, '\t')     // \\t를 실제 탭으로 (이중 이스케이프)
          .replace(/\\t/g, '\t')       // \t를 실제 탭으로
          .replace(/\\'/g, "'")        // \'를 실제 따옴표로
          .replace(/\\"/g, '"')        // \"를 실제 쌍따옴표로
          .replace(/\\\\/g, '\\');     // \\를 실제 백슬래시로
        
        console.log('처리된 equiv_test:', processedText); // 디버깅용 로그
        return processedText;
      } else {
        console.log('equiv_test가 문자열이 아님:', typeof equivTest, equivTest);
        return String(equivTest); // 문자열로 변환
      }
    }
    
    return null;
  };

  const equivTestCode = parseEquivTest(result);

  // 디버깅용 로그
  console.log('VerificationPopup 렌더링 상태:');
  console.log('- executionResult:', executionResult);
  console.log('- isExecuting:', isExecuting);
  console.log('- equivTestCode 존재:', !!equivTestCode);
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
                    {equivTestCode ? (
                      <div className="equiv-test-section">
                        <h4>검증 테스트 코드</h4>
                        <code className="equiv-test-code">
                          <pre style={{ whiteSpace: 'pre-wrap' }}>{equivTestCode}</pre>
                        </code>
                      </div>
                    ) : (
                      <pre>{result}</pre>
                    )}
                  </div>
                  {executionResult && (
                    <div className="execution-results">
                      <h3>실행 결과</h3>
                      <pre>{executionResult}</pre>
                    </div>
                  )}
                </>
              ) : null}
              {canExecute && equivTestCode && (
                <button 
                  className="execute-button"
                  onClick={() => {
                    console.log('검증 테스트 코드 실행 시작');
                    console.log('실행할 코드:', equivTestCode);
                    onExecute(equivTestCode);
                  }}
                  disabled={isExecuting}
                >
                  {isExecuting ? '실행 중...' : '검증 테스트 코드 실행'}
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
