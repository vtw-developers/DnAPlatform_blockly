import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BlocklyWorkspace from './components/blockly/BlocklyWorkspace';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ProfilePage from './pages/auth/ProfilePage';
import UserManagementPage from './pages/auth/UserManagementPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import Navbar from './components/common/Navbar';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { sessionManager } from './services/api';
import './App.css';

const AppContent = () => {
  const { user, isLoading } = useAuth();
  
  // 세션 매니저 초기화
  useEffect(() => {
    if (user) {
      // 사용자가 로그인되어 있으면 세션 매니저 활성화
      console.log('세션 매니저가 활성화되었습니다.');
    }
  }, [user]);
  
  const handleCodeGenerate = (code: string) => {
    console.log('Generated code:', code);
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <Router>
      <Navbar 
        isAuthenticated={!!user} 
        isAdmin={user?.role === 'admin'} 
        userEmail={user?.email}
        userName={user?.name}
      />
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/" /> : <LoginPage />
        } />
        <Route path="/signup" element={
          user ? <Navigate to="/" /> : <SignupPage />
        } />
        <Route path="/forgot-password" element={
          user ? <Navigate to="/" /> : <ForgotPasswordPage />
        } />
        <Route path="/reset-password" element={
          user ? <Navigate to="/" /> : <ResetPasswordPage />
        } />
        <Route 
          path="/profile" 
          element={user ? <ProfilePage /> : <Navigate to="/login" />} 
        />
        <Route 
          path="/admin/users" 
          element={
            user?.role === 'admin' ? <UserManagementPage /> : <Navigate to="/" />
          } 
        />
        <Route 
          path="/" 
          element={
            user ? (
              <BlocklyWorkspace onCodeGenerate={handleCodeGenerate} />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App; 