import { useState, useRef, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';

interface UseVerificationProps {
  onError?: (error: string) => void;
  pollingInterval?: number;
  maxPollingTime?: number;
}

interface VerificationResult {
  value?: string;
  error?: string;
}

export const useVerification = ({ 
  onError,
  pollingInterval = 5000, // 5초
  maxPollingTime = 300000 // 5분
}: UseVerificationProps = {}) => {
  const [isVerificationPopupOpen, setIsVerificationPopupOpen] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<string>('');
  const [verificationElapsedTime, setVerificationElapsedTime] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationDagRunId, setVerificationDagRunId] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');

  const pollingTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(0);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  const handleVerifyCode = async (code: string, model: string) => {
    if (!code.trim() || !model) {
      onError?.('코드와 모델을 모두 선택해주세요.');
      return;
    }

    setIsVerifying(true);
    setIsVerificationPopupOpen(true);
    setVerificationStatus('시작됨');
    setVerificationResult('');
    setVerificationError('');
    setVerificationElapsedTime(0);

    try {
      const response = await codeBlockApi.verifyCode(code, model);
      setVerificationDagRunId(response.dag_run_id);
      startTimeRef.current = Date.now();

      const checkStatus = async () => {
        try {
          // 최대 폴링 시간 체크
          const elapsedTime = Date.now() - startTimeRef.current;
          if (elapsedTime >= maxPollingTime) {
            throw new Error('검증 시간이 초과되었습니다.');
          }

          // DAG 상태 확인
          const dagStatus = await codeBlockApi.getDagRunStatus(response.dag_run_id);
          setVerificationElapsedTime(Math.floor(elapsedTime / 1000));

          if (dagStatus.state === 'success') {
            // DAG가 성공적으로 완료되면 결과 조회
            const result = await codeBlockApi.getVerificationResult(response.dag_run_id);
            setVerificationStatus('완료');
            setVerificationResult(result.value || '검증 결과가 없습니다.');
            setIsVerifying(false);
          } else if (dagStatus.state === 'failed' || dagStatus.state === 'error') {
            setVerificationStatus('실패');
            setVerificationError(dagStatus.error || '알 수 없는 오류가 발생했습니다.');
            setIsVerifying(false);
          } else if (dagStatus.state === 'queued' || dagStatus.state === 'running') {
            // 이전 타이머 정리
            if (pollingTimeoutRef.current) {
              clearTimeout(pollingTimeoutRef.current);
            }
            // 다음 폴링 예약
            pollingTimeoutRef.current = setTimeout(checkStatus, pollingInterval);
          } else {
            throw new Error('알 수 없는 상태입니다: ' + dagStatus.state);
          }
        } catch (error) {
          console.error('Error checking verification status:', error);
          setVerificationStatus('실패');
          setVerificationError(error instanceof Error ? error.message : '검증 상태 확인 중 오류가 발생했습니다.');
          setIsVerifying(false);
        }
      };

      checkStatus();
    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationStatus('실패');
      setVerificationError('코드 검증 요청 중 오류가 발생했습니다.');
      setIsVerifying(false);
    }
  };

  const handleCloseVerificationPopup = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    setIsVerificationPopupOpen(false);
    setVerificationStatus('');
    setVerificationResult('');
    setVerificationError('');
    setVerificationElapsedTime(0);
    setVerificationDagRunId('');
    setIsVerifying(false);
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