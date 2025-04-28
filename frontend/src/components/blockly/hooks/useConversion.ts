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
  
  const conversionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const conversionElapsedTimeRef = useRef<NodeJS.Timeout | null>(null);

  const handleConvert = async (currentCode: string, title: string) => {
    if (!currentCode.trim()) {
      alert('변환할 코드가 없습니다.');
      return;
    }

    setIsConversionPopupOpen(true);
    setConversionStatus('변환 시작...');
    setConversionError(null);
    setConvertedCode('');
    setIsConverting(true);
    setConversionElapsedTime(0);
    setSourceCodeTitle(title);
    
    try {
      const response = await codeBlockApi.convertCode(currentCode, 'python');
      console.log("Conversion initiated:", response);
      
      if (response.dag_run_id) {
        setConversionDagRunId(response.dag_run_id);
        
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

      } else {
        throw new Error('DAG 실행 ID를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('Error during conversion initiation:', error);
      setConversionStatus('변환 시작 실패');
      setConversionError(error instanceof Error ? error.message : '변환 시작 중 오류 발생');
      setIsConverting(false);
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
        stopTimers();
      }

    } catch (error) {
      console.error('Error during conversion status check process:', error);
      setConversionStatus('폴링 오류');
      setConversionError(error instanceof Error ? error.message : '상태/결과 확인 중 오류');
      stopTimers();
      setIsConverting(false);
    }
  };

  const stopTimers = () => {
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

  const handleCloseConversionPopup = () => {
    setIsConversionPopupOpen(false);
    setConversionStatus('');
    setConversionError(null);
    setConvertedCode('');
    setIsConverting(false);
    setConversionDagRunId(null);
    setConversionElapsedTime(0);
    stopTimers();
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
    handleConvert,
    handleCloseConversionPopup
  };
}; 