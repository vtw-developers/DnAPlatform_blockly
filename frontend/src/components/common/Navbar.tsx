import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import { authApi } from '../../services/auth';
import logo from '../../assets/logo.png';

interface NavbarProps {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userEmail?: string;
  userName?: string;
}

const Navbar = ({ isAuthenticated, isAdmin, userEmail, userName }: NavbarProps) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    authApi.logout();
    handleClose();
    navigate('/login');
    // 페이지 새로고침하여 앱 상태 초기화
    window.location.reload();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Box
          sx={{
            flexGrow: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={() => navigate('/')}
        >
          <img
            src={logo}
            alt="DnA Blockly Logo"
            style={{
              height: '40px',
              marginRight: '10px'
            }}
          />
        </Box>

        {isAuthenticated ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {isAdmin && (
              <Button
                color="inherit"
                onClick={() => navigate('/admin/users')}
                sx={{ mr: 2 }}
              >
                사용자 관리
              </Button>
            )}
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Avatar sx={{ width: 32, height: 32 }}>
                <PersonIcon />
              </Avatar>
              {userName && (
                <Typography variant="body2" sx={{ ml: 1, color: 'white' }}>
                  {userName}
                </Typography>
              )}
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={() => { handleClose(); navigate('/profile'); }}>
                프로필 설정
              </MenuItem>
              <MenuItem onClick={handleLogout}>로그아웃</MenuItem>
            </Menu>
          </Box>
        ) : (
          <Box>
            <Button color="inherit" onClick={() => navigate('/login')}>
              로그인
            </Button>
            <Button color="inherit" onClick={() => navigate('/signup')}>
              회원가입
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar; 