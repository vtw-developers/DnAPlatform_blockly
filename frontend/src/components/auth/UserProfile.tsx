import React, { useEffect, useState } from 'react';
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
import { authApi, User } from '../../services/auth';
import { GridProps } from '@mui/material/Grid';
import { Theme } from '@mui/material/styles';
import { SxProps } from '@mui/system';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(3),
}));

export const UserProfile: React.FC = () => {
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    current_password: '',
    new_password: '',
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const data = await authApi.getProfile();
      setUserData(data);
      setFormData({
        name: data.name,
        organization: data.organization || '',
        current_password: '',
        new_password: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedUser = await authApi.updateProfile(formData);
      setUserData(updatedUser);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '프로필 업데이트에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm">
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!userData) {
    return (
      <Container maxWidth="sm">
        <Typography>사용자 정보를 찾을 수 없습니다.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <StyledPaper>
        <Box textAlign="center" mb={3}>
          <Avatar sx={{ width: 80, height: 80, margin: '0 auto', mb: 2 }}>
            <PersonIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom>
            프로필
          </Typography>
        </Box>

        <form onSubmit={handleSubmit}>
          <Box sx={{ flexGrow: 1 }}>
            <Grid container spacing={3}>
              <Grid xs={12} item>
                <Typography variant="h5" gutterBottom>
                  프로필 정보
                </Typography>
              </Grid>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  label="이메일"
                  value={userData?.email || ''}
                  disabled
                />
              </Grid>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  label="이름"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </Grid>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  label="소속"
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              </Grid>
              <Grid xs={12} sm={6} item>
                <TextField
                  fullWidth
                  label="역할"
                  value={userData?.role || ''}
                  disabled
                />
              </Grid>
              {isEditing && (
                <>
                  <Grid xs={12} sm={6} item>
                    <TextField
                      fullWidth
                      type="password"
                      label="현재 비밀번호"
                      name="current_password"
                      value={formData.current_password}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid xs={12} sm={6} item>
                    <TextField
                      fullWidth
                      type="password"
                      label="새 비밀번호"
                      name="new_password"
                      value={formData.new_password}
                      onChange={handleChange}
                    />
                  </Grid>
                </>
              )}
              <Grid xs={12} item>
                {isEditing ? (
                  <Box sx={{ mt: 2 }}>
                    <Button type="submit" variant="contained" color="primary" sx={{ mr: 1 }}>
                      저장
                    </Button>
                    <Button variant="outlined" onClick={() => setIsEditing(false)}>
                      취소
                    </Button>
                  </Box>
                ) : (
                  <Button variant="contained" onClick={() => setIsEditing(true)} sx={{ mt: 2 }}>
                    수정
                  </Button>
                )}
              </Grid>
            </Grid>
          </Box>
        </form>
      </StyledPaper>
    </Container>
  );
};

export default UserProfile; 