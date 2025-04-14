import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BlocklyWorkspace from './components/BlocklyWorkspace';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ProfilePage from './pages/auth/ProfilePage';
import UserManagementPage from './pages/auth/UserManagementPage';
import Navbar from './components/common/Navbar';
import { authApi } from './services/auth';
import { CircularProgress, Box } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const updateAuthStatus = async () => {
    try {
      const user = await authApi.getProfile();
      setIsAuthenticated(true);
      setUserEmail(user.email);
      setIsAdmin(user.role === 'admin');
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        await updateAuthStatus();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleCodeGenerate = (code: string) => {
    console.log('Generated code:', code);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Navbar isAuthenticated={isAuthenticated === true} isAdmin={isAdmin} userEmail={userEmail} />
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? 
              <Navigate to="/" /> : 
              <LoginPage onLoginSuccess={updateAuthStatus} />
          } />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <SignupPage />} />
          <Route 
            path="/profile" 
            element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/users" 
            element={isAuthenticated && isAdmin ? <UserManagementPage /> : <Navigate to="/" />} 
          />
          <Route 
            path="/" 
            element={
              isAuthenticated ? (
                <BlocklyWorkspace onCodeGenerate={handleCodeGenerate} />
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App; 