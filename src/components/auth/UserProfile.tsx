import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Grid,
  Avatar,
  Divider
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';

const StyledPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(4),
  padding: theme.spacing(4),
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
}));

const UserProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    email: 'user@example.com',
    name: '홍길동',
    organization: 'ABC 기관',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 프로필 업데이트 처리
    setIsEditing(false);
  };

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
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
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    비밀번호 변경
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="currentPassword"
                    label="현재 비밀번호"
                    type="password"
                    value={userData.currentPassword}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="newPassword"
                    label="새 비밀번호"
                    type="password"
                    value={userData.newPassword}
                    onChange={handleChange}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    name="confirmNewPassword"
                    label="새 비밀번호 확인"
                    type="password"
                    value={userData.confirmNewPassword}
                    onChange={handleChange}
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