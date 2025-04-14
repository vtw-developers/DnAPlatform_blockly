import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Grid,
  Avatar,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import { authApi } from '../../services/auth';

const StyledPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(4),
  padding: theme.spacing(4),
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
}));

const UserProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState({
    email: '',
    name: '',
    organization: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const user = await authApi.getProfile();
        setUserData(prevData => ({
          ...prevData,
          email: user.email,
          name: user.name,
          organization: user.organization || ''
        }));
      } catch (err) {
        setError('프로필 정보를 불러오는데 실패했습니다.');
        console.error('Failed to fetch profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const updateData: {
        name: string;
        organization?: string;
        current_password?: string;
        new_password?: string;
      } = {
        name: userData.name,
        organization: userData.organization || undefined
      };

      // 비밀번호 변경이 요청된 경우에만 포함
      if (userData.currentPassword && userData.newPassword) {
        if (userData.newPassword !== userData.confirmNewPassword) {
          setError('새 비밀번호가 일치하지 않습니다.');
          return;
        }
        updateData.current_password = userData.currentPassword;
        updateData.new_password = userData.newPassword;
      }

      await authApi.updateProfile(updateData);
      
      // 비밀번호 필드 초기화
      setUserData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
      
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 수정에 실패했습니다.');
      console.error('Failed to update profile:', err);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <Avatar sx={{ width: 80, height: 80, mr: 2 }}>
            <PersonIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h4">
            프로필 설정
          </Typography>
        </Box>
        
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="이메일"
                value={userData.email}
                disabled
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="name"
                label="이름"
                value={userData.name}
                disabled={!isEditing}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                name="organization"
                label="소속 기관"
                value={userData.organization}
                disabled={!isEditing}
                onChange={handleChange}
              />
            </Grid>

            {isEditing && (
              <>
                <Grid item xs={12}>
                  <Divider />
                  <Box sx={{ py: 2 }}>
                    <Typography variant="h6" color="primary">
                      비밀번호 변경
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      비밀번호를 변경하지 않으려면 비워두세요
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="currentPassword"
                    label="현재 비밀번호"
                    type="password"
                    value={userData.currentPassword}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6} />
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="newPassword"
                    label="새 비밀번호"
                    type="password"
                    value={userData.newPassword}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="confirmNewPassword"
                    label="새 비밀번호 확인"
                    type="password"
                    value={userData.confirmNewPassword}
                    onChange={handleChange}
                    variant="outlined"
                  />
                </Grid>
              </>
            )}
          </Grid>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            {!isEditing ? (
              <Button
                variant="contained"
                onClick={() => setIsEditing(true)}
              >
                프로필 수정
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={() => setIsEditing(false)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                >
                  저장
                </Button>
              </>
            )}
          </Box>
        </Box>
      </StyledPaper>
    </Container>
  );
};

export default UserProfile; 