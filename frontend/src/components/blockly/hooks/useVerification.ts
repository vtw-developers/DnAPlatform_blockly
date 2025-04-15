import { useState } from 'react';
import { codeBlockApi } from '../../../services/api';

interface VerificationResponse {
  value?: string;
  error?: string;
  status?: {
    state: 'queued' | 'running' | 'success' | 'failed';
    message?: string;
  };
}

export const useVerification = () => {
  const [isVerificationPopupOpen, setIsVerificationPopupOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [verificationResult, setVerificationResult] = useState('');
  const [verificationElapsedTime, setVerificationElapsedTime] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDagRunId, setVerificationDagRunId] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const verificationTimerRef = { current: null as NodeJS.Timeout | null };
  const elapsedTimeTimerRef = { current: null as NodeJS.Timeout | null };

  const handleVerifyCode = async (code: string, model: string) => {
    if (!code || !model) return;

    setIsVerificationPopupOpen(true);
    setVerificationStatus('검증 시작...');
    setVerificationResult('');
    setVerificationError(null);
    setIsVerifying(true);
    setVerificationElapsedTime(0);

    try {
      const response = await codeBlockApi.verifyCode(code, model);
      
      if (response.dag_run_id) {
        setVerificationDagRunId(response.dag_run_id);
        setVerificationStatus('검증 진행 중...');
        
        // 상태 폴링 시작 (10초 간격)
        if (verificationTimerRef.current) {
          clearInterval(verificationTimerRef.current);
        }
        verificationTimerRef.current = setInterval(() => {
          checkVerificationResult(response.dag_run_id);
        }, 10000); // 10초로 변경

        // 첫 번째 체크는 즉시 실행
        checkVerificationResult(response.dag_run_id);

        // 경과 시간 타이머 시작
        if (elapsedTimeTimerRef.current) {
          clearInterval(elapsedTimeTimerRef.current);
        }
        elapsedTimeTimerRef.current = setInterval(() => {
          setVerificationElapsedTime(prev => prev + 1);
        }, 1000);
      } else {
        throw new Error('DAG 실행 ID를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('Error during verification:', error);
      setVerificationStatus('검증 시작 실패');
      setVerificationError(error instanceof Error ? error.message : '검증 시작 중 오류 발생');
      setIsVerifying(false);
    }
  };

  const checkVerificationResult = async (runId: string) => {
    try {
      const resultResponse = await codeBlockApi.getVerificationResult(runId);
      console.log("Verification result check:", resultResponse);

      // 결과가 있는 경우
      if (resultResponse.value) {
        setVerificationStatus('검증 성공');
        setVerificationResult(resultResponse.value);
        stopTimers();
        setIsVerifying(false);
      }
      // 에러가 있고 404가 아닌 경우 (실제 오류)
      else if (resultResponse.error && !resultResponse.error.includes('404')) {
        setVerificationStatus('검증 실패');
        setVerificationError(resultResponse.error);
        stopTimers();
        setIsVerifying(false);
      }
      // 404 에러는 아직 결과가 준비되지 않은 것이므로 계속 진행
      else if (resultResponse.error?.includes('404')) {
        setVerificationStatus('검증 진행 중...');
        // 폴링 계속 진행
      }
      // 기타 상태 처리
      else {
        setVerificationStatus('검증 진행 중...');
      }
    } catch (error) {
      // 404 에러는 정상적인 모니터링 과정으로 처리
      if (error instanceof Error && error.message.includes('404')) {
        setVerificationStatus('검증 진행 중...');
        // 폴링 계속 진행
      } else {
        console.error('Error checking verification status:', error);
        setVerificationStatus('검증 상태 확인 실패');
        setVerificationError(error instanceof Error ? error.message : '상태 확인 중 오류 발생');
        stopTimers();
        setIsVerifying(false);
      }
    }
  };

  const stopTimers = () => {
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    if (elapsedTimeTimerRef.current) {
      clearInterval(elapsedTimeTimerRef.current);
      elapsedTimeTimerRef.current = null;
    }
  };

  const handleCloseVerificationPopup = () => {
    setIsVerificationPopupOpen(false);
    setVerificationStatus('');
    setVerificationResult('');
    setVerificationError(null);
    setIsVerifying(false);
    setVerificationDagRunId(null);
    setVerificationElapsedTime(0);
    stopTimers();
  };

  return {
    isVerificationPopupOpen,
    verificationStatus,
    verificationResult,
    verificationElapsedTime,
    isVerifying,
    verificationDagRunId,
    verificationError,
    handleVerifyCode,
    handleCloseVerificationPopup
  };
}; 