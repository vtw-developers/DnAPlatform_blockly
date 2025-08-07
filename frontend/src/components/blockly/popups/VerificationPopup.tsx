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
  executionResult: {output?: string; error?: string} | null;
  isExecuting: boolean;
}

// 테스트 결과 파싱을 위한 인터페이스
interface TestResult {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  skippedTests: number;
  executionTime: number;
  success: boolean;
  failureDetails: string[];
  summary: string;
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

  // unittest 실행 결과를 파싱하는 함수
  const parseTestResult = (output: string | null): TestResult | null => {
    if (!output) return null;

    // 기본 결과 객체
    const defaultResult: TestResult = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      skippedTests: 0,
      executionTime: 0,
      success: false,
      failureDetails: [],
      summary: ''
    };

    try {
      const lines = output.split('\n');
      let summary = '';
      let isFailureSection = false;
      let currentFailure = '';

      for (const line of lines) {
        // unittest 결과 요약 라인 찾기 (예: "Ran 2 tests in 0.001s")
        const testRunMatch = line.match(/Ran (\d+) tests? in ([\d.]+)s/);
        if (testRunMatch) {
          defaultResult.totalTests = parseInt(testRunMatch[1]);
          defaultResult.executionTime = parseFloat(testRunMatch[2]);
          summary = line;
        }

        // 성공 여부 확인 (OK 또는 FAILED)
        if (line.trim() === 'OK' || line.includes('OK')) {
          defaultResult.success = true;
          defaultResult.successfulTests = defaultResult.totalTests;
          defaultResult.summary = summary ? summary + ' - 모든 테스트 통과' : '모든 테스트 통과';
        } else if (line.includes('FAILED')) {
          defaultResult.success = false;
          // FAILED 라인에서 실패 정보 추출 (예: "FAILED (failures=1)")
          const failureMatch = line.match(/failures=(\d+)/);
          const errorMatch = line.match(/errors=(\d+)/);
          const skippedMatch = line.match(/skipped=(\d+)/);
          
          if (failureMatch) defaultResult.failedTests += parseInt(failureMatch[1]);
          if (errorMatch) defaultResult.failedTests += parseInt(errorMatch[1]);
          if (skippedMatch) defaultResult.skippedTests = parseInt(skippedMatch[1]);
          
          defaultResult.successfulTests = defaultResult.totalTests - defaultResult.failedTests - defaultResult.skippedTests;
          defaultResult.summary = summary + ' - 테스트 실패';
        }

        // 실패 상세 정보 수집
        if (line.includes('FAIL:') || line.includes('ERROR:')) {
          isFailureSection = true;
          currentFailure = line;
        } else if (isFailureSection) {
          if (line.startsWith('======') || line.includes('Ran ')) {
            if (currentFailure.trim()) {
              defaultResult.failureDetails.push(currentFailure.trim());
            }
            isFailureSection = false;
            currentFailure = '';
          } else {
            currentFailure += '\n' + line;
          }
        }
      }

      // 마지막 실패 정보 추가
      if (currentFailure.trim()) {
        defaultResult.failureDetails.push(currentFailure.trim());
      }

      return defaultResult;
    } catch (error) {
      console.error('테스트 결과 파싱 중 오류:', error);
      return null;
    }
  };

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
  
  // executionResult의 output 또는 error에서 unittest 결과 추출
  const testOutput = executionResult?.output || executionResult?.error || null;
  const testResult = parseTestResult(testOutput);

  // 디버깅용 로그
  console.log('VerificationPopup 렌더링 상태:');
  console.log('- executionResult:', executionResult);
  console.log('- testOutput:', testOutput);
  console.log('- isExecuting:', isExecuting);
  console.log('- equivTestCode 존재:', !!equivTestCode);
  console.log('- canExecute:', canExecute);
  console.log('- testResult:', testResult);

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
                  {(executionResult || testOutput) && (
                    <div className="execution-results">
                      <h3>동등성 테스트 실행 결과</h3>
                      {testResult ? (
                        <div className="test-result-summary">
                          <div className={`test-status ${testResult.success ? 'success' : 'failure'}`}>
                            <h4>
                              {testResult.success ? '✅ 테스트 성공' : '❌ 테스트 실패'} 
                              <span className="test-summary">{testResult.summary}</span>
                            </h4>
                          </div>
                          
                          <div className="test-metrics">
                            <div className="metric-item">
                              <span className="metric-label">총 테스트:</span>
                              <span className="metric-value">{testResult.totalTests}개</span>
                            </div>
                            <div className="metric-item">
                              <span className="metric-label">성공:</span>
                              <span className="metric-value success">{testResult.successfulTests}개</span>
                            </div>
                            {testResult.failedTests > 0 && (
                              <div className="metric-item">
                                <span className="metric-label">실패:</span>
                                <span className="metric-value failure">{testResult.failedTests}개</span>
                              </div>
                            )}
                            {testResult.skippedTests > 0 && (
                              <div className="metric-item">
                                <span className="metric-label">건너뜀:</span>
                                <span className="metric-value skipped">{testResult.skippedTests}개</span>
                              </div>
                            )}
                            <div className="metric-item">
                              <span className="metric-label">실행 시간:</span>
                              <span className="metric-value">{testResult.executionTime.toFixed(3)}초</span>
                            </div>
                            <div className="metric-item">
                              <span className="metric-label">성공률:</span>
                              <span className="metric-value">
                                {testResult.totalTests > 0 
                                  ? Math.round((testResult.successfulTests / testResult.totalTests) * 100) 
                                  : 0}%
                              </span>
                            </div>
                          </div>

                          {!testResult.success && testResult.failureDetails.length > 0 && (
                            <div className="failure-details">
                              <h4>실패 상세 정보</h4>
                              {testResult.failureDetails.map((failure, index) => (
                                <div key={index} className="failure-item">
                                  <pre>{failure}</pre>
                                </div>
                              ))}
                            </div>
                          )}

                          {testResult.success && (
                            <div className="success-details">
                              <p>🎉 모든 테스트가 성공적으로 통과했습니다!</p>
                              <p>두 코드 스니펫이 동등한 결과를 생성한다는 것이 확인되었습니다.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="raw-execution-result">
                          <h4>원시 실행 결과</h4>
                          <pre>{testOutput}</pre>
                        </div>
                      )}
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
