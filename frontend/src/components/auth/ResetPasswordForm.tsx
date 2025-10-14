import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Link,
  Paper,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const StyledPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(8),
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
}));

const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  // 컴포넌트 마운트 시 토큰 검증
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError('유효하지 않은 재설정 링크입니다.');
        setIsCheckingToken(false);
        return;
      }

      try {
        const response = await axios.get(`/api/auth/verify-reset-token/${token}`);
        setIsValidToken(true);
        setEmail(response.data.email);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.data?.detail) {
          setError(err.response.data.detail);
        } else {
          setError('유효하지 않거나 만료된 재설정 링크입니다.');
        }
      } finally {
        setIsCheckingToken(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }
    
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      const response = await axios.post('/api/auth/reset-password', {
        token: token,
        new_password: password
      });
      
      setIsSuccess(true);
      setMessage(response.data.message || '비밀번호가 성공적으로 재설정되었습니다.');
      
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 토큰 검증 중
  if (isCheckingToken) {
    return (
      <Container component="main" maxWidth="xs">
        <StyledPaper elevation={3}>
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            링크 확인 중...
          </Typography>
        </StyledPaper>
      </Container>
    );
  }

  // 토큰이 유효하지 않음
  if (!isValidToken) {
    return (
      <Container component="main" maxWidth="xs">
        <StyledPaper elevation={3}>
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            링크 오류
          </Typography>
          
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {error}
          </Alert>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.
            <br />
            새로운 재설정 링크를 요청해주세요.
          </Typography>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                navigate('/forgot-password');
              }}
              sx={{ textDecoration: 'none', mr: 2 }}
            >
              비밀번호 재설정 요청
            </Link>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
              sx={{ textDecoration: 'none' }}
            >
              로그인 페이지
            </Link>
          </Box>
        </StyledPaper>
      </Container>
    );
  }

  // 재설정 성공
  if (isSuccess) {
    return (
      <Container component="main" maxWidth="xs">
        <StyledPaper elevation={3}>
          <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
            재설정 완료
          </Typography>
          
          <Alert severity="success" sx={{ mb: 2, width: '100%' }}>
            {message}
          </Alert>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            새로운 비밀번호로 로그인하실 수 있습니다.
          </Typography>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
              sx={{ textDecoration: 'none' }}
            >
              로그인 페이지로 이동
            </Link>
          </Box>
        </StyledPaper>
      </Container>
    );
  }

  // 비밀번호 재설정 폼
  return (
    <Container component="main" maxWidth="xs">
      <StyledPaper elevation={3}>
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          새 비밀번호 설정
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          {email}의 새로운 비밀번호를 설정해주세요.
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="새 비밀번호"
            type="password"
            id="password"
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            disabled={isLoading}
            helperText="최소 6자 이상 입력해주세요"
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="confirmPassword"
            label="새 비밀번호 확인"
            type="password"
            id="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError('');
            }}
            disabled={isLoading}
          />
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isLoading}
          >
            {isLoading ? '재설정 중...' : '비밀번호 재설정'}
          </Button>
          
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link
              component="button"
              variant="body2"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
              sx={{ textDecoration: 'none' }}
            >
              로그인 페이지로 돌아가기
            </Link>
          </Box>
        </Box>
      </StyledPaper>
    </Container>
  );
};

export default ResetPasswordForm;
