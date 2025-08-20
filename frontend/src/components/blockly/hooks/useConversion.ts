import { useState, useRef } from 'react';
import { codeBlockApi } from '../../../services/api';

export const useConversion = () => {
  const [isConversionPopupOpen, setIsConversionPopupOpen] = useState(false);
  const [conversionStatus, setConversionStatus] = useState<string>('');
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [convertedCode, setConvertedCode] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionDagRunId, setConversionDagRunId] = useState<string | null>(null);
  const [conversionElapsedTime, setConversionElapsedTime] = useState(0);
  const [sourceCodeTitle, setSourceCodeTitle] = useState<string>('');
  const [currentCode, setCurrentCode] = useState<string>('');
  
  // 변환규칙 생성 관련 상태 추가
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [ruleCreationStatus, setRuleCreationStatus] = useState<string>('');
  const [ruleDagRunId, setRuleDagRunId] = useState<string | null>(null);
  const [ruleCreationElapsedTime, setRuleCreationElapsedTime] = useState(0);
  const [ruleCreationResult, setRuleCreationResult] = useState<string>('');
  const [ruleCreationError, setRuleCreationError] = useState<string | null>(null);
  
  const conversionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversionElapsedTimeRef = useRef<NodeJS.Timeout | null>(null);
  
  // 변환규칙 생성 관련 타이머
  const ruleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ruleElapsedTimeRef = useRef<NodeJS.Timeout | null>(null);

  const handleConvert = async (code: string, title: string) => {
    if (!code.trim()) {
      alert('변환할 코드가 없습니다.');
      return;
    }

    setIsConversionPopupOpen(true);
    setCurrentCode(code);
    setSourceCodeTitle(title);
    setConversionStatus('');
    setConversionError(null);
    setConvertedCode('');
    setIsConverting(false);
    setConversionDagRunId(null);
    setConversionElapsedTime(0);
    
    // 변환규칙 생성 상태도 초기화
    setIsCreatingRule(false);
    setRuleCreationStatus('');
    setRuleDagRunId(null);
    setRuleCreationElapsedTime(0);
    setRuleCreationResult('');
    setRuleCreationError(null);
  };

  const startConversion = async () => {
    if (!currentCode) {
      alert('변환할 코드가 없습니다.');
      return;
    }

    // 변환 시작 시 상태 초기화
    setConvertedCode('');
    setConversionStatus('변환 시작...');
    setConversionError(null);
    setConversionDagRunId(null);
    setConversionElapsedTime(0);
    setIsConverting(true);

    try {
      // 변환규칙은 백엔드에서 자동으로 처리
      const response = await codeBlockApi.convertCode(currentCode, 'python');
      setConversionDagRunId(response.dag_run_id);
      setConversionStatus('변환 진행 중...');
      
      // 상태 폴링 시작
      if (conversionTimerRef.current) {
        clearInterval(conversionTimerRef.current);
      }
      conversionTimerRef.current = setInterval(() => {
        checkConversionResult(response.dag_run_id);
      }, 2000);

      // 경과 시간 타이머 시작
      if (conversionElapsedTimeRef.current) {
        clearInterval(conversionElapsedTimeRef.current);
      }
      conversionElapsedTimeRef.current = setInterval(() => {
        setConversionElapsedTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error during conversion:', error);
      setConversionStatus('변환 실패');
      setConversionError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setIsConverting(false);
    }
  };

  // 변환규칙 생성 시작
  const startRuleCreation = async () => {
    if (!currentCode) {
      alert('변환할 코드가 없습니다.');
      return;
    }

    // 변환규칙 생성 시작 시 상태 초기화
    setRuleCreationResult('');
    setRuleCreationStatus('변환규칙 생성 요청 중...');
    setRuleCreationError(null);
    setRuleDagRunId(null);
    setRuleCreationElapsedTime(0);
    setIsCreatingRule(true);

    try {
      const response = await codeBlockApi.generateRule(currentCode);
      setRuleDagRunId(response.dag_run_id);
      setRuleCreationStatus(`변환규칙 생성 요청 완료. DAG Run ID: ${response.dag_run_id}`);
      
      // 상태 폴링 시작
      if (ruleTimerRef.current) {
        clearInterval(ruleTimerRef.current);
      }
      ruleTimerRef.current = setInterval(() => {
        checkRuleCreationResult(response.dag_run_id);
      }, 3000);

      // 경과 시간 타이머 시작
      if (ruleElapsedTimeRef.current) {
        clearInterval(ruleElapsedTimeRef.current);
      }
      ruleElapsedTimeRef.current = setInterval(() => {
        setRuleCreationElapsedTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error during rule creation:', error);
      setRuleCreationStatus('변환규칙 생성 실패');
      setRuleCreationError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
      setIsCreatingRule(false);
    }
  };

  const checkConversionResult = async (runId: string) => {
    let shouldStopPolling = false;
    try {
      const statusResponse = await codeBlockApi.getConversionStatus(runId);
      console.log("Conversion status check (backend):", statusResponse);

      switch (statusResponse.state) {
        case 'success':
          setConversionStatus('변환 성공, 결과 가져오는 중...');
          shouldStopPolling = true;
          const resultResponse = await codeBlockApi.getConversionResult(runId);
          console.log("Conversion result check (backend):", resultResponse);
          if (resultResponse.value) {
            setConvertedCode(resultResponse.value);
            setConversionStatus('변환 완료');
          } else {
            setConvertedCode('// 변환 결과 없음');
            setConversionStatus('변환 성공 (결과 없음)');
            setConversionError(resultResponse.error || '성공했으나 결과를 가져오지 못했습니다.');
          }
          setIsConverting(false);
          break;

        case 'failed':
        case 'error':
          setConversionStatus('변환 실패');
          setConversionError(statusResponse.error || 'Airflow DAG 실행 실패 또는 상태 조회 오류');
          shouldStopPolling = true;
          setIsConverting(false);
          break;

        case 'running':
        case 'queued':
          if (conversionStatus !== '변환 진행 중...') {
            setConversionStatus('변환 진행 중...');
          }
          break;

        default:
          setConversionStatus(`상태 알 수 없음: ${statusResponse.state}`);
          break;
      }

      if (shouldStopPolling) {
        stopConversionTimers();
      }

    } catch (error) {
      console.error('Error during conversion status check process:', error);
      setConversionStatus('폴링 오류');
      setConversionError(error instanceof Error ? error.message : '상태/결과 확인 중 오류');
      stopConversionTimers();
      setIsConverting(false);
    }
  };

  // 변환규칙 생성 결과 확인
  const checkRuleCreationResult = async (runId: string) => {
    let shouldStopPolling = false;
    try {
      const response = await codeBlockApi.getRuleGenerationResult(runId);
      console.log("Rule creation result check:", response);

      if (response.error) {
        // 에러 발생 - DAG가 아직 실행 중인 경우 계속 모니터링
        if (response.error.includes('DAG가 아직 실행 중입니다')) {
          console.log("DAG is still running, continue monitoring...");
          return; // 계속 모니터링
        }
        
        // 다른 에러인 경우 중단
        setRuleCreationError(response.error);
        setIsCreatingRule(false);
        setRuleCreationStatus('변환규칙 생성 실패');
        shouldStopPolling = true;
      } else if (response.status === 'SUCCESS') {
        // 성공적으로 완료
        const resultMessage = response.result?.message || response.result?.result_code || '변환규칙이 성공적으로 생성되었습니다.';
        setRuleCreationResult(resultMessage);
        setIsCreatingRule(false);
        setRuleCreationStatus('변환규칙 생성 완료');
        shouldStopPolling = true;
      } else if (response.status === 'ERROR') {
        // DAG 실행 중 에러 발생
        setRuleCreationError(response.error || '변환규칙 생성 중 오류가 발생했습니다.');
        setIsCreatingRule(false);
        setRuleCreationStatus('변환규칙 생성 실패');
        shouldStopPolling = true;
      }
      // RUNNING 상태인 경우 계속 모니터링

      if (shouldStopPolling) {
        stopRuleTimers();
      }

    } catch (error) {
      console.error('Error during rule creation status check:', error);
      setRuleCreationStatus('상태 확인 중 오류');
      setRuleCreationError(error instanceof Error ? error.message : '상태 확인 중 오류');
      stopRuleTimers();
      setIsCreatingRule(false);
    }
  };

  const stopConversionTimers = () => {
    if (conversionTimerRef.current) {
      clearInterval(conversionTimerRef.current);
      conversionTimerRef.current = null;
      console.log("Conversion polling timer stopped.");
    }
    if (conversionElapsedTimeRef.current) {
      clearInterval(conversionElapsedTimeRef.current);
      conversionElapsedTimeRef.current = null;
      console.log("Conversion elapsed time timer stopped.");
    }
  };

  const stopRuleTimers = () => {
    if (ruleTimerRef.current) {
      clearInterval(ruleTimerRef.current);
      ruleTimerRef.current = null;
      console.log("Rule creation polling timer stopped.");
    }
    if (ruleElapsedTimeRef.current) {
      clearInterval(ruleElapsedTimeRef.current);
      ruleElapsedTimeRef.current = null;
      console.log("Rule creation elapsed time timer stopped.");
    }
  };

  const handleCloseConversionPopup = () => {
    setIsConversionPopupOpen(false);
    setConversionStatus('');
    setConversionError(null);
    setConvertedCode('');
    setIsConverting(false);
    setConversionDagRunId(null);
    setConversionElapsedTime(0);
    stopConversionTimers();
    
    // 변환규칙 생성 상태도 초기화
    setIsCreatingRule(false);
    setRuleCreationStatus('');
    setRuleDagRunId(null);
    setRuleCreationElapsedTime(0);
    setRuleCreationResult('');
    setRuleCreationError(null);
    stopRuleTimers();
  };

  // 변환규칙 저장 완료 후 상태 초기화
  const handleRulesSaved = () => {
    setRuleCreationResult('');
    setRuleCreationStatus('');
    setRuleCreationError(null);
  };

  return {
    isConversionPopupOpen,
    conversionStatus,
    conversionError,
    convertedCode,
    isConverting,
    conversionDagRunId,
    conversionElapsedTime,
    sourceCodeTitle,
    currentCode,
    // 변환규칙 생성 관련 상태와 함수들
    isCreatingRule,
    ruleCreationStatus,
    ruleDagRunId,
    ruleCreationElapsedTime,
    ruleCreationResult,
    ruleCreationError,
    setRuleCreationResult,  // 변환규칙 결과 설정 함수 추가
    handleConvert,
    startConversion,
    startRuleCreation,  // 변환규칙 생성 시작 함수 추가
    handleCloseConversionPopup,
    handleRulesSaved
  };
}; 